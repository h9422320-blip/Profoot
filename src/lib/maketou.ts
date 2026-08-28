/**
 * LIRE UNE VENTE MAKETOU, ET N'OUVRIR UN ACCÈS QUE SI ELLE EST VRAIE.
 *
 * ── LE FORMAT, OBSERVÉ ET NON DEVINÉ ──────────────────────────────────────
 *
 * Relevé le 27 août 2026 sur un message de test réel :
 *
 *     {
 *       "eventType": "SUCCESSFUL_SALE",
 *       "customer": { "email", "name", "phone" },
 *       "products": [ { "id", "name", "price", "currency" } ],
 *       "sale":     { "id", "amount", "currency" },
 *       "originCountry": { "code" },
 *       "paymentMethod": { "name" }
 *     }
 *
 * ── DEUX PIÈGES REPÉRÉS DANS CE MESSAGE ───────────────────────────────────
 *
 * 1. `sale.amount` vaut 2999 quand `products[0].price` vaut 29.99 : le montant
 *    de la vente est en CENTIMES, celui du produit en unités. Confondre les
 *    deux ferait refuser toutes les ventes — ou pire, en accepter de fausses.
 *    C'est exactement l'erreur commise la veille sur l'autre boutique, où un
 *    paiement de 2 000 FCFA s'affichait « 3,14 ».
 *
 *    Le franc CFA n'a pas de décimales ; on accepte donc les deux écritures et
 *    on compare à ce que l'offre coûte réellement.
 *
 * 2. AUCUNE SIGNATURE. MakeTou n'envoie qu'un `user-agent: MaketouPulse/1.0`,
 *    qui se falsifie en trois secondes. L'authenticité repose donc entièrement
 *    sur un secret partagé placé dans l'adresse du pulse — et sans lui, ce
 *    module refuse d'ouvrir quoi que ce soit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PLANS, type PlanKey } from './subscription';

export interface VenteMaketou {
  eventType?: string;
  meta?: { source?: string; orderId?: string };
  sale?: { id?: string; amount?: number; currency?: string };
  store?: { id?: string; name?: string };
  customer?: { name?: string; email?: string; phone?: string };
  products?: { id?: string; name?: string; price?: number; currency?: string }[];
  originCountry?: { code?: string; name?: string; alpha3Code?: string };
  paymentMethod?: { name?: string };
}

/**
 * Le secret attendu dans l'adresse du pulse.
 *
 * Absent, le module refuse d'ouvrir un accès : mieux vaut un client qui attend
 * qu'un inconnu qui se sert.
 */
export function secretAttendu(): string | null {
  return process.env.MAKETOU_PULSE_SECRET || null;
}

/** Comparaison à durée constante : une comparaison naïve fuit le secret. */
export function secretValide(fourni: string | null): boolean {
  const attendu = secretAttendu();
  if (!attendu) return false;
  if (!fourni || fourni.length !== attendu.length) return false;
  let ecart = 0;
  for (let i = 0; i < attendu.length; i++) ecart |= fourni.charCodeAt(i) ^ attendu.charCodeAt(i);
  return ecart === 0;
}

/**
 * Quelle offre a été achetée.
 *
 * Le nom du produit fait foi en premier : c'est nous qui l'avons écrit, il est
 * lisible, et il survit à un changement d'identifiant côté boutique. Le montant
 * ne sert que de repli — deux offres pourraient un jour coûter le même prix.
 */
export function offreParNom(vente: VenteMaketou): PlanKey | null {
  // La marque s'écrit « ProFoot » : la chercher telle quelle ferait passer une
  // casquette ProFoot pour l'offre Pro. On retire le nom de la marque avant de
  // lire l'offre, et on exige un mot entier — « pro » et non « profoot ».
  const nom = (vente.products?.[0]?.name ?? '')
    .toLowerCase()
    .replace(/profoot(\s*ai)?/g, ' ');

  if (/\bessentiel\b/.test(nom)) return 'essential_monthly';
  if (/\bvip\b/.test(nom)) return 'vip_yearly';
  if (/\bpro\b/.test(nom)) return 'pro_monthly';
  return null;
}

