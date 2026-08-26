/**
 * Pourquoi les paiements n'aboutissent pas.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Sur sept jours, 3 demandes de paiement sur 54 ont abouti. On voyait le
 * chiffre, on ne voyait pas la cause — et sans la cause, il n'y a rien à
 * corriger, seulement des hypothèses.
 *
 * La boutique, elle, sait : chaque vente porte son statut et, quand le client a
 * réellement tenté de payer, le motif exact du refus. Le premier relevé manuel
 * a montré deux choses qu'aucune supposition n'aurait données — trois quarts
 * des personnes repartent sans même choisir un moyen de paiement, et la
 * première cause d'échec réel est le solde insuffisant, pas un défaut technique.
 *
 * Les relevés sont conservés en base. Interroger la boutique à chaque ouverture
 * de la page coûterait une cinquantaine d'appels réseau par affichage.
 */

import { createAdminClient } from './supabase-admin';

const CHARIOW = 'https://api.chariow.com/v1';

/**
 * Ce que disent les codes du prestataire, en français.
 *
 * Le libellé importe : « CUSTOMER_DO_NOT_AUTHORIZE_PAYMENT » ne se lit pas d'un
 * coup d'œil, et un tableau qu'on ne lit pas ne sert à rien.
 */
const CAUSES: Record<string, { libelle: string; explication: string }> = {
  INSUFFICIENT_BALANCE: {
    libelle: 'Solde insuffisant',
    explication: "Le client n'avait pas assez d'argent sur son compte au moment de payer.",
  },
  CUSTOMER_CANCEL_TRANSACTION: {
    libelle: 'Annulé par le client',
    explication: "Il a lui-même interrompu le paiement après l'avoir lancé.",
  },
  CUSTOMER_DO_NOT_AUTHORIZE_PAYMENT: {
    libelle: 'Non validé par le client',
    explication: "La demande a été envoyée sur son téléphone, il ne l'a jamais confirmée.",
  },
  UNSPECIFIED_FAILURE: {
    libelle: 'Échec sans motif',
    explication:
      "Le prestataire ne dit pas pourquoi. C'est le seul cas qui puisse cacher un vrai problème technique.",
  },
  EXPIRED: {
    libelle: 'Demande expirée',
    explication: "Le client a mis trop de temps : la demande de paiement s'est périmée.",
  },
};

/** Statuts de vente, tels que le prestataire les nomme. */
const STATUTS: Record<string, { libelle: string; explication: string }> = {
  abandoned: {
    libelle: 'Reparti sans essayer',
    explication:
      "La page de paiement s'est ouverte, aucun moyen de paiement n'a été choisi. Rien n'a échoué : la personne a renoncé avant.",
  },
  failed: { libelle: 'Paiement refusé', explication: 'Le paiement a été tenté et rejeté.' },
  completed: { libelle: 'Payé', explication: 'Le paiement est passé.' },
  settled: { libelle: 'Payé et reversé', explication: 'Le paiement est passé et vous a été reversé.' },
  pending: { libelle: 'En cours', explication: 'Le paiement est engagé, la réponse se fait attendre.' },
};

export const libelleCausePaiement = (code: string | null | undefined) =>
  code ? CAUSES[code]?.libelle ?? code : null;
export const explicationCausePaiement = (code: string | null | undefined) =>
  code ? CAUSES[code]?.explication ?? '' : '';
export const libelleStatutVente = (s: string | null | undefined) =>
  s ? STATUTS[s]?.libelle ?? s : 'Inconnu';
export const explicationStatutVente = (s: string | null | undefined) =>
  s ? STATUTS[s]?.explication ?? '' : '';

/**
 * Relève auprès de la boutique le sort des demandes de paiement.
 *
 * Ne réinterroge pas ce qui est déjà réglé : une vente payée ne changera plus.
 * Les demandes jamais relevées passent en premier.
 */
