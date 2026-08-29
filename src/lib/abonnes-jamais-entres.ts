/**
 * CEUX QUI ONT PAYÉ, DONT L'ACCÈS EST OUVERT, ET QUI NE SONT JAMAIS ENTRÉS.
 *
 * ── CE QUE CETTE ALERTE AURAIT ÉVITÉ ──────────────────────────────────────
 *
 * Le 29 août 2026, un client a filmé son téléphone pour montrer qu'il n'entrait
 * pas. Il avait payé, son abonnement était actif, et l'application le renvoyait
 * en boucle entre la connexion et l'inscription — il n'avait pas de mot de
 * passe, parce que c'est nous qui avions créé son compte.
 *
 * On ne l'a su que parce qu'il a pris la peine de filmer. C'est là le vrai
 * danger : celui qui ne prévient pas ne devient jamais un problème visible. Il
 * pose un avis d'une étoile, ou il se tait, et dans les deux cas on ne corrige
 * rien.
 *
 * ── LE SIGNAL, ET POURQUOI CELUI-LÀ ───────────────────────────────────────
 *
 * Un abonnement actif sur un compte qui ne s'est JAMAIS connecté. C'est une
 * contradiction : personne ne paie pour ne pas entrer.
 *
 * Le soir où on l'a mesuré pour la première fois, il valait exactement trois —
 * et ces trois-là étaient précisément les personnes bloquées, dont celle qui
 * avait filmé. Un signal qui ne se trompe pas de cible.
 *
 * ── POURQUOI ON ATTEND VINGT-QUATRE HEURES ────────────────────────────────
 *
 * Quelqu'un qui paie à 23 h et se connecte le lendemain matin n'est pas
 * bloqué : il dormait. Alerter tout de suite ferait sonner l'alarme pour tout
 * le monde, et une alarme qui sonne toujours ne se lit plus.
 *
 * ── POURQUOI ON NE RÉPÈTE PAS TOUS LES JOURS ──────────────────────────────
 *
 * Une même personne peut rester bloquée une semaine. Redire son nom chaque
 * matin userait l'alerte jusqu'à ce qu'on cesse de l'ouvrir — et le jour où
 * elle porterait un nom nouveau, il passerait inaperçu. Chacun n'est donc
 * signalé qu'une fois, puis rappelé au bout de sept jours s'il n'est toujours
 * pas entré.
 */

import { createAdminClient } from './supabase-admin';
import { DOMAINES_DE_TEST } from './livraison-sans-compte';

/** En deçà, la personne dort peut-être encore. */
const SEUIL_HEURES = 24;

/** Au-delà, on redit le même nom : il est toujours dehors. */
const RAPPEL_JOURS = 7;

export interface Bloque {
  email: string;
  userId: string;
  plan: string;
  depuisHeures: number;
  origine: string;
}

export interface BilanBlocages {
  /** Tous ceux qui sont dans ce cas, qu'ils aient déjà été signalés ou non. */
  bloques: Bloque[];
  /** Ceux dont c'est le premier signalement, ou dont le rappel est dû. */
  aSignaler: Bloque[];
  alerteEnvoyee: boolean;
}

/**
 * Relève les abonnés actifs qui ne se sont jamais connectés, et prévient
 * l'administration des nouveaux cas.
 *
 * Ne lève jamais : c'est une surveillance, elle ne doit pas faire échouer
 * l'entretien qui l'appelle.
 */
