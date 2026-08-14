/**
 * La courbe de précision, jour après jour.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le taux de réussite se recalcule à tout moment depuis les analyses. Mais un
 * taux instantané ne dit rien de la TENDANCE : impossible de savoir si le
 * moteur progresse, se dégrade, ou si un correctif a servi à quelque chose.
 *
 * Sur onze matchs vérifiés, un seul résultat déplace le taux de neuf points.
 * D'où la courbe : elle montre la valeur ET la matière derrière, donc à partir
 * de quand le chiffre mérite d'être cru.
 */

import { createAdminClient } from './supabase-admin';

/**
 * Nombre de matchs à partir duquel le taux cesse d'être une impression.
 *
 * En dessous, un seul résultat fait bouger le pourcentage de plusieurs points :
 * annoncer « 36 % de réussite » sur onze matchs donnerait une fausse précision.
 * Au-delà, l'ordre de grandeur devient stable.
 */
export const MATCHS_POUR_UN_TAUX_FIABLE = 50;

export interface PointCourbe {
  jour: string;
  matchsJour: number;
  issuesJustesJour: number;
  scoresExactsJour: number;
  matchsCumules: number;
  issuesJustesCumulees: number;
  scoresExactsCumules: number;
  /** Taux d'issue juste sur le cumul, en pourcentage. */
  tauxIssue: number;
  tauxScoreExact: number;
}

export interface CourbePrecision {
  points: PointCourbe[];
  /** Dernier état connu, ou null si rien n'a encore été relevé. */
  actuel: PointCourbe | null;
  /** Matchs restants avant que le taux devienne exploitable. */
  matchsManquants: number;
  fiable: boolean;
  indisponible: boolean;
}

/**
 * Enregistre l'état du jour. Appelée par la tâche planifiée, après la
 * vérification des pronostics et la reconstruction des preuves.
 *
 * Idempotente : deux passages le même jour mettent la ligne à jour plutôt que
 * d'en créer une seconde. Les deux tâches quotidiennes peuvent donc l'appeler
 * toutes les deux sans fausser la courbe.
 */
export async function enregistrerPrecisionDuJour(): Promise<{
  ok: boolean;
  matchs?: number;
  raison?: string;
}> {
  const sb = createAdminClient();

  // Les preuves portent déjà le verdict par MATCH — un match analysé quarante
  // fois n'y compte qu'une fois. C'est la bonne unité : le taux doit mesurer
  // des pronostics, pas la popularité des affiches.
  const { data: preuves, error } = await sb
    .from('preuves')
    .select('issue_correcte, score_exact, analyses_comptees, date_match, updated_at')
    .not('score_reel', 'is', null);

  if (error) return { ok: false, raison: error.message };

  const lignes = preuves ?? [];
  const jour = new Date().toISOString().slice(0, 10);

  // Ce qui a été vérifié aujourd'hui : la date du match fait foi, pas celle du
  // relevé — un match d'hier vérifié ce matin appartient à hier.
  const duJour = lignes.filter((l: any) => String(l.date_match ?? '').slice(0, 10) === jour);

  const compter = (source: any[]) => ({
    matchs: source.length,
    justes: source.filter((l) => l.issue_correcte).length,
    exacts: source.filter((l) => l.score_exact).length,
  });

  const total = compter(lignes);
  const aujourd = compter(duJour);

  const { error: err } = await sb.from('precision_quotidienne').upsert(
    {
      jour,
      matchs_jour: aujourd.matchs,
      issues_justes_jour: aujourd.justes,
      scores_exacts_jour: aujourd.exacts,
      matchs_cumules: total.matchs,
      issues_justes_cumulees: total.justes,
      scores_exacts_cumules: total.exacts,
      analyses_cumulees: lignes.reduce((t: number, l: any) => t + (l.analyses_comptees ?? 0), 0),
      releve_le: new Date().toISOString(),
    },
    { onConflict: 'jour' }
  );

  if (err) return { ok: false, raison: err.message };

  console.log(
    `[PRECISION] ${jour} — ${total.matchs} matchs cumulés, ` +
      `${total.justes} issues justes, ${total.exacts} scores exacts.`
  );
  return { ok: true, matchs: total.matchs };
}

const versPoint = (l: any): PointCourbe => {
  const m = l.matchs_cumules || 0;
  return {
    jour: l.jour,
    matchsJour: l.matchs_jour ?? 0,
    issuesJustesJour: l.issues_justes_jour ?? 0,
    scoresExactsJour: l.scores_exacts_jour ?? 0,
    matchsCumules: m,
    issuesJustesCumulees: l.issues_justes_cumulees ?? 0,
    scoresExactsCumules: l.scores_exacts_cumules ?? 0,
    tauxIssue: m ? Math.round(((l.issues_justes_cumulees ?? 0) / m) * 100) : 0,
    tauxScoreExact: m ? Math.round(((l.scores_exacts_cumules ?? 0) / m) * 100) : 0,
  };
};

export async function getCourbePrecision(jours = 60): Promise<CourbePrecision> {
  const sb = createAdminClient();
  const vide: CourbePrecision = {
    points: [], actuel: null, matchsManquants: MATCHS_POUR_UN_TAUX_FIABLE,
    fiable: false, indisponible: false,
  };

  const { data, error } = await sb
    .from('precision_quotidienne')
    .select('*')
    .order('jour', { ascending: false })
    .limit(jours);

  // La table n'existe pas encore : la migration n'a pas été appliquée.
  if (error) return { ...vide, indisponible: true };

  const points = (data ?? []).map(versPoint);
  const actuel = points[0] ?? null;
  const matchs = actuel?.matchsCumules ?? 0;

  return {
    points: points.reverse(),
    actuel,
    matchsManquants: Math.max(0, MATCHS_POUR_UN_TAUX_FIABLE - matchs),
    fiable: matchs >= MATCHS_POUR_UN_TAUX_FIABLE,
    indisponible: false,
  };
}