export async function rafraichirStatutsPaiement(limite = 40): Promise<{
  releves: number;
  echecs: number;
  /** Renseigné quand le relevé n a pas pu se faire du tout. */
  erreur?: string;
}> {
  const cle = process.env.CHARIOW_API_KEY;
  if (!cle) return { releves: 0, echecs: 0, erreur: "La clé de la boutique n'est pas configurée." };

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('payment_intents')
    .select('sale_id, releve_le, statut_boutique')
    // Une vente honorée est définitive : inutile d'y revenir.
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('[PAIEMENTS] Relevé impossible :', error.message);
    return { releves: 0, echecs: 0, erreur: error.message };
  }

  // Jamais relevées d'abord ; puis celles dont le sort peut encore changer.
  const aRelever = (data ?? [])
    .filter((i: any) => !i.releve_le || !['completed', 'settled', 'abandoned', 'failed'].includes(i.statut_boutique))
    .slice(0, limite);

  let releves = 0;
  let echecs = 0;

  for (const intention of aRelever) {
    try {
      const r = await fetch(`${CHARIOW}/sales/${intention.sale_id}`, {
        headers: { Authorization: `Bearer ${cle}`, Accept: 'application/json' },
      });
      const v = (await r.json())?.data;
      if (!v) continue;

      const erreur = v.payment?.failure_error;
      const moyen = v.payment?.method;

      const { error: err } = await sb
        .from('payment_intents')
        .update({
          statut_boutique: v.status ?? null,
          cause_echec: erreur?.code ?? null,
          message_echec: erreur?.customer_message ?? erreur?.message ?? null,
          // ── LA BOUTIQUE ÉCRIT `name`, PAS `label` NI `value` ────────────
          //
          // Relevé le 26 août 2026 sur des ventes togolaises réelles, la
          // boutique renvoie :
          //
          //     "method": { "name": "Mixx by Yas", "icon_url": "…" }
          //
          // On ne lisait que `label` et `value`, qui n'existent pas : le moyen
          // de paiement restait donc vide sur TOUTES les ventes, y compris
          // celles qui avaient parfaitement abouti. On ne pouvait pas répondre
          // à la question la plus simple qui soit — « par quel moyen les gens
          // paient-ils, et lequel échoue ? » — alors que la réponse arrivait
          // dans la réponse à chaque appel.
          //
          // `label` et `value` sont conservés : ils ne coûtent rien et
          // couvriraient un changement de format côté boutique.
          moyen_paiement:
            typeof moyen === 'string'
              ? moyen
              : moyen?.name ?? moyen?.label ?? moyen?.value ?? null,
          releve_le: new Date().toISOString(),
        })
        .eq('sale_id', intention.sale_id);

      if (!err) {
        releves++;
        if (erreur?.code) echecs++;
      }
    } catch {
      // Un relevé raté sera repris au passage suivant : il n'y a rien d'urgent.
    }
  }

  if (releves) console.log(`[PAIEMENTS] ${releves} vente(s) relevée(s), ${echecs} avec un motif d'échec.`);
  return { releves, echecs };
}

/**
 * Les clients qui ont payé sans rien recevoir.
 *
 * C'est la seule question de paiement qui mérite une alerte. Le taux
 * d'aboutissement, lui, est un chiffre commercial : quand quarante personnes
 * sur cinquante-quatre repartent sans même choisir un moyen de paiement,
 * aucune correction de code n'y changera rien, et une alerte qui se rallume à
 * chaque passage sans qu'on puisse l'éteindre apprend surtout à ne plus lire
 * l'audit.
 *
 * Deux façons de ne rien recevoir après avoir payé :
 *   — la boutique dit « payé », la notification n'est jamais arrivée
 *     (l'intention n'est pas consommée) ;
 *   — la notification est arrivée, mais aucun abonnement n'en est sorti.
 * La seconde se voit sans réseau ; la première demande d'interroger la
 * boutique, d'où le plafond d'appels.
 */
