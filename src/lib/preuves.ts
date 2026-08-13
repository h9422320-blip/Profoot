/**
 * Les pronostics réussis, montrés publiquement.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Environ 70 % des inscrits lancent une analyse, 1,7 % s'abonnent. Le blocage
 * n'est pas le prix : rien ne prouve au visiteur que l'IA tombe juste. Il voit
 * une analyse floutée à 85 % et doit payer pour vérifier si elle vaut quelque
 * chose. Personne ne fait ça.
 *
 * Ce module publie ce qui est constaté : des pronostics émis AVANT le match,
 * confrontés au résultat réel. Rien n'est inventé, rien n'est ressaisi après
 * coup — la vérification vient de `precision-reelle.ts`, qui interroge le
 * fournisseur de résultats.
 *
 * CE QUI EST MONTRÉ, ET CE QUI NE L'EST PAS
 *
 * Seules les réussites sont publiées. C'est une décision commerciale assumée :
 * un mur de réussites, comme une page de témoignages. La règle que ce module
 * s'impose en échange, c'est que TOUT ce qui est affiché soit littéralement
 * vrai et vérifiable — des décomptes de succès réels, jamais un taux, jamais
 * un « 100 % ». Un pourcentage calculé sur un échantillon choisi serait un
 * mensonge ; « 2 scores exacts » n'en est pas un.
 *
 * Les échecs, eux, ne disparaissent pas : ils restent visibles dans
 * l'administration, et c'est là qu'ils servent à quelque chose.
 */

import { apiFootball, CACHE_TTL } from './api-football';
import { createAdminClient } from './supabase-admin';

/**
 * La compétition réelle d'une rencontre, lue sur sa fiche.
 *
 * Le libellé enregistré au moment de l'analyse n'est pas fiable : quand la
 * rencontre n'a pas pu être résolue, le code retombe sur le championnat de la
 * première équipe. Paris Saint-Germain — Aston Villa s'affichait ainsi en
 * « ligue1 » — Aston Villa est anglais, et n'importe quel amateur de football
 * le voit immédiatement. Une seule étiquette fausse discrédite tout le mur.
 *
 * Un appel par match, mis en cache longuement : une rencontre terminée ne
 * change plus de compétition.
 */
async function competitionDuMatch(fixtureId: number | null): Promise<string | null> {
  if (!fixtureId) return null;
  try {
    const data = await apiFootball<any>(`/fixtures?id=${fixtureId}`, CACHE_TTL.STANDINGS);
    return data?.response?.[0]?.league?.name ?? null;
  } catch {
    return null;
  }
}

/** Issue d'un match à partir de deux buts. */
function issue(buts1: number, buts2: number): 'team1' | 'draw' | 'team2' {
  if (buts1 > buts2) return 'team1';
  if (buts2 > buts1) return 'team2';
  return 'draw';
}

