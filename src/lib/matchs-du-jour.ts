/**
 * Les matchs analysés, confrontés à ce qui s'est réellement passé.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le diagnostic existant répond « quelle est la précision globale ». Ce n'est
 * pas la question qu'on se pose le soir d'un match : on veut savoir ce que
 * l'application a annoncé sur CE match-là, combien d'abonnés l'ont consulté, et
 * si elle a eu raison.
 *
 * C'est aussi la seule forme exploitable pour parler du produit. « 62 % de
 * précision » ne se raconte pas ; « ce soir, sur Paris Saint-Germain — Aston
 * Villa, 11 abonnés ont consulté l'analyse et le vainqueur annoncé était le
 * bon » se raconte. Ces chiffres n'existaient nulle part.
 *
 * Rien n'est estimé : tout vient des analyses enregistrées et des résultats
 * constatés par la vérification quotidienne.
 */

import { createAdminClient } from './supabase-admin';

export interface AnalyseDuMatch {
  id: string;
  email: string | null;
  userId: string | null;
  scorePredit: string | null;
  confiance: number | null;
  /** Null tant que le match n'a pas été confronté à son résultat. */
  issueCorrecte: boolean | null;
  scoreExactCorrect: boolean | null;
  creeeLe: string;
}

export interface MatchAnalyse {
  cle: string;
  equipe1: string;
  equipe2: string;
  competition: string | null;
  /** Score réel, quand la vérification l'a constaté. */
  scoreReel: string | null;
  joue: boolean;
  /** Nombre d'abonnés distincts ayant consulté ce match. */
  abonnes: number;
  analyses: AnalyseDuMatch[];
  /** Parmi les analyses vérifiées de ce match. */
  verifiees: number;
  issuesCorrectes: number;
  scoresExacts: number;
  /** Part d'issues correctes, ou null si aucune vérification. */
  reussite: number | null;
  premiereLe: string;
  derniereLe: string;
}

export interface BilanDuJour {
  /** Jour observé, au format ISO. */
  jour: string;
  /** Matchs distincts analysés ce jour-là. */
  matchs: MatchAnalyse[];
  totalAnalyses: number;
  abonnesDistincts: number;
  matchsJoues: number;
  matchsVerifies: number;
  issuesCorrectes: number;
  analysesVerifiees: number;
  /** Réussite du jour, ou null tant qu'aucune analyse n'est vérifiée. */
  reussiteDuJour: number | null;
}

/** Une même affiche, quel que soit l'ordre dans lequel elle a été demandée. */
function cleDuMatch(equipe1: string, equipe2: string): string {
  return [equipe1, equipe2]
    .map((n) => (n ?? '').trim().toLowerCase())
    .sort()
    .join(' — ');
}

/**
 * Bilan d'une journée : ce qui a été analysé, par combien de monde, et ce que
 * ça a donné.
 *
 * `jour` au format AAAA-MM-JJ. Par défaut, aujourd'hui.
 */
export async function getBilanDuJour(jour?: string): Promise<BilanDuJour> {
  const sb = createAdminClient();
  const date = jour ?? new Date().toISOString().slice(0, 10);
  const debut = `${date}T00:00:00.000Z`;
  const fin = `${date}T23:59:59.999Z`;

  const vide: BilanDuJour = {
    jour: date, matchs: [], totalAnalyses: 0, abonnesDistincts: 0,
    matchsJoues: 0, matchsVerifies: 0, issuesCorrectes: 0,
    analysesVerifiees: 0, reussiteDuJour: null,
  };

  const { data, error } = await sb
    .from('analysis_history')
    .select('id, user_id, team1_name, team2_name, competition, score, confidence, real_score, winner_correct, score_correct, verified_at, created_at')
    .gte('created_at', debut)
    .lte('created_at', fin)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.warn('[JOUR] Lecture impossible :', error.message);
    return vide;
  }
  const lignes = data ?? [];
  if (!lignes.length) return vide;

  // Les adresses vivent dans l'authentification, pas dans cette table.
  const emails = new Map<string, string>();
  try {
    const { data: comptes } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of comptes?.users ?? []) if (u.email) emails.set(u.id, u.email);
  } catch {
    // Sans les adresses, le bilan reste exploitable.
  }

  const parMatch = new Map<string, MatchAnalyse>();

  for (const l of lignes) {
    const cle = cleDuMatch(l.team1_name, l.team2_name);
    let m = parMatch.get(cle);
    if (!m) {
      m = {
        cle,
        equipe1: l.team1_name,
        equipe2: l.team2_name,
        competition: l.competition,
        scoreReel: null,
        joue: false,
        abonnes: 0,
        analyses: [],
        verifiees: 0,
        issuesCorrectes: 0,
        scoresExacts: 0,
        reussite: null,
        premiereLe: l.created_at,
        derniereLe: l.created_at,
      };
      parMatch.set(cle, m);
    }

    m.analyses.push({
      id: l.id,
      userId: l.user_id ?? null,
      email: l.user_id ? emails.get(l.user_id) ?? null : null,
      scorePredit: l.score,
      confiance: l.confidence,
      issueCorrecte: l.verified_at ? !!l.winner_correct : null,
      scoreExactCorrect: l.verified_at ? !!l.score_correct : null,
      creeeLe: l.created_at,
    });

    // Le résultat réel est le même pour toutes les analyses d'un match : la
    // première vérifiée le donne pour tout le monde.
    if (l.verified_at && l.real_score && !m.scoreReel) {
      m.scoreReel = l.real_score;
      m.joue = true;
    }
    if (l.created_at < m.premiereLe) m.premiereLe = l.created_at;
    if (l.created_at > m.derniereLe) m.derniereLe = l.created_at;
  }

  for (const m of parMatch.values()) {
    const verifiees = m.analyses.filter((a) => a.issueCorrecte !== null);
    m.verifiees = verifiees.length;
    m.issuesCorrectes = verifiees.filter((a) => a.issueCorrecte).length;
    m.scoresExacts = verifiees.filter((a) => a.scoreExactCorrect).length;
    m.reussite = verifiees.length ? Math.round((m.issuesCorrectes / verifiees.length) * 100) : null;
    m.abonnes = new Set(m.analyses.map((a) => a.userId).filter(Boolean)).size;
    m.analyses.sort((a, b) => +new Date(b.creeeLe) - +new Date(a.creeeLe));
  }

  const matchs = [...parMatch.values()].sort((a, b) => {
    // Les matchs joués d'abord : ce sont ceux qui apprennent quelque chose.
    if (a.joue !== b.joue) return a.joue ? -1 : 1;
    return b.analyses.length - a.analyses.length;
  });

  const analysesVerifiees = matchs.reduce((t, m) => t + m.verifiees, 0);
  const issuesCorrectes = matchs.reduce((t, m) => t + m.issuesCorrectes, 0);

  return {
    jour: date,
    matchs,
    totalAnalyses: lignes.length,
    abonnesDistincts: new Set(lignes.map((l) => l.user_id).filter(Boolean)).size,
    matchsJoues: matchs.filter((m) => m.joue).length,
    matchsVerifies: matchs.filter((m) => m.verifiees > 0).length,
    issuesCorrectes,
    analysesVerifiees,
    reussiteDuJour: analysesVerifiees ? Math.round((issuesCorrectes / analysesVerifiees) * 100) : null,
  };
}
