/**
 * ÉCRIRE À CELUI QUI A PAYÉ ET QUI N'EST JAMAIS ENTRÉ.
 *
 * ── POURQUOI PRÉVENIR LE PROPRIÉTAIRE NE SUFFIT PAS ───────────────────────
 *
 * La surveillance signalait ces personnes à l'administration. C'est utile, et
 * c'est insuffisant : entre l'alerte et le message au client, il faut qu'un
 * humain lise, comprenne, retrouve l'adresse et écrive. La nuit, le week-end,
 * un jour chargé — le client attend pendant ce temps.
 *
 * Et l'attente coûte cher, on l'a mesuré. Le 30 août 2026, un acheteur a payé
 * 5 000 FCFA à 00 h 38, n'a pas réussi à entrer, et a REPAYÉ 2 000 FCFA à
 * 09 h 08. Il ne s'est pas plaint : il a payé une deuxième fois. D'autres
 * laissent un avis d'une étoile — cinq des six mauvais avis de la boutique ne
 * parlaient pas du produit, mais d'un accès qu'on n'arrivait pas à ouvrir.
 *
 * L'application écrit donc elle-même, au client, avec le lien qui le fait
 * entrer. Personne n'a besoin d'être réveillé.
 *
 * ── DEUX MESSAGES, PAS UN DE PLUS ─────────────────────────────────────────
 *
 * Un rappel au bout d'un jour, un second au bout de trois. Ensuite on s'arrête.
 *
 * Quelqu'un qui n'a pas répondu à deux messages ne répondra pas au dixième : à
 * partir de là, on n'est plus en train d'aider, on est en train de harceler
 * quelqu'un qui nous a déjà payés. Le cas reste signalé à l'administration, qui
 * peut décider d'un geste humain — un appel, un remboursement.
 *
 * ── CE QUI EST VÉRIFIÉ AVANT CHAQUE ENVOI ─────────────────────────────────
 *
 * Que l'accès est réellement actif, que la personne n'est réellement jamais
 * entrée, que l'adresse n'est pas une adresse de test, et qu'on ne lui a pas
 * déjà écrit deux fois. La trace n'est écrite QUE si le message est parti :
 * l'inverse ferait passer pour relancé quelqu'un qui n'a rien reçu.
 */

import { createAdminClient } from './supabase-admin';
import { DOMAINES_DE_TEST } from './livraison-sans-compte';

/** Le premier rappel : assez tard pour que « il dormait » soit exclu. */
const PREMIER_RAPPEL_H = 24;

/** Le second, et le dernier. */
const SECOND_RAPPEL_H = 72;

/** Jamais plus de deux messages à la même personne. */
const MAX_RELANCES = 2;

export interface BilanRelance {
  examines: number;
  relances: number;
  details: string[];
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com').replace(/\/+$/, '');
}

/**
 * Relance par courriel les abonnés actifs qui ne se sont jamais connectés.
 *
 * Ne lève jamais : elle s'exécute au milieu d'un entretien qui fait des choses
 * plus importantes qu'elle.
 */