export async function signalerAbonnesJamaisEntres(): Promise<BilanBlocages> {
  const bilan: BilanBlocages = { bloques: [], aSignaler: [], alerteEnvoyee: false };
  const sb = createAdminClient();
  const maintenant = Date.now();

  const { data: abonnements, error } = await sb
    .from('subscriptions')
    .select('user_id, plan, status, expires_at, created_at')
    .eq('status', 'active');

  if (error) {
    console.warn('[BLOCAGES] Lecture des abonnements impossible :', error.message);
    return bilan;
  }

  const actifs = (abonnements ?? []).filter(
    (a) => a.expires_at && new Date(a.expires_at).getTime() > maintenant
  );
  if (!actifs.length) return bilan;

  // Les comptes, lus EN ENTIER. Une lecture partielle laisserait dehors
  // précisément les comptes créés en dernier — ceux qu'on cherche, puisque le
  // blocage frappe d'abord les arrivants.
  const comptes = new Map<string, { email: string; derniereEntree: string | null; origine: string }>();
  for (let page = 1; page <= 60; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    for (const u of data.users) {
      comptes.set(u.id, {
        email: String(u.email ?? '').toLowerCase(),
        derniereEntree: u.last_sign_in_at ?? null,
        origine: String((u.user_metadata as any)?.origine_compte ?? 'inscription'),
      });
    }
    if (data.users.length < 200) break;
  }

  const vus = new Set<string>();
  for (const abo of actifs) {
    const compte = comptes.get(String(abo.user_id));
    if (!compte || !compte.email) continue;
    if (compte.derniereEntree) continue;
    if (DOMAINES_DE_TEST.test(compte.email)) continue;
    if (vus.has(String(abo.user_id))) continue;

    const ouvertLe = abo.created_at ? new Date(abo.created_at).getTime() : maintenant;
    const heures = Math.round((maintenant - ouvertLe) / 3_600_000);
    if (heures < SEUIL_HEURES) continue;

    vus.add(String(abo.user_id));
    bilan.bloques.push({
      email: compte.email,
      userId: String(abo.user_id),
      plan: String(abo.plan ?? '?'),
      depuisHeures: heures,
      origine: compte.origine,
    });
  }

  if (!bilan.bloques.length) return bilan;
  bilan.bloques.sort((a, b) => b.depuisHeures - a.depuisHeures);

  // ── QUI A DÉJÀ ÉTÉ SIGNALÉ, ET QUAND ────────────────────────────────────
  const { data: traces } = await sb
    .from('webhook_events')
    .select('delivery_id, received_at')
    .like('delivery_id', 'jamais-entre-%');

  const dernierSignalement = new Map<string, number>();
  for (const t of traces ?? []) {
    // `jamais-entre-<userId>-<jour>` : l'identifiant est tout ce qui suit le
    // préfixe et précède la date.
    const reste = String(t.delivery_id).slice('jamais-entre-'.length);
    const id = reste.slice(0, reste.lastIndexOf('-'));
    const quand = new Date(String(t.received_at)).getTime();
    if (!id) continue;
    if (!dernierSignalement.has(id) || quand > (dernierSignalement.get(id) as number)) {
      dernierSignalement.set(id, quand);
    }
  }

  const limiteRappel = maintenant - RAPPEL_JOURS * 86_400_000;
  bilan.aSignaler = bilan.bloques.filter((b) => {
    const dernier = dernierSignalement.get(b.userId);
    return !dernier || dernier < limiteRappel;
  });

  if (!bilan.aSignaler.length) return bilan;

  // ── L'ALERTE ────────────────────────────────────────────────────────────
  const { courrielDisponible, envoyerCourriel, ADRESSE_ALERTES } = await import('./courriel');
  if (courrielDisponible()) {
    const lignes = bilan.aSignaler.map(
      (b) =>
        `  • ${b.email} — ${b.plan}, accès ouvert depuis ${b.depuisHeures} h` +
        (b.origine === 'livraison_vente_sans_compte' ? ' (compte créé par nous après son paiement)' : '')
    );

    bilan.alerteEnvoyee = await envoyerCourriel({
      a: ADRESSE_ALERTES,
      sujet: `${bilan.aSignaler.length} client(s) ont payé et ne sont jamais entrés`,
      texte: [
        `${bilan.aSignaler.length} personne(s) ont un abonnement actif et ne se sont`,
        'JAMAIS connectées. Elles ont payé, leur accès est ouvert, et elles ne',
        "l'utilisent pas.",
        '',
        ...lignes,
        '',
        'CE QUE ÇA VEUT PROBABLEMENT DIRE',
        '',
        "Celles dont nous avons créé le compte n'ont jamais choisi de mot de passe.",
        "Si le message contenant le lien s'est perdu — boîte indésirable, lien",
        'expiré — elles ne peuvent pas entrer et ne le diront pas forcément.',
        '',
        'QUOI FAIRE',
        '',
        "Écrivez-leur, ou demandez-leur d'aller sur profootai.com et de cliquer sur",
        '« Mot de passe oublié » avec cette adresse. Le lien qu\'elles recevront',
        'les fera entrer.',
        '',
        `Chaque nom n'est signalé qu'une fois, puis rappelé au bout de ${RAPPEL_JOURS} jours`,
        "s'il n'est toujours pas entré.",
        '',
        'ProFoot AI — surveillance automatique',
      ].join('\n'),
    });
  } else {
    console.warn("[BLOCAGES] RESEND_API_KEY absente : l'alerte n'est pas partie.");
  }

  // La trace n'est écrite que si l'alerte est réellement partie. Sinon le cas
  // serait considéré comme signalé alors que personne n'a rien reçu — et il ne
  // reviendrait qu'au rappel, sept jours plus tard.
  if (bilan.alerteEnvoyee) {
    const jour = new Date(maintenant).toISOString().slice(0, 10);
    for (const b of bilan.aSignaler) {
      await sb.from('webhook_events').insert({
        provider: 'surveillance',
        delivery_id: `jamais-entre-${b.userId}-${jour}`,
        event: 'abonne_jamais_connecte',
        payload: {
          email: b.email,
          plan: b.plan,
          depuis_heures: b.depuisHeures,
          origine_compte: b.origine,
        },
      });
    }
  }

  console.log(
    `[BLOCAGES] ${bilan.bloques.length} abonné(s) jamais connecté(s), ` +
      `${bilan.aSignaler.length} signalé(s)${bilan.alerteEnvoyee ? '' : ' — ALERTE NON PARTIE'}.`
  );

  return bilan;
}
