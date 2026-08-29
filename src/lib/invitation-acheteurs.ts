/**
 * CELUI QUI A PAYÉ SANS COMPTE NE DOIT PAS ATTENDRE EN SILENCE.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * La vitrine de la boutique est publique : on peut y payer par un lien
 * partagé, sans jamais passer par profootai.com. Ces ventes arrivent donc
 * parfois sans compte à qui les rattacher. L'accès est réservé et s'ouvrira à
 * l'inscription — encore faut-il que la personne sache qu'elle doit
 * s'inscrire.
 *
 * Le 28 août 2026 à 12 h 43, quelqu'un paie 2 000 FCFA. Le lendemain matin, le
 * seul courrier qu'il a reçu est celui de la boutique lui demandant « Comment
 * s'est passé votre achat ? ». Il répond : « Je comprends rien d'abord. »
 * Vingt et une heures après son paiement, il n'avait toujours pas de compte.
 *
 * ── POURQUOI UN RATTRAPAGE, ALORS QUE LE PULSE INVITE DÉJÀ ────────────────
 *
 * Le pulse envoie l'invitation au moment où la vente arrive. Il ne peut rien
 * pour les ventes déjà traitées avant qu'il sache le faire, ni pour celles où
 * l'envoi a échoué — service de courriel injoignable, clé absente ce jour-là.
 *
 * Un filet qui ne rattrape que ce qui tombe pendant qu'il est tendu n'est pas
 * un filet. Celui-ci repasse chaque jour sur les ventes récentes.
 *
 * ── DEUX GARDES, ET ELLES COMPTENT AUTANT QUE L'ENVOI ─────────────────────
 *
 * On n'écrit jamais deux fois à la même personne pour la même vente : la trace
 * vit dans `webhook_events`, et elle est consultée avant chaque envoi. Écrire
 * trois fois « créez votre compte » à quelqu'un qui a déjà payé le ferait
 * fuir plus sûrement que le silence.
 *
 * Et l'on s'arrête aux ventes récentes. Relancer quelqu'un sur un paiement de
 * six semaines, c'est rouvrir une plaie qu'il a peut-être oubliée — ou pire,
 * lui rappeler qu'il a payé pour rien.
 */

import { createAdminClient } from './supabase-admin';

/** Au-delà, on ne relance plus : la vente est trop ancienne. */
const FENETRE_JOURS = 45;

/** Jamais plus que ça en une passe, pour ne pas transformer un rattrapage en envoi de masse. */
const MAX_PAR_PASSE = 25;

export interface BilanInvitations {
  examines: number;
  invites: number;
  dejaInvites: number;
  inscritsEntreTemps: number;
  echecs: number;
}

/**
 * Écrit à tous ceux qui ont payé, n'ont pas de compte, et n'ont jamais été
 * invités.
 *
 * Ne lève jamais : cette étape s'exécute au milieu d'un entretien qui fait des
 * choses plus importantes qu'elle.
 */
export async function inviterAcheteursSansCompte(): Promise<BilanInvitations> {
  const bilan: BilanInvitations = {
    examines: 0,
    invites: 0,
    dejaInvites: 0,
    inscritsEntreTemps: 0,
    echecs: 0,
  };

  const { courrielDisponible, envoyerCourriel, messageCompteAcreer } = await import('./courriel');
  if (!courrielDisponible()) {
    console.warn('[INVITATIONS] RESEND_API_KEY absente : aucune invitation ne peut partir.');
    return bilan;
  }

  const sb = createAdminClient();
  const depuis = new Date(Date.now() - FENETRE_JOURS * 24 * 3600 * 1000).toISOString();

  // Les ventes réellement encaissées, sans compte rattaché.
  const { data: ventes, error } = await sb
    .from('payment_intents')
    .select('sale_id, email, plan, created_at, statut_boutique, user_id')
    .in('statut_boutique', ['completed', 'settled'])
    .is('user_id', null)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('[INVITATIONS] Lecture impossible :', error.message);
    return bilan;
  }

  const { PLANS } = await import('./subscription');

  // ── LES ADRESSES CONNUES, LUES UNE SEULE FOIS ET EN ENTIER ──────────────
  //
  // Une première version relisait les comptes à chaque vente, et seulement les
  // mille premiers. Il y en a près de six mille : quelqu'un inscrit au-delà de
  // la millième page aurait été tenu pour inexistant, et aurait reçu une
  // invitation à créer un compte qu'il possède déjà. Le pire des courriels —
  // celui qui fait douter quelqu'un de ce qu'il a sous les yeux.
  const adressesConnues = new Set<string>();
  for (let page = 1; page <= 60; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    for (const u of data.users) adressesConnues.add(String(u.email ?? '').toLowerCase());
    if (data.users.length < 200) break;
  }

  for (const vente of ventes ?? []) {
    if (bilan.invites >= MAX_PAR_PASSE) break;

    const sale = String(vente.sale_id ?? '');
    const email = String(vente.email ?? '').trim().toLowerCase();
    // Les vérifications techniques portent une référence reconnaissable :
    // écrire à « diagnostic@profootai.com » ne sert personne.
    if (!email || /^(verif|diagnostic)/i.test(sale) || email.endsWith('@profootai.com')) continue;

    bilan.examines++;

    // ── S'EST-IL INSCRIT DEPUIS ? ─────────────────────────────────────────
    //
    // Alors le filet d'ouverture automatique s'en occupe, et l'inviter à
    // créer un compte qu'il possède déjà serait absurde.
    if (adressesConnues.has(email)) {
      bilan.inscritsEntreTemps++;
      continue;
    }

    // ── LUI A-T-ON DÉJÀ ÉCRIT POUR CETTE VENTE ? ──────────────────────────
    const reference = `invitation-${sale}`;
    const { data: deja } = await sb
      .from('webhook_events')
      .select('id')
      .eq('delivery_id', reference)
      .limit(1);
    if (deja?.length) {
      bilan.dejaInvites++;
      continue;
    }

    const cle = String(vente.plan ?? '') as keyof typeof PLANS;
    const libelle = PLANS[cle]?.label ?? 'votre abonnement';

    const parti = await envoyerCourriel({ a: email, ...messageCompteAcreer(email, libelle) });
    if (!parti) {
      // On n'écrit pas la trace : la prochaine passe réessaiera. Une trace
      // posée sur un envoi manqué condamnerait la personne au silence.
      bilan.echecs++;
      continue;
    }

    bilan.invites++;
    await sb.from('webhook_events').insert({
      provider: 'invitation',
      delivery_id: reference,
      event: 'invitation_creation_compte',
      payload: {
        email,
        plan: vente.plan,
        vente_du: vente.created_at,
        envoye_le: new Date().toISOString(),
      },
    });

    console.log(`[INVITATIONS] Invitation envoyée à ${email} pour la vente ${sale}.`);
  }

  return bilan;
}
