/**
 * LIVRER À CELUI QUI A PAYÉ SANS COMPTE, AU LIEU DE L'ATTENDRE.
 *
 * ── CE QUI NE MARCHAIT PAS ────────────────────────────────────────────────
 *
 * La vitrine de la boutique est publique : on peut y payer par un lien
 * partagé, sans jamais passer par profootai.com. Ces ventes arrivent alors
 * sans compte à qui les rattacher.
 *
 * La réponse était un courriel : « créez votre compte, votre accès s'ouvrira
 * ensuite ». C'était demander à quelqu'un qui a DÉJÀ PAYÉ de faire encore une
 * démarche — et de ne pas se tromper d'un caractère dans son adresse, sans
 * quoi rien ne le retrouve. Le 29 août 2026, deux acheteurs attendaient ainsi
 * depuis un et deux jours. Aucun n'avait créé son compte.
 *
 * Une solution qui dépend d'un geste du client n'est pas une solution : c'est
 * un report du problème sur celui qui a payé.
 *
 * ── CE QU'ON FAIT MAINTENANT ──────────────────────────────────────────────
 *
 * On crée le compte à sa place, on crédite l'accès, et on lui envoie un lien
 * pour choisir son mot de passe — la seule chose que personne ne peut faire
 * pour lui. Il ouvre son courrier, clique, entre. Rien à comprendre.
 *
 * ── CE QUI EST VÉRIFIÉ AVANT CHAQUE CRÉATION ──────────────────────────────
 *
 * Que la vente est bien encaissée, que l'adresse n'a pas déjà de compte, et
 * qu'on n'a pas déjà livré cette vente. Un compte créé en double, ou un accès
 * crédité deux fois, coûte plus cher que l'attente qu'on supprime.
 */

import { createAdminClient } from './supabase-admin';
import { PLANS, type PlanKey } from './subscription';

/** Au-delà, on ne livre plus automatiquement : la vente est trop ancienne. */
const FENETRE_JOURS = 45;

/** Jamais plus que ça en une passe : une livraison n'est pas un envoi de masse. */
const MAX_PAR_PASSE = 20;

export interface BilanLivraison {
  examinees: number;
  livrees: number;
  dejaLivrees: number;
  comptesExistants: number;
  echecs: number;
  details: string[];
}

/** L'adresse du site, pour bâtir le lien de mot de passe. */
function siteUrl(): string {
  const brut = process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com';
  return brut.replace(/\/+$/, '');
}

/**
 * Crée le compte, crédite l'accès et envoie le lien, pour chaque vente payée
 * restée sans compte.
 *
 * Ne lève jamais : cette étape s'exécute au milieu d'un entretien qui fait des
 * choses plus importantes qu'elle.
 */
