import { createAdminClient } from '@/lib/supabase-admin';
import { Entitlements, UNLIMITED } from '@/lib/subscription';

/**
 * Quota mensuel d'analyses.
 *
 * Le décompte vit en base et jamais dans le navigateur : un compteur côté
 * client se remet à zéro d'un simple rechargement de page.
 *
 * Chaque analyse décomptée est une LIGNE de `analysis_usage`, pas un compteur
 * incrémenté. Deux requêtes simultanées ne peuvent donc pas s'écraser
 * mutuellement, et la contrainte d'unicité `(user_id, match_key)` absorbe
 * naturellement les doubles clics et les réessais réseau.
 */

export interface QuotaState {
  /** Analyses consommées sur la période en cours. */
  used: number;
  /** Limite du plan (`Infinity` pour le VIP annuel). */
  limit: number;
  /** Analyses restantes (`Infinity` si illimité). */
  remaining: number;
  unlimited: boolean;
  /** Début de la période de quota. */
  periodStart: string | null;
  /** Début de la période suivante — date de remise à zéro. */
  periodEnd: string | null;
}

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function emptyState(limit: number): QuotaState {
  const unlimited = limit === UNLIMITED;
  return {
    used: 0,
    limit,
    remaining: unlimited ? UNLIMITED : limit,
    unlimited,
    periodStart: null,
    periodEnd: null,
  };
}

/** Clé identifiant un match analysé un jour donné. */
export function buildMatchKey(team1Id: string, team2Id: string): string {
  const day = new Date().toISOString().slice(0, 10);
  // Ordre normalisé : analyser « PSG vs OM » puis « OM vs PSG » le même jour
  // reste une seule et même analyse, donc un seul décompte.
  const [a, b] = [String(team1Id), String(team2Id)].sort();
  return `${a}__${b}__${day}`;
}

/** État du quota d'un utilisateur, calculé côté serveur. */
export async function getQuotaState(
  userId: string,
  entitlements: Entitlements
): Promise<QuotaState> {
  const limit = entitlements.analysisLimit;
  if (limit === UNLIMITED) return { ...emptyState(limit), periodStart: entitlements.periodStart };
  if (!entitlements.premium || !entitlements.periodStart) return emptyState(limit);

  const periodStart = entitlements.periodStart;
  const periodEnd = new Date(new Date(periodStart).getTime() + PERIOD_MS).toISOString();

  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from('analysis_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('period_start', periodStart);

    if (error) {
      console.error('[QUOTA] Lecture impossible:', error);
      // On ne bloque pas un abonné pour une panne de lecture : le décompte
      // reprendra dès que la base répond de nouveau.
      return { ...emptyState(limit), periodStart, periodEnd };
    }

    const used = count ?? 0;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      unlimited: false,
      periodStart,
      periodEnd,
    };
  } catch (e) {
    console.error('[QUOTA] Erreur:', e);
    return { ...emptyState(limit), periodStart, periodEnd };
  }
}

export type ConsumeResult =
  | { allowed: true; alreadyCounted: boolean; state: QuotaState }
  | { allowed: false; state: QuotaState };

/**
 * Réserve une analyse AVANT de l'exécuter.
 *
 * L'écriture précède le travail coûteux : si deux requêtes simultanées portent
 * sur le même match, la contrainte d'unicité en accepte une seule et la
 * seconde est reconnue comme déjà comptée — sans double facturation ni double
 * appel à l'IA.
 */
export async function consumeAnalysis(
  userId: string,
  entitlements: Entitlements,
  matchKey: string
): Promise<ConsumeResult> {
  const state = await getQuotaState(userId, entitlements);

  // Le VIP annuel n'est jamais décompté : rien à écrire, rien à vérifier.
  if (state.unlimited) return { allowed: true, alreadyCounted: false, state };

  if (!entitlements.premium || !state.periodStart) {
    return { allowed: false, state };
  }

  const admin = createAdminClient();

  // Relancer un match déjà analysé sur la période ne consomme rien de plus.
  const { data: existing } = await admin
    .from('analysis_usage')
    .select('id')
    .eq('user_id', userId)
    .eq('match_key', matchKey)
    .maybeSingle();

  if (existing) return { allowed: true, alreadyCounted: true, state };

  if (state.remaining <= 0) return { allowed: false, state };

  const { error } = await admin.from('analysis_usage').insert({
    user_id: userId,
    period_start: state.periodStart,
    match_key: matchKey,
    plan: entitlements.plan,
  });

  if (error) {
    // 23505 = violation d'unicité : une requête concurrente a déjà réservé
    // cette analyse. Ce n'est pas une erreur, c'est la protection qui joue.
    if ((error as any).code === '23505') {
      return { allowed: true, alreadyCounted: true, state };
    }
    console.error('[QUOTA] Écriture impossible:', error);
    // Une panne d'écriture ne doit pas priver un abonné de son service.
    return { allowed: true, alreadyCounted: false, state };
  }

  const used = state.used + 1;
  return {
    allowed: true,
    alreadyCounted: false,
    state: { ...state, used, remaining: Math.max(0, state.limit - used) },
  };
}

/**
 * REND L'ANALYSE AU COMPTEUR QUAND RIEN N'A ÉTÉ SERVI.
 *
 * ── POURQUOI C'EST NÉCESSAIRE ────────────────────────────────────────────
 *
 * La réservation précède volontairement le travail : c'est elle qui empêche
 * deux clics de compter double. Mais elle a un revers. Quand la collecte des
 * données tombe — API-Football hors service, réseau coupé — la requête
 * s'arrête AVANT le repli, l'abonné voit « ANALYSE INTERROMPUE »… et la ligne
 * de décompte, elle, reste écrite.
 *
 * Sur une offre à quinze analyses par mois, cela revient à en vendre
 * quatorze. Personne ne le voit passer : le compteur affiché est juste, il
 * compte simplement une analyse qui n'a jamais existé. C'est le genre de
 * détail qui finit en réclamation, et sur lequel on n'a aucune réponse.
 *
 * ── CE QUI EST RENDU, ET CE QUI NE L'EST PAS ─────────────────────────────
 *
 * Uniquement la ligne écrite par CETTE requête. Une analyse déjà comptée
 * auparavant — même match, même période — n'est pas touchée : elle a bel et
 * bien été servie une première fois. C'est pour cela que l'appelant ne
 * rembourse que lorsque `alreadyCounted` valait faux.
 *
 * Une analyse SERVIE, même en repli, n'est jamais remboursée non plus : la
 * personne a reçu son score, ses probabilités et ses textes. Le remboursement
 * ne concerne que les mains vides.
 */
export async function rembourserAnalyse(
  userId: string,
  matchKey: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('analysis_usage')
      .delete()
      .eq('user_id', userId)
      .eq('match_key', matchKey);

    if (error) {
      console.error('[QUOTA] Remboursement impossible:', error);
      return false;
    }

    console.warn(
      `[QUOTA] Analyse rendue au compteur (${matchKey}) : rien n'a été servi à l'abonné.`
    );
    return true;
  } catch (e) {
    // Un remboursement raté ne doit pas masquer la panne d'origine, qui est
    // autrement plus grave et qui, elle, est déjà enregistrée.
    console.error('[QUOTA] Erreur de remboursement:', e);
    return false;
  }
}