export async function clientsLeses(
  jours = 7,
  plafondAppels = 60
): Promise<{
  leses: { email: string | null; userId: string | null; saleId: string; raison: string }[];
  ventesPayees: number;
  demandes: number;
  /** Vrai quand le plafond a empêché d'examiner toutes les demandes. */
  examenPartiel: boolean;
}> {
  const sb = createAdminClient();
  const vide = { leses: [], ventesPayees: 0, demandes: 0, examenPartiel: false };

  const champs = 'sale_id, user_id, email, consumed_at, created_at, match_key';
  const depuis = new Date(Date.now() - jours * 86400000).toISOString();

  // Le statut déjà relevé évite un appel réseau. La colonne peut ne pas exister
  // si la migration n'a pas encore été appliquée : on retombe alors sur le
  // relevé en direct plutôt que d'abandonner la vérification.
  let { data, error } = await sb
    .from('payment_intents')
    .select(`${champs}, statut_boutique`)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    ({ data, error } = await sb
      .from('payment_intents')
      .select(champs)
      .gte('created_at', depuis)
      .order('created_at', { ascending: false })
      .limit(200) as any);
  }

  if (error || !data?.length) return vide;

  const cle = process.env.CHARIOW_API_KEY;
  const leses: { email: string | null; userId: string | null; saleId: string; raison: string }[] = [];
  let ventesPayees = 0;
  let appels = 0;
  let examenPartiel = false;

  for (const i of data as any[]) {
    let payee = !!i.consumed_at;

    // Une intention non consommée n'est pas forcément un impayé : la
    // notification a pu se perdre. Seule la boutique le sait.
    if (!payee && cle) {
      let statut: string | null = i.statut_boutique ?? null;

      if (!statut) {
        if (appels >= plafondAppels) {
          examenPartiel = true;
          continue;
        }
        appels++;
        try {
          const r = await fetch(`${CHARIOW}/sales/${i.sale_id}`, {
            headers: { Authorization: `Bearer ${cle}`, Accept: 'application/json' },
          });
          statut = (await r.json())?.data?.status ?? null;
        } catch {
          // Boutique injoignable : on ne conclut pas à un client lésé.
          continue;
        }
      }

      if (statut === 'completed' || statut === 'settled') {
        ventesPayees++;
        leses.push({
          email: i.email ?? null,
          userId: i.user_id ?? null,
          saleId: i.sale_id,
          raison: "payé chez la boutique, la notification n'est jamais arrivée",
        });
      }
      continue;
    }

    if (!payee) continue;
    ventesPayees++;

    // ── UN MATCH ACHETÉ À L'UNITÉ N'EST PAS UN ABONNEMENT ────────────────────
    //
    // Sans cette distinction, chaque vente à l'unité était signalée comme un
    // client lésé : le contrôle cherchait un abonnement, alors que cet achat
    // est honoré par une ligne dans `matchs_debloques`. La toute première vente
    // l'a déclenché — un client parfaitement servi, annoncé comme volé.
    //
    // Une alerte qui se déclenche à chaque vente réussie finit ignorée, et
    // c'est précisément celle qui doit attraper les vrais cas.
    if (i.match_key) {
      const { data: debloque } = await sb
        .from('matchs_debloques')
        .select('id')
        .eq('user_id', i.user_id)
        .eq('match_key', i.match_key)
        .limit(1);

      if ((debloque?.length ?? 0) === 0) {
        leses.push({
          email: i.email ?? null,
          userId: i.user_id ?? null,
          saleId: i.sale_id,
          raison: 'match payé mais jamais débloqué',
        });
      }
      continue;
    }

    if (!i.user_id) {
      leses.push({
        email: i.email ?? null,
        userId: null,
        saleId: i.sale_id,
        raison: 'paiement encaissé sans compte rattaché',
      });
      continue;
    }

    const { data: abos, error: erreurAbo } = await sb
      .from('subscriptions')
      .select('status')
      .eq('user_id', i.user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    // NE JAMAIS CONFONDRE « PAS D'ABONNEMENT » AVEC « JE N'AI PAS PU LIRE ».
    //
    // Une lecture qui échoue rendait `abos` indéfini, et le code en concluait
    // qu'aucun abonnement n'existait : l'alerte la plus grave du système — « un
    // client a payé sans rien recevoir » — se déclenchait sur un simple hoquet
    // réseau. Une alerte qui crie au vol pour une lecture ratée finit ignorée le
    // jour où le vol est réel.
    if (erreurAbo) {
      examenPartiel = true;
      continue;
    }

    const statut = (abos as any[])?.[0]?.status;
    if (statut !== 'active' && statut !== 'trialing') {
      leses.push({
        email: i.email ?? null,
        userId: i.user_id,
        saleId: i.sale_id,
        raison: statut ? `abonnement en statut « ${statut} »` : 'aucun abonnement créé',
      });
    }
  }

  return { leses, ventesPayees, demandes: data.length, examenPartiel };
}