/** Lit un score stocké (« 2 - 1 ») ; `null` si le format est inexploitable. */
function lireScore(score: string | null | undefined): [number, number] | null {
  const m = String(score ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function libelleIssue(
  code: string | null | undefined,
  equipe1: string,
  equipe2: string
): string {
  if (code === 'team1') return `Victoire ${equipe1}`;
  if (code === 'team2') return `Victoire ${equipe2}`;
  if (code === 'draw') return 'Match nul';
  return '—';
}

/**
 * Une compétition amicale se reconnaît à son nom.
 *
 * Les amicaux restent affichés — mieux vaut une section vivante qu'une section
 * vide — mais ils passent après les vraies compétitions dans l'ordre du mur :
 * une victoire annoncée en Ligue 1 pèse plus qu'une victoire en match de
 * préparation, où les équipes sont remaniées et l'enjeu inexistant.
 */
export function estAmical(competition: string | null | undefined): boolean {
  return /friendl|amical|pre-?season|test/i.test(String(competition ?? ''));
}

export interface Preuve {
  id: string;
  fixtureId: number | null;
  equipe1: string;
  logo1: string | null;
  equipe2: string;
  logo2: string | null;
  competition: string | null;
  dateMatch: string | null;
  pronoIssue: string | null;
  pronoScore: string | null;
  scoreReel: string | null;
  issueReelle: string | null;
  issueCorrecte: boolean;
  scoreExact: boolean;
  miseEnAvant: boolean;
  publiee: boolean;
  source: string;
  analysesComptees: number;
}

/** Ce qu'affiche le bandeau. Des décomptes, jamais un taux. */
export interface BilanPreuves {
  /** Pronostics réussis publiés. */
  reussites: number;
  /** Parmi eux, ceux dont le score exact est tombé pile. */
  scoresExacts: number;
  /** Réussites sur les sept derniers jours. */
  cetteSemaine: number;
  /** Compétitions distinctes représentées. */
  competitions: number;
}

function versPreuve(l: any): Preuve {
  return {
    id: l.id,
    fixtureId: l.fixture_id ?? null,
    equipe1: l.team1_name,
    logo1: l.team1_logo ?? null,
    equipe2: l.team2_name,
    logo2: l.team2_logo ?? null,
    competition: l.competition ?? null,
    dateMatch: l.date_match ?? null,
    pronoIssue: l.prono_issue ?? null,
    pronoScore: l.prono_score ?? null,
    scoreReel: l.score_reel ?? null,
    issueReelle: l.issue_reelle ?? null,
    issueCorrecte: !!l.issue_correcte,
    scoreExact: !!l.score_exact,
    miseEnAvant: !!l.mise_en_avant,
    publiee: !!l.publiee,
    source: l.source ?? 'auto',
    analysesComptees: l.analyses_comptees ?? 1,
  };
}

/**
 * Reconstruit les preuves à partir des analyses vérifiées.
 *
 * Regroupe par match, retient le pronostic majoritaire, et publie
 * automatiquement les réussites. Une preuve dépubliée à la main le reste : la
 * curation de l'administrateur n'est jamais écrasée par un passage automatique.
 *
 * Appelée par la tâche quotidienne, et à la demande depuis l'administration.
 */
export async function construirePreuves(): Promise<{
  matchs: number;
  reussites: number;
  creees: number;
  erreur?: string;
}> {
  const sb = createAdminClient();

  const { data, error } = await sb
    .from('analysis_history')
    .select(
      'fixture_id, team1_name, team1_logo, team2_name, team2_logo, competition, ' +
        'score, real_score, winner_correct, score_correct, verified_at, created_at'
    )
    .not('verified_at', 'is', null)
    .order('verified_at', { ascending: false })
    .limit(2000);

  if (error) return { matchs: 0, reussites: 0, creees: 0, erreur: error.message };

  // ── Un match compte pour un ────────────────────────────────────────────────
  const parMatch = new Map<string, any>();
  for (const l of (data ?? []) as any[]) {
    const cle = l.fixture_id
      ? `f${l.fixture_id}`
      : [l.team1_name, l.team2_name].map((n) => String(n ?? '').toLowerCase()).sort().join('|');

    const m = parMatch.get(cle) ?? {
      ligne: l,
      total: 0,
      justes: 0,
      exacts: 0,
      scores: new Map<string, number>(),
      dateMatch: l.verified_at ?? l.created_at,
    };
    m.total++;
    if (l.winner_correct) m.justes++;
    if (l.score_correct) m.exacts++;
    if (l.score) m.scores.set(l.score, (m.scores.get(l.score) ?? 0) + 1);
    parMatch.set(cle, m);
  }

  let reussites = 0;
  let creees = 0;

  for (const m of parMatch.values()) {
    const l = m.ligne;

    // Le pronostic retenu est celui qu'a vu la majorité des utilisateurs.
    const pronoScore =
      [...m.scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? l.score ?? null;

    const buts = lireScore(pronoScore);
    const reels = lireScore(l.real_score);

    const issueCorrecte = m.justes * 2 > m.total;
    const scoreExact = m.exacts * 2 > m.total;
    if (issueCorrecte) reussites++;

    // La preuve existante peut avoir été dépubliée à la main : on ne réécrit
    // jamais « publiee » sur une ligne déjà connue.
    const { data: existante } = await sb
      .from('preuves')
      .select('id, publiee')
      .eq('fixture_id', l.fixture_id ?? -1)
      .maybeSingle();

    const valeurs: Record<string, any> = {
      fixture_id: l.fixture_id ?? null,
      team1_name: l.team1_name ?? '',
      team1_logo: l.team1_logo ?? null,
      team2_name: l.team2_name ?? '',
      team2_logo: l.team2_logo ?? null,
      // La fiche du match fait foi ; le libellé enregistré à l'analyse ne sert
      // que de repli quand le fournisseur ne répond pas.
      competition: (await competitionDuMatch(l.fixture_id)) ?? l.competition ?? null,
      date_match: m.dateMatch,
      prono_issue: buts ? issue(buts[0], buts[1]) : null,
      prono_score: pronoScore,
      score_reel: l.real_score ?? null,
      issue_reelle: reels ? issue(reels[0], reels[1]) : null,
      issue_correcte: issueCorrecte,
      score_exact: scoreExact,
      analyses_comptees: m.total,
      updated_at: new Date().toISOString(),
    };

    // Un échec ne peut jamais devenir publié — la base le refuserait de toute
    // façon, mais autant ne pas le lui demander.
    if (!existante) valeurs.publiee = issueCorrecte;
    else if (!issueCorrecte) valeurs.publiee = false;

    if (existante) {
      await sb.from('preuves').update(valeurs).eq('id', existante.id);
    } else if (l.fixture_id) {
      const { error: err } = await sb.from('preuves').insert(valeurs);
      if (!err) creees++;
    }
  }

  console.log(`[PREUVES] ${parMatch.size} match(s), ${reussites} réussite(s), ${creees} nouvelle(s).`);
  return { matchs: parMatch.size, reussites, creees };
}

/**
 * Les preuves affichées au public.
 *
 * Lit la table pré-agrégée : une seule requête, aucun calcul à l'affichage.
 * La page /analyze est la plus consultée du site et la quasi-totalité des
 * visiteurs arrivent depuis un téléphone, souvent en réseau lent.
 *
 * L'ordre : mises en avant d'abord, puis les scores exacts — c'est ce qui
 * impressionne —, puis les vraies compétitions avant les amicaux, puis le plus
 * récent.
 */
export async function getPreuvesPubliques(limite = 10): Promise<{
  preuves: Preuve[];
  bilan: BilanPreuves;
  total: number;
}> {
  const sb = createAdminClient();
  const vide = {
    preuves: [],
    bilan: { reussites: 0, scoresExacts: 0, cetteSemaine: 0, competitions: 0 },
    total: 0,
  };

  const { data, error } = await sb
    .from('preuves')
    .select('*')
    .eq('publiee', true)
    .order('mise_en_avant', { ascending: false })
    .order('score_exact', { ascending: false })
    .order('date_match', { ascending: false })
    .limit(200);

  if (error) {
    // La migration n'a pas encore été appliquée : la section ne s'affiche pas,
    // plutôt que de casser la page d'analyse.
    console.warn('[PREUVES] Indisponibles :', error.message);
    return vide;
  }

  const toutes = (data ?? []).map(versPreuve);
  if (!toutes.length) return vide;

  // Les amicaux passent après : l'enjeu n'est pas le même, et une preuve en
  // vraie compétition convainc davantage.
  const ordonnees = [...toutes].sort((a, b) => {
    if (a.miseEnAvant !== b.miseEnAvant) return a.miseEnAvant ? -1 : 1;
    const amicalA = estAmical(a.competition);
    const amicalB = estAmical(b.competition);
    if (amicalA !== amicalB) return amicalA ? 1 : -1;
    if (a.scoreExact !== b.scoreExact) return a.scoreExact ? -1 : 1;
    return String(b.dateMatch ?? '').localeCompare(String(a.dateMatch ?? ''));
  });

  const ilYAUneSemaine = Date.now() - 7 * 86400000;

  return {
    preuves: ordonnees.slice(0, limite),
    total: ordonnees.length,
    bilan: {
      reussites: ordonnees.length,
      scoresExacts: ordonnees.filter((p) => p.scoreExact).length,
      cetteSemaine: ordonnees.filter(
        (p) => p.dateMatch && new Date(p.dateMatch).getTime() >= ilYAUneSemaine
      ).length,
      competitions: new Set(
        ordonnees.map((p) => String(p.competition ?? '').toLowerCase()).filter(Boolean)
      ).size,
    },
  };
}

/**
 * Toutes les preuves, réussites ET échecs, pour l'administration.
 *
 * C'est le seul endroit où les ratés se voient. Ils y sont indispensables :
 * sans eux, impossible de savoir si le moteur se dégrade.
 */
export async function getToutesPreuves(): Promise<{
  preuves: Preuve[];
  reussites: number;
  echecs: number;
  publiees: number;
  indisponible: boolean;
}> {
  const sb = createAdminClient();

  const { data, error } = await sb
    .from('preuves')
    .select('*')
    .order('date_match', { ascending: false })
    .limit(300);

  if (error) {
    console.warn('[PREUVES] Table indisponible :', error.message);
    return { preuves: [], reussites: 0, echecs: 0, publiees: 0, indisponible: true };
  }

  const preuves = (data ?? []).map(versPreuve);
  return {
    preuves,
    reussites: preuves.filter((p) => p.issueCorrecte).length,
    echecs: preuves.filter((p) => !p.issueCorrecte).length,
    publiees: preuves.filter((p) => p.publiee).length,
    indisponible: false,
  };
}

/**
 * Saisit à la main le résultat réel d'un match.
 *
 * Sert quand le fournisseur n'a pas su retrouver la rencontre. La justesse
 * n'est jamais saisie : elle se déduit du score, sinon la preuve ne prouverait
 * plus rien.
 */
export async function saisirScoreReel(
  id: string,
  buts1: number,
  buts2: number,
  parQui: string
): Promise<{ ok: boolean; erreur?: string }> {
  const sb = createAdminClient();

  const { data: preuve, error } = await sb
    .from('preuves')
    .select('prono_score, publiee')
    .eq('id', id)
    .maybeSingle();

  if (error || !preuve) return { ok: false, erreur: 'Preuve introuvable.' };

  const prono = lireScore((preuve as any).prono_score);
  const issueReelle = issue(buts1, buts2);
  const issueCorrecte = !!prono && issue(prono[0], prono[1]) === issueReelle;
  const scoreExact = !!prono && prono[0] === buts1 && prono[1] === buts2;

  const { error: err } = await sb
    .from('preuves')
    .update({
      score_reel: `${buts1} - ${buts2}`,
      issue_reelle: issueReelle,
      issue_correcte: issueCorrecte,
      score_exact: scoreExact,
      // Un pronostic qui devient faux se dépublie de lui-même : la contrainte
      // de la base refuserait l'écriture, et surtout ce serait mensonger.
      publiee: issueCorrecte && (preuve as any).publiee,
      source: 'admin',
      saisi_par: parQui,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return err ? { ok: false, erreur: err.message } : { ok: true };
}

/** Publie ou retire une preuve du mur public. */
export async function basculerPublication(
  id: string,
  publiee: boolean
): Promise<{ ok: boolean; erreur?: string }> {
  const sb = createAdminClient();

  if (publiee) {
    const { data } = await sb.from('preuves').select('issue_correcte').eq('id', id).maybeSingle();
    if (!(data as any)?.issue_correcte)
      return { ok: false, erreur: "Un pronostic raté ne peut pas être publié." };
  }

  const { error } = await sb
    .from('preuves')
    .update({ publiee, updated_at: new Date().toISOString() })
    .eq('id', id);

  return error ? { ok: false, erreur: error.message } : { ok: true };
}

/** Remonte une preuve en tête du mur. */
export async function basculerMiseEnAvant(
  id: string,
  miseEnAvant: boolean
): Promise<{ ok: boolean; erreur?: string }> {
  const { error } = await createAdminClient()
    .from('preuves')
    .update({ mise_en_avant: miseEnAvant, updated_at: new Date().toISOString() })
    .eq('id', id);

  return error ? { ok: false, erreur: error.message } : { ok: true };
}