export function offreAchetee(vente: VenteMaketou): PlanKey | null {
  const parNom = offreParNom(vente);
  if (parNom) return parNom;

  // Repli sur le montant, en tolérant les deux écritures.
  const montant = montantEnFrancs(vente);
  if (montant == null) return null;
  const cles = Object.keys(PLANS) as PlanKey[];
  return (
    cles.find((c) => PLANS[c].amountXof === montant) ??
    cles.find((c) => (PLANS[c].montantsPrecedents as readonly number[]).includes(montant)) ??
    null
  );
}

/**
 * Le montant réellement payé, ramené en francs.
 *
 * `sale.amount` est en centimes — 2999 pour 29,99. Le franc CFA n'ayant pas de
 * décimales, une vente à 2 000 FCFA peut arriver écrite « 2000 » ou « 200000 ».
 * On rend la valeur en unités, et l'appelant vérifie qu'elle correspond.
 */
export function montantEnFrancs(vente: VenteMaketou): number | null {
  const prixProduit = vente.products?.[0]?.price;
  if (typeof prixProduit === 'number' && Number.isFinite(prixProduit)) {
    return Math.round(prixProduit);
  }
  const brut = vente.sale?.amount;
  if (typeof brut !== 'number' || !Number.isFinite(brut)) return null;
  // Sans prix de produit, on ne peut pas trancher entre unités et centimes.
  // On rend la valeur brute : l'appelant l'acceptera si elle correspond à
  // l'offre, telle quelle ou divisée par cent.
  return Math.round(brut);
}

/** Le montant est-il compatible avec l'offre, dans l'une ou l'autre écriture ? */
export function montantCompatible(paye: number, plan: PlanKey): boolean {
  const config = PLANS[plan];
  const acceptes = [config.amountXof, ...(config.montantsPrecedents as readonly number[])];
  return acceptes.some((a) => paye === a || paye === a * 100);
}

/**
 * DANS QUELLE MONNAIE LA VENTE A-T-ELLE ÉTÉ RÉGLÉE.
 *
 * Relevé le 28 août 2026 sur la page publique de la boutique : l'offre à
 * 2 000 FCFA s'affiche « 31 242 GNF » à un visiteur guinéen. MakeTou convertit
 * dans la monnaie de l'acheteur, et c'est une bonne chose — un client de
 * Conakry voit un prix qu'il comprend.
 *
 * Mais le montant qui remonte n'est alors plus comparable au tarif. Comparer
 * 31 242 à 2 000 ferait refuser une vente parfaitement honnête, et le client
 * aurait payé pour rien. C'est le même piège que « 3,14 F » chez l'autre
 * boutique, en pire : ici il coûterait des accès, pas seulement un chiffre faux.
 */
export function deviseDeLaVente(vente: VenteMaketou): string | null {
  const brute = vente.products?.[0]?.currency ?? vente.sale?.currency ?? null;
  return brute ? String(brute).toUpperCase() : null;
}

/** Le montant est-il exprimé dans notre monnaie, donc comparable au tarif ? */
export function montantComparable(vente: VenteMaketou): boolean {
  const devise = deviseDeLaVente(vente);
  return devise === null || devise === 'XOF';
}

export type ResultatPulse =
  | { ouvert: true; plan: PlanKey; expireLe: string; email: string }
  | { ouvert: false; motif: string; email?: string };

/**
 * Ouvre l'accès d'un acheteur MakeTou.
 *
 * L'authenticité du message doit avoir été vérifiée AVANT d'appeler cette
 * fonction : elle fait confiance à ce qu'on lui donne.
 */