export interface CausePaiement {
  code: string;
  libelle: string;
  explication: string;
  nombre: number;
  part: number;
}

export interface DemandeDetaillee {
  saleId: string;
  userId: string | null;
  email: string | null;
  plan: string;
  montant: number | null;
  pays: string | null;
  statut: string | null;
  statutLibelle: string;
  cause: string | null;
  causeLibelle: string | null;
  causeExplication: string;
  moyen: string | null;
  aPaye: boolean;
  creeeLe: string;
}

export interface BilanEchecsPaiement {
  /**
   * Vrai quand le relevé lui-même est hors service (colonnes absentes, base
   * injoignable). Sans ce drapeau, une panne se lirait « aucune demande de
   * paiement » — une phrase fausse sur un tableau de bord est pire qu'une case
   * vide, parce qu'on la croit.
   */
  indisponible: boolean;
  /**
   * Toutes les demandes de la période. C'est le seul dénominateur juste pour
   * les pourcentages : les ventes honorées ne sont jamais relevées auprès de
   * la boutique, si bien que « relevées » les exclut et que les parts
   * dépasseraient 100 %.
   */
  total: number;
  /** Demandes relevées auprès de la boutique. */
  relevees: number;
  /** Demandes pas encore relevées : leur sort est inconnu. */
  nonRelevees: number;
  payees: number;
  /** Personnes reparties sans jamais choisir de moyen de paiement. */
  repartiesSansEssayer: number;
  /** Paiements réellement tentés puis refusés. */
  refuses: number;
  causes: CausePaiement[];
  statuts: { statut: string; libelle: string; explication: string; nombre: number }[];
  /** Comptes ayant ouvert plusieurs fois le paiement sans jamais aboutir. */
  insistants: { email: string | null; userId: string | null; tentatives: number; causes: string[] }[];
  demandes: DemandeDetaillee[];
}

