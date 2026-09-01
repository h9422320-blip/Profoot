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
  // Le prix du produit d'abord, et pour DEUX raisons désormais.
  //
  // La première tenait aux centimes. La seconde s'est vue le 28 août 2026 sur
  // les premières vraies ventes : `sale.amount` valait « 2040 » là où le produit
  // coûte 2 000. MakeTou ajoute ses frais au montant de la vente. Comparer
  // celui-là au tarif refuserait toutes les ventes, sans exception.
  const prixProduit = nombreEventuel(vente.products?.[0]?.price);
  if (prixProduit !== null) return Math.round(prixProduit);

  const brut = nombreEventuel(vente.sale?.amount);
  if (brut === null) return null;
  // Sans prix de produit, on ne peut pas trancher entre unités et centimes.
  // On rend la valeur brute : l'appelant l'acceptera si elle correspond à
  // l'offre, telle quelle ou divisée par cent.
  return Math.round(brut);
}

/**
 * Un nombre, qu'il arrive en nombre ou en texte.
 *
 * ── L'ERREUR QUI A COÛTÉ NEUF ACCÈS ───────────────────────────────────────
 *
 * Le message de TEST de MakeTou porte de vrais nombres : `"price": 29.99`. Les
 * VRAIES ventes portent du texte : `"price": "2000"`. Le code n'acceptait que
 * des nombres, jugeait le montant introuvable, et refusait chaque vente en
 * annonçant « Montant null incompatible ».
 *
 * Le 28 août 2026 au matin, neuf personnes avaient payé et aucune n'avait reçu
 * son accès. Elles ont écrit sur WhatsApp. C'est le pire défaut possible : le
 * client a payé, la boutique a encaissé, et l'application dit non.
 */