export async function livrerVentesSansCompte(): Promise<BilanLivraison> {
  const bilan: BilanLivraison = {
    examinees: 0,
    livrees: 0,
    dejaLivrees: 0,
    comptesExistants: 0,
    echecs: 0,
    details: [],
  };

  const { courrielDisponible, envoyerCourriel, messageAccesCree } = await import('./courriel');
  if (!courrielDisponible()) {
    console.warn('[LIVRAISON] RESEND_API_KEY absente : on ne crée aucun compte sans pouvoir prévenir.');
    return bilan;
  }

  const sb = createAdminClient();
  const depuis = new Date(Date.now() - FENETRE_JOURS * 24 * 3600 * 1000).toISOString();

  const { data: ventes, error } = await sb
    .from('payment_intents')
    .select('sale_id, email, plan, created_at, user_id')
    .in('statut_boutique', ['completed', 'settled'])
    .is('user_id', null)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('[LIVRAISON] Lecture impossible :', error.message);
    return bilan;
  }

  // Les adresses déjà connues, lues UNE FOIS et en entier : près de six mille
  // comptes, et une lecture partielle ferait créer un doublon à quelqu'un qui
  // possède déjà son compte.
  const adressesConnues = new Set<string>();
  for (let page = 1; page <= 60; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    for (const u of data.users) adressesConnues.add(String(u.email ?? '').toLowerCase());
    if (data.users.length < 200) break;
  }

  for (const vente of ventes ?? []) {
    if (bilan.livrees >= MAX_PAR_PASSE) break;

    const sale = String(vente.sale_id ?? '');
    const email = String(vente.email ?? '').trim().toLowerCase();
    if (!email || /^(verif|diagnostic)/i.test(sale) || email.endsWith('@profootai.com')) continue;

    const plan = String(vente.plan ?? '') as PlanKey;
    const config = PLANS[plan];
    if (!config) continue;

    bilan.examinees++;

    if (adressesConnues.has(email)) {
      // Le compte existe : ce n'est pas à nous de le créer, et le filet
      // d'ouverture automatique s'en charge à sa prochaine connexion.
      bilan.comptesExistants++;
      continue;
    }

    const reference = `livraison-${sale}`;
    const { data: deja } = await sb
      .from('webhook_events')
      .select('id')
      .eq('delivery_id', reference)
      .limit(1);
    if (deja?.length) {
      bilan.dejaLivrees++;
      continue;
    }

    try {
      // ── 1. LE COMPTE ────────────────────────────────────────────────────
      //
      // Adresse confirmée d'office : elle vient d'un paiement encaissé, c'est
      // une preuve plus forte qu'un clic dans un courriel. Le mot de passe est
      // tiré au hasard et n'est communiqué à personne — la personne choisira
      // le sien par le lien.
      const motDePasse = `Pf${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2).toUpperCase()}!9`;
      const { data: cree, error: erreurCompte } = await sb.auth.admin.createUser({
        email,
        password: motDePasse,
        email_confirm: true,
        user_metadata: { origine_compte: 'livraison_vente_sans_compte', vente: sale },
      });

      if (erreurCompte || !cree?.user) {
        bilan.echecs++;
        bilan.details.push(`${email} : compte non créé (${erreurCompte?.message ?? 'inconnu'})`);
        continue;
      }
      const userId = cree.user.id;

      // ── 2. L'ACCÈS ──────────────────────────────────────────────────────
      //
      // Même forme que le crédit du pulse : la contrainte d'unicité porte sur
      // la référence de vente, donc une seconde tentative ne peut pas offrir
      // un second abonnement.
      const expireLe = new Date(Date.now() + config.durationDays * 86_400_000).toISOString();
      const { error: erreurAbo } = await sb.from('subscriptions').upsert(
        {
          user_id: userId,
          plan,
          status: 'active',
          provider: 'maketou',
          chariow_sale_id: sale,
          amount: config.amountXof,
          currency: 'XOF',
          expires_at: expireLe,
        },
        { onConflict: 'chariow_sale_id', ignoreDuplicates: true }
      );

      if (erreurAbo) {
        bilan.echecs++;
        bilan.details.push(`${email} : compte créé mais accès NON crédité (${erreurAbo.message})`);
        continue;
      }

      // La vente porte désormais son acheteur : le prochain balayage ne la
      // comptera plus comme perdue.
      await sb.from('payment_intents').update({ user_id: userId }).eq('sale_id', sale);

      // ── 3. LE LIEN ──────────────────────────────────────────────────────
      //
      // La page de réinitialisation attend un `token_hash`. On bâtit donc
      // l'adresse nous-mêmes plutôt que d'employer le lien tout fait de
      // Supabase, qui passe par une redirection que Gmail consomme parfois
      // avant la personne.
      const { data: lien, error: erreurLien } = await sb.auth.admin.generateLink({
        type: 'recovery',
        email,
      });

      const jeton = lien?.properties?.hashed_token;
      const adresse = jeton
        ? `${siteUrl()}/reinitialiser-mot-de-passe?token_hash=${jeton}&type=recovery`
        : `${siteUrl()}/mot-de-passe-oublie`;

      if (erreurLien || !jeton) {
        console.warn(`[LIVRAISON] Lien non généré pour ${email} :`, erreurLien?.message);
      }

      // ── 4. LE MESSAGE ───────────────────────────────────────────────────
      const parti = await envoyerCourriel({
        a: email,
        ...messageAccesCree(adresse, config.label, expireLe),
      });

      bilan.livrees++;
      bilan.details.push(
        `${email} : ${config.label} jusqu'au ${expireLe.slice(0, 10)}` +
          (parti ? ', message envoyé' : ', MESSAGE NON ENVOYÉ')
      );

      await sb.from('webhook_events').insert({
        provider: 'livraison',
        delivery_id: reference,
        event: 'compte_cree_et_acces_ouvert',
        payload: {
          email,
          plan,
          user_id: userId,
          expire_le: expireLe,
          courriel_envoye: parti,
          livre_le: new Date().toISOString(),
        },
      });

      console.log(`[LIVRAISON] ${email} : compte créé, ${plan} crédité jusqu'au ${expireLe.slice(0, 10)}.`);
    } catch (e: any) {
      bilan.echecs++;
      bilan.details.push(`${email} : ${e?.message ?? 'erreur inconnue'}`);
    }
  }

  return bilan;
}