export async function getBilanEchecsPaiement(jours = 14): Promise<BilanEchecsPaiement> {
  const sb = createAdminClient();
  const vide: BilanEchecsPaiement = {
    indisponible: false,
    total: 0,
    relevees: 0, nonRelevees: 0, payees: 0, repartiesSansEssayer: 0, refuses: 0,
    causes: [], statuts: [], insistants: [], demandes: [],
  };

  const { data, error } = await sb
    .from('payment_intents')
    .select('sale_id, user_id, email, plan, amount, pays, statut_boutique, cause_echec, message_echec, moyen_paiement, releve_le, consumed_at, created_at')
    .gte('created_at', new Date(Date.now() - jours * 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    // Les colonnes n'existent pas encore : la migration n'a pas été appliquée.
    console.warn('[PAIEMENTS] Bilan indisponible :', error.message);
    return { ...vide, indisponible: true };
  }
  const lignes = data ?? [];
  if (!lignes.length) return vide;

  const parCause = new Map<string, number>();
  const parStatut = new Map<string, number>();
  for (const l of lignes) {
    if (l.cause_echec) parCause.set(l.cause_echec, (parCause.get(l.cause_echec) ?? 0) + 1);
    if (l.statut_boutique) parStatut.set(l.statut_boutique, (parStatut.get(l.statut_boutique) ?? 0) + 1);
  }
  const totalCauses = [...parCause.values()].reduce((t, n) => t + n, 0);

  // Plusieurs tentatives sans jamais aboutir : quelqu'un qui recommence veut
  // payer. C'est le signal le plus fort du tableau.
  const parPersonne = new Map<string, { userId: string | null; tentatives: number; causes: string[]; aPaye: boolean }>();
  for (const l of lignes as any[]) {
    const cle = l.email ?? l.user_id ?? l.sale_id;
    const p = parPersonne.get(cle) ?? {
      userId: (l.user_id ?? null) as string | null,
      tentatives: 0,
      causes: [] as string[],
      aPaye: false,
    };
    p.tentatives++;
    if (l.cause_echec) p.causes.push(libelleCausePaiement(l.cause_echec)!);
    if (l.consumed_at) p.aPaye = true;
    parPersonne.set(cle, p);
  }

  return {
    indisponible: false,
    total: lignes.length,
    relevees: lignes.filter((l) => l.releve_le).length,
    // Une vente honorée n'est jamais relevée — son sort est scellé. La compter
    // comme « pas encore relevée » ferait croire à un retard qui n'existe pas.
    nonRelevees: lignes.filter((l: any) => !l.releve_le && !l.consumed_at).length,
    payees: lignes.filter((l) => l.consumed_at).length,
    repartiesSansEssayer: lignes.filter((l) => l.statut_boutique === 'abandoned').length,
    refuses: lignes.filter((l) => l.statut_boutique === 'failed').length,
    causes: [...parCause.entries()]
      .map(([code, nombre]) => ({
        code,
        libelle: libelleCausePaiement(code)!,
        explication: explicationCausePaiement(code),
        nombre,
        part: Math.round((nombre / totalCauses) * 1000) / 10,
      }))
      .sort((a, b) => b.nombre - a.nombre),
    statuts: [...parStatut.entries()]
      .map(([statut, nombre]) => ({
        statut,
        libelle: libelleStatutVente(statut),
        explication: explicationStatutVente(statut),
        nombre,
      }))
      .sort((a, b) => b.nombre - a.nombre),
    insistants: [...parPersonne.entries()]
      .filter(([, p]) => p.tentatives > 1 && !p.aPaye)
      .map(([email, p]) => ({ email, userId: p.userId, tentatives: p.tentatives, causes: p.causes }))
      .sort((a, b) => b.tentatives - a.tentatives)
      .slice(0, 10),
    demandes: lignes.slice(0, 60).map((l) => ({
      saleId: l.sale_id,
      userId: l.user_id ?? null,
      email: l.email ?? null,
      plan: l.plan,
      montant: l.amount,
      pays: l.pays ?? null,
      statut: l.statut_boutique ?? null,
      // Une vente honorée n'est jamais relevée auprès de la boutique — c'est
      // inutile, son sort est scellé. Sans ce cas particulier, elle
      // s'afficherait « pas encore relevé » sous une pastille verte.
      statutLibelle: l.consumed_at
        ? 'Payé'
        : l.releve_le
          ? libelleStatutVente(l.statut_boutique)
          : 'Pas encore relevé',
      cause: l.cause_echec ?? null,
      causeLibelle: libelleCausePaiement(l.cause_echec),
      causeExplication: explicationCausePaiement(l.cause_echec),
      moyen: l.moyen_paiement ?? null,
      aPaye: !!l.consumed_at,
      creeeLe: l.created_at,
    })),
  };
}