function nombreEventuel(valeur: unknown): number | null {
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur === 'string') {
    // Espaces fines, espaces insécables et séparateurs de milliers : une somme
    // écrite « 2 000 » ou « 2,000 » reste une somme.
    const n = Number(valeur.replace(/[\s  ,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

/**
 * Le montant est-il seulement lisible ?
 *
 * Une somme absente ou illisible n'est PAS une somme fausse. Refuser sur cette
 * base revient à punir le client d'un champ que la boutique n'a pas rempli —
 * exactement ce qui s'est produit le 28 août 2026 au matin.
 */
export function montantLisible(vente: VenteMaketou): boolean {
  return montantEnFrancs(vente) !== null;
}

/** Le montant est-il exprimé dans notre monnaie, donc comparable au tarif ? */
export function montantComparable(vente: VenteMaketou): boolean {
  const devise = deviseDeLaVente(vente);
  return devise === null || devise === 'XOF';
}

export type ResultatPulse =
  | { ouvert: true; plan: PlanKey; expireLe: string; email: string }
  | {
      ouvert: false;
      motif: string;
      email?: string;
      /**
       * Vrai quand la livraison immédiate a créé le compte et crédité l'accès
       * dans la foulée.
       *
       * L'appelant en a besoin. Sans lui, il envoyait à l'acheteur l'ancienne
       * invitation « créez votre compte » DANS LA MÊME MINUTE que le message de
       * livraison, qui annonce au contraire que son compte existe déjà et qu'il
       * n'a qu'à choisir son mot de passe.
       *
       * Le 31 août 2026 à 12 h 47, Emile Zola a reçu les deux. À 13 h 21 il
       * écrivait : « je comprends pas je me suis abonné mais je ne vois pas les
       * analyses du jour ». Il n'est entré qu'à 23 h 24 — dix heures plus tard.
       */
      livree?: boolean;
    };

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
  if (montantComparable(vente) && montantLisible(vente)) {
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
        `Montant ${paye} invérifiable (devise ${deviseDeLaVente(vente) ?? 'inconnue'}), ` +
        `et le produit « ${vente.products?.[0]?.name ?? '?'} » ne nomme aucune offre.`,
    };
  } else {
    console.log(
      `[MAKETOU] Montant invérifiable (${paye}, ${deviseDeLaVente(vente) ?? 'sans devise'}) — ` +
        `offre ${plan} reconnue au nom du produit, accès ouvert.`
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

  // ── AVONS-NOUS DÉJÀ VU CETTE VENTE ? ────────────────────────────────────
  //
  // MakeTou renvoie parfois deux fois le même message. Sans cette lecture,
  // l'acheteur sans compte recevrait l'invitation autant de fois que le pulse
  // se répète — et un client qui reçoit trois fois le même courriel après
  // avoir payé conclut que quelque chose ne tourne pas rond.
  const { data: dejaEnregistree } = await admin
    .from('payment_intents')
    .select('sale_id')
    .eq('sale_id', venteId)
    .maybeSingle();
  const dejaVue = !!dejaEnregistree;

  const { error: erreurTrace } = await admin.from('payment_intents').upsert(
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

  // ── UNE ÉCRITURE QUI ÉCHOUE DOIT SE VOIR ────────────────────────────────
  //
  // Cette écriture n'était pas vérifiée. Le 28 août 2026, la vente d'un client
  // sans compte s'est perdue en silence : la colonne `user_id` refuse le vide,
  // l'écriture a échoué, et le message annonçait pourtant « la vente est
  // enregistrée ». Le pire des messages : celui qui rassure à tort.
  if (erreurTrace) {
    console.error(`[MAKETOU] Vente ${venteId} NON enregistrée : ${erreurTrace.message}`);
  }

  if (!userId) {
    /** Vrai quand la livraison a réellement ouvert l'accès dans la foulée. */
    let livree = false;

    // ── ON LUI DIT QUOI FAIRE, AU LIEU DE L'ATTENDRE ──────────────────────
    //
    // La règle du projet est qu'on crée son compte AVANT de payer, et le
    // parcours de l'application l'impose. Mais la vitrine de la boutique est
    // publique : on peut y payer par un lien partagé, sans jamais passer par
    // profootai.com. Ces ventes-là arrivent donc sans compte, et il n'y a
    // aucun moyen de l'empêcher depuis ici.
    //
    // Ce qu'on peut empêcher, c'est le silence. Le 28 août 2026 à 12 h 43,
    // quelqu'un a payé 2 000 FCFA sans compte. Le lendemain matin, le seul
    // courrier qu'il avait reçu était celui de la boutique lui demandant
    // « Comment s'est passé votre achat ? ». Il a répondu : « Je comprends
    // rien d'abord. » Vingt et une heures après son paiement, il n'avait
    // toujours pas de compte — et l'accès qui l'attendait ne pouvait pas
    // s'ouvrir.
    //
    // L'envoi ne bloque rien et n'échoue jamais bruyamment : la vente est
    // déjà enregistrée, et un service de courriel injoignable ne doit pas
    // faire échouer le traitement du pulse.
    // ── ON LIVRE, ON N INVITE PLUS ────────────────────────────────────────
    //
    // On envoyait « creez votre compte, votre acces s ouvrira ensuite ».
    // C etait demander a quelqu un qui a DEJA PAYE de faire encore une
    // demarche, et de ne pas se tromper d un caractere dans son adresse.
    // Le 29 aout 2026, deux acheteurs attendaient ainsi depuis un et deux
    // jours : aucun n avait cree son compte.
    //
    // Le compte est donc cree pour lui, l acces credite, et il ne recoit
    // qu un lien pour choisir son mot de passe — la seule chose que personne
    // ne peut faire a sa place.
    //
    // La livraison passe par la MEME fonction que l entretien quotidien :
    // une seule regle, une seule trace, et rien qui puisse diverger entre le
    // chemin immediat et le filet de rattrapage.
    // ── ET ON L'ATTEND ──────────────────────────────────────────────────
    //
    // Cette livraison était lancée avec `void`, sans être attendue, pour ne pas
    // retarder la réponse au pulse. C'était une erreur, et elle a coûté cher :
    // une fonction sans serveur est GELÉE dès que sa réponse HTTP part. Le
    // travail lancé après ne s'exécute pas.
    //
    // Mesuré le 30 août 2026 : sept livraisons tracées depuis la mise en place,
    // TOUTES venues d'un appelant qui attend le résultat — l'entretien
    // quotidien, ou la porte de service. Pas une seule n'est jamais venue du
    // pulse, alors que c'est lui qui est censé servir dans la seconde.
    //
    // Le pulse répond donc quelques secondes plus tard. La boutique s'en
    // moque ; l'acheteur, non.
    if (!erreurTrace && !dejaVue) {
      try {
        const { livrerVentesSansCompte } = await import('./livraison-sans-compte');
        const r = await livrerVentesSansCompte();
        livree = r.livrees > 0;
        console.log(
          `[MAKETOU] Livraison immédiate : ${r.livrees} accès ouvert(s). ${r.details.join(' ; ')}`
        );
      } catch (e: any) {
        // Une livraison qui échoue ne doit pas faire échouer le pulse : la
        // vente est déjà enregistrée, et l'entretien repassera dessus.
        console.warn('[MAKETOU] Livraison immédiate impossible :', e?.message);
      }
    }

    return {
      ouvert: false,
      email,
      livree,
      // ── LE MOTIF DIT CE QUI S'EST RÉELLEMENT PASSÉ ─────────────────────
      //
      // Il annonçait encore « un courriel invite l'acheteur à créer son
      // compte » — la manière de faire d'avant le 29 août, abandonnée parce
      // qu'elle laissait deux acheteurs dehors pendant deux jours. L'alerte
      // décrivait donc une action qui n'existait plus, et laissait croire
      // qu'il fallait attendre le client.
      motif: erreurTrace
        ? `Aucun compte ProFoot à cette adresse, ET la vente n'a PAS PU être enregistrée ` +
          `(${erreurTrace.message}). Elle est donc perdue : à rattraper à la main.`
        : livree
          ? `Aucun compte ProFoot à cette adresse : son compte vient d'être créé, l'accès ` +
            `est crédité, et un lien pour choisir son mot de passe lui a été envoyé.`
          : `Aucun compte ProFoot à cette adresse, et la livraison immédiate n'a rien ouvert. ` +
            `L'entretien repassera dessus, et l'acheteur sera relancé automatiquement.`,
    };
  }

  return crediterAcces(admin, userId, plan, venteId, email);
}

/**
 * Créditer un accès, une fois et une seule.
 *
 * Séparé de la lecture du message parce que deux chemins y mènent : le pulse
 * qui annonce une vente, et le rattrapage d'une vente payée avant que son
 * acheteur n'ait un compte. Un second chemin d'écriture, écrit à part,
 * finirait par diverger du premier — et c'est précisément sur l'ouverture d'un
 * accès payé qu'une divergence coûte le plus cher.
 */
async function crediterAcces(
  admin: SupabaseClient,
  userId: string,
  plan: PlanKey,
  venteId: string,
  email: string
): Promise<ResultatPulse> {
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

  // La vente est consommée, et elle porte enfin le nom de son acheteur : sans
  // ce `user_id`, une vente rattachée après coup resterait orpheline et serait
  // reprise à chaque connexion.
  await admin
    .from('payment_intents')
    .update({ consumed_at: new Date().toISOString(), user_id: userId })
    .eq('sale_id', venteId);

  console.log(`[MAKETOU] Accès ${plan} ouvert pour ${email} jusqu'au ${expireLe.slice(0, 10)}.`);
  return { ouvert: true, plan, expireLe, email };
}

/**
 * L'ACCÈS D'UNE VENTE PAYÉE AVANT QUE SON ACHETEUR N'AIT UN COMPTE.
 *
 * ── POURQUOI CE CAS EST DÉFINITIF, ET NON UN ACCIDENT ─────────────────────
 *
 * La boutique MakeTou est publique. Son adresse circule sur WhatsApp et sur
 * TikTok, et rien n'y empêche quelqu'un de payer sans être jamais passé par
 * l'application. Ce n'est pas un défaut qu'on corrigera : c'est la nature d'une
 * boutique en ligne, et il faut vivre avec.
 *
 * Le 28 août 2026, Souleymane a payé 2 000 francs ainsi. Le message annonçait
 * « l'accès s'ouvrira à l'inscription » — et c'était faux deux fois : la vente
 * n'était pas enregistrée, et le filet qui devait l'ouvrir cherchait chez
 * Chariow, dont la boutique est fermée depuis la veille.
 *
 * Cette fonction rend la promesse vraie. À la première connexion, une vente
 * payée sous la même adresse e-mail ouvre l'accès, sans que personne n'ait à
 * la réclamer.
 */
export async function rattacherVentesOrphelines(
  admin: SupabaseClient,
  userId: string,
  emailBrut: string | null | undefined,
  // Les ventes sont FOURNIES, jamais relues. L'appelant les a déjà entre les
  // mains, et ce filet s'exécute sur le chemin de chaque page : une requête de
  // plus y serait payée par les milliers de visiteurs qui n'ont rien acheté.
  orphelines: { sale_id?: string | null; plan?: string | null }[]
): Promise<(ResultatPulse & { saleId?: string }) | null> {
  const email = emailBrut?.toLowerCase().trim();
  if (!email || !orphelines?.length) return null;

  for (const vente of orphelines) {
    const plan = (Object.keys(PLANS) as PlanKey[]).find((p) => p === vente.plan);
    if (!plan || !vente.sale_id) continue;
    const r = await crediterAcces(admin, userId, plan, vente.sale_id, email);
    if (r.ouvert) {
      console.warn(
        `[MAKETOU] ${email} : vente ${vente.sale_id} rattachée à l'inscription — ` +
          `elle avait été payée sans compte.`
      );
      return { ...r, saleId: vente.sale_id ?? undefined };
    }
  }
  return null;
}
