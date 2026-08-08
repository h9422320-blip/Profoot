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