export async function relancerAbonnesJamaisEntres(): Promise<BilanRelance> {
  const bilan: BilanRelance = { examines: 0, relances: 0, details: [] };

  const { courrielDisponible, envoyerCourriel, messageAccesCree } = await import('./courriel');
  if (!courrielDisponible()) {
    console.warn("[RELANCE] RESEND_API_KEY absente : personne n'est relancé.");
    return bilan;
  }

  const sb = createAdminClient();
  const maintenant = Date.now();

  const { data: abonnements, error } = await sb
    .from('subscriptions')
    .select('user_id, plan, status, expires_at, created_at')
    .eq('status', 'active');

  if (error) {
    console.warn('[RELANCE] Lecture des abonnements impossible :', error.message);
    return bilan;
  }

  const actifs = (abonnements ?? []).filter(
    (a) => a.expires_at && new Date(a.expires_at).getTime() > maintenant
  );
  if (!actifs.length) return bilan;

  // Les comptes, lus EN ENTIER. Une lecture partielle laisserait dehors
  // précisément les derniers arrivés — ceux qu'on cherche.
  const comptes = new Map<
    string,
    { email: string; derniereEntree: string | null }
  >();
  for (let page = 1; page <= 60; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    for (const u of data.users) {
      comptes.set(u.id, {
        email: String(u.email ?? '').toLowerCase(),
        derniereEntree: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < 200) break;
  }

  // Qui a déjà été relancé, et combien de fois.
  const { data: traces } = await sb
    .from('webhook_events')
    .select('delivery_id')
    .like('delivery_id', 'relance-%');
  const dejaRelance = new Map<string, number>();
  for (const t of traces ?? []) {
    const reste = String(t.delivery_id).slice('relance-'.length);
    const id = reste.slice(0, reste.lastIndexOf('-'));
    if (id) dejaRelance.set(id, (dejaRelance.get(id) ?? 0) + 1);
  }

  const vus = new Set<string>();
  for (const abo of actifs) {
    const userId = String(abo.user_id);
    if (vus.has(userId)) continue;

    const compte = comptes.get(userId);
    if (!compte?.email) continue;
    if (compte.derniereEntree) continue;
    if (DOMAINES_DE_TEST.test(compte.email)) continue;

    const ouvertLe = abo.created_at ? new Date(abo.created_at).getTime() : maintenant;
    const heures = Math.round((maintenant - ouvertLe) / 3_600_000);

    const envoyees = dejaRelance.get(userId) ?? 0;
    if (envoyees >= MAX_RELANCES) continue;

    // Le premier message à vingt-quatre heures, le second à soixante-douze.
    const seuil = envoyees === 0 ? PREMIER_RAPPEL_H : SECOND_RAPPEL_H;
    if (heures < seuil) continue;

    vus.add(userId);
    bilan.examines++;

    try {
      // Un lien NEUF à chaque fois : celui du premier message a pu expirer, et
      // c'est justement l'hypothèse la plus probable si la personne n'est
      // toujours pas entrée.
      const { data: lien } = await sb.auth.admin.generateLink({
        type: 'recovery',
        email: compte.email,
      });
      const jeton = lien?.properties?.hashed_token;
      const adresse = jeton
        ? `${siteUrl()}/reinitialiser-mot-de-passe?token_hash=${jeton}&type=recovery`
        : `${siteUrl()}/mot-de-passe-oublie`;

      const parti = await envoyerCourriel({
        a: compte.email,
        ...messageAccesAttend(adresse, String(abo.plan), abo.expires_at, envoyees + 1),
      });

      if (!parti) {
        bilan.details.push(`${compte.email} : MESSAGE NON ENVOYÉ`);
        continue;
      }

      bilan.relances++;
      bilan.details.push(`${compte.email} : rappel ${envoyees + 1}/${MAX_RELANCES} (${heures} h)`);

      const jour = new Date(maintenant).toISOString().slice(0, 10);
      await sb.from('webhook_events').insert({
        provider: 'relance',
        delivery_id: `relance-${userId}-${jour}-${envoyees + 1}`,
        event: 'abonne_jamais_entre_relance',
        payload: {
          email: compte.email,
          plan: abo.plan,
          depuis_heures: heures,
          rang: envoyees + 1,
        },
      });

      console.log(`[RELANCE] ${compte.email} relancé (${envoyees + 1}/${MAX_RELANCES}, ${heures} h).`);
    } catch (e: any) {
      bilan.details.push(`${compte.email} : ${e?.message ?? 'erreur inconnue'}`);
    }
  }

  return bilan;
}

/**
 * Le message de rappel.
 *
 * Il ne reproche rien et ne demande rien. Il dit trois choses : votre argent
 * est arrivé, votre accès est ouvert, voici le geste unique qui vous fait
 * entrer. Et il dit explicitement de NE PAS repayer — parce que c'est ce que
 * quelqu'un fait quand il croit que son paiement a échoué.
 */
function messageAccesAttend(
  lienMotDePasse: string,
  plan: string,
  expireLe: string | null,
  rang: number
): { sujet: string; texte: string } {
  const echeance = expireLe
    ? new Date(expireLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return {
    sujet:
      rang === 1
        ? 'Votre accès ProFoot AI vous attend — 2 étapes pour entrer'
        : 'Votre accès ProFoot AI est toujours ouvert — voici un nouveau lien',
    texte: [
      'Bonjour,',
      '',
      'Votre paiement est bien arrivé et votre accès est ouvert' +
        (echeance ? ` jusqu'au ${echeance}` : '') +
        ", mais vous ne vous êtes pas encore connecté. C'est presque toujours pour la même raison, et elle vient de nous.",
      '',
      "Nous avons créé votre compte à votre place après votre paiement. Vous n'avez donc jamais choisi de mot de passe — et sans mot de passe, on ne peut pas entrer.",
      '',
      'EN DEUX ÉTAPES',
      '',
      '1. Ouvrez ce lien et choisissez le mot de passe que vous voulez :',
      '',
      lienMotDePasse,
      '',
      '2. Vous serez connecté aussitôt, et vos analyses vous attendent.',
      '',
      "Si le lien ne fonctionne plus, allez sur profootai.com, cliquez sur « Mot de passe oublié » et saisissez cette même adresse. Cette voie-là ne périme jamais.",
      '',
      "IMPORTANT : ne créez pas un deuxième compte, et surtout ne payez pas une seconde fois. Le vôtre existe déjà et il est crédité.",
      '',
      'Répondez simplement à ce message si quoi que ce soit bloque.',
      '',
      'Ousmane',
      'ProFoot AI — profootai.com',
    ].join('\n'),
  };
}