export async function ouvrirAccesMaketou(
  admin: SupabaseClient,
  vente: VenteMaketou
): Promise<ResultatPulse> {
  if (vente.eventType && vente.eventType !== 'SUCCESSFUL_SALE') {
    return { ouvert: false, motif: `Événement ignoré : ${vente.eventType}.` };
  }

  const email = vente.customer?.email?.toLowerCase().trim();
  if (!email) return { ouvert: false, motif: 'Vente sans adresse e-mail.' };

  const venteId = vente.sale?.id;
  if (!venteId) return { ouvert: false, motif: 'Vente sans identifiant.', email };

  const plan = offreAchetee(vente);
  if (!plan) {
    return {
      ouvert: false,
      email,
      motif: `Offre non reconnue (produit « ${vente.products?.[0]?.name ?? '?'} »).`,
    };
  }

  // ── LE MONTANT, QUAND IL VEUT DIRE QUELQUE CHOSE ────────────────────────
  //
  // Le contrôle du montant est un garde-fou : il empêche qu'un règlement de
  // cent francs ouvre l'offre annuelle. Il n'a de sens que si la vente est
  // libellée en francs CFA.
  //
  // Réglée en gourdes guinéennes, en nairas ou en euros, la somme n'est plus
  // comparable au tarif, et l'appliquer quand même refuserait des ventes
  // honnêtes. Dans ce cas c'est le NOM du produit qui fait foi — un nom que
  // nous avons écrit nous-mêmes, sur un produit dont nous fixons le prix :
  // l'acheteur ne choisit pas ce qu'il paie.
  const paye = montantEnFrancs(vente);
  if (montantComparable(vente)) {
    if (paye == null || !montantCompatible(paye, plan)) {
      return {
        ouvert: false,
        email,
        motif: `Montant ${paye} incompatible avec l'offre ${plan} (${PLANS[plan].amountXof}).`,
      };
    }
  } else if (!offreParNom(vente)) {
    return {
      ouvert: false,
      email,
      motif:
        `Vente en ${deviseDeLaVente(vente)} : le montant ${paye} n'est pas comparable au tarif, ` +
        `et le produit « ${vente.products?.[0]?.name ?? '?'} » ne nomme aucune offre.`,
    };
  } else {
    console.log(
      `[MAKETOU] Vente en ${deviseDeLaVente(vente)} (${paye}) — offre ${plan} reconnue au nom du produit.`
    );
  }

  // ── QUI EST-CE ? ────────────────────────────────────────────────────────
  //
  // La vente se fait sur la boutique, pas dans l'application : l'acheteur n'a
  // pas forcément de compte. Le 26 août, deux personnes ont payé sans compte
  // et sont restées invisibles jusqu'à ce qu'on les cherche. On enregistre
  // donc la vente même sans compte, pour qu'elle ne disparaisse pas.
  let userId: string | null = null;
  for (let page = 1; page <= 30; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    const trouve = data.users.find((u) => String(u.email).toLowerCase() === email);
    if (trouve) { userId = trouve.id; break; }
    if (data.users.length < 1000) break;
  }

  await admin.from('payment_intents').upsert(
    {
      sale_id: venteId,
      user_id: userId,
      email,
      plan,
      amount: PLANS[plan].amountXof,
      pays: vente.originCountry?.code ?? null,
      pays_source: 'maketou',
      moyen_paiement: vente.paymentMethod?.name ?? null,
      statut_boutique: 'completed',
      releve_le: new Date().toISOString(),
    },
    { onConflict: 'sale_id' }
  );

  if (!userId) {
    return {
      ouvert: false,
      email,
      motif: `Aucun compte ProFoot à cette adresse. La vente est enregistrée ; l'accès s'ouvrira à l'inscription.`,
    };
  }

  // ── LE TEMPS RESTANT N'EST JAMAIS PERDU ─────────────────────────────────
  const config = PLANS[plan];
  const { data: courant } = await admin
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1);

  const finActuelle = courant?.[0]?.expires_at ? Date.parse(courant[0].expires_at) : 0;
  const depart = Math.max(Date.now(), finActuelle);
  const expireLe = new Date(depart + config.durationDays * 86_400_000).toISOString();

  // ── CRÉDITER UNE FOIS, ET UNE SEULE ─────────────────────────────────────
  //
  // La colonne porte le nom de l'autre boutique — héritage. C'est elle qui
  // porte la contrainte d'unicité, et la renommer casserait le chemin qui
  // fonctionne en production. `provider` distingue les passerelles.
  const { data, error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan,
        status: 'active',
        provider: 'maketou',
        chariow_sale_id: venteId,
        amount: config.amountXof,
        currency: 'XOF',
        expires_at: expireLe,
      },
      { onConflict: 'chariow_sale_id', ignoreDuplicates: true }
    )
    .select('id');

  if (error) {
    console.error('[MAKETOU] Écriture impossible :', error.message);
    return { ouvert: false, email, motif: 'Erreur base de données.' };
  }
  if (!data?.length) return { ouvert: false, email, motif: 'Vente déjà créditée.' };

  await admin
    .from('payment_intents')
    .update({ consumed_at: new Date().toISOString() })
    .eq('sale_id', venteId);

  console.log(`[MAKETOU] Accès ${plan} ouvert pour ${email} jusqu'au ${expireLe.slice(0, 10)}.`);
  return { ouvert: true, plan, expireLe, email };
}
