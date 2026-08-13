/**
 * Précision réelle des pronostics ProFoot.
 *
 * L'application affichait des taux de réussite écrits en dur — 79,2 % de
 * vainqueurs corrects, 23,4 % de scores exacts, une série de 11 matchs — qui ne
 * reposaient sur aucune mesure. Ces chiffres étaient montrés à des abonnés
 * payants comme une promesse de performance.
 *
 * Ce module les remplace par ce qui est constaté : chaque analyse passée est
 * confrontée au résultat réel du match, et la précision se déduit de ces
 * comparaisons. Tant qu'aucun match n'a été vérifié, il ne renvoie aucun
 * pourcentage — l'interface annonce alors qu'il n'y a pas encore de mesure,
 * plutôt que d'inventer un chiffre flatteur.
 */

import { apiFootball, CACHE_TTL } from './api-football';
import { createAdminClient } from './supabase-admin';

/**
 * Nombre de matchs vérifiés en dessous duquel aucun pourcentage n'est publié.
 *
 * Le premier match vérifié était un échec : le taux serait tombé à 0 %. Un
 * chiffre calculé sur une poignée d'observations ne décrit pas une performance,
 * il décrit le hasard — et il induit en erreur dans un sens comme dans l'autre.
 * En dessous de ce seuil, on annonce le nombre de matchs déjà vérifiés sans en
 * tirer de taux.
 */
export const ECHANTILLON_MINIMUM = 10;

export interface PrecisionReelle {
  /** Analyses effectivement confrontées à un résultat. */
  verifiees: number;
  /** Analyses en attente : le match n'a pas encore été joué ou pas encore relevé. */
  enAttente: number;
  /** Pourcentages, `null` tant qu'aucune analyse n'a été vérifiée. */
  vainqueurCorrect: number | null;
  scoreExact: number | null;
  /** Série de bons pronostics en cours, du plus récent au plus ancien. */
  serieEnCours: number;
  /** Date du dernier match vérifié. */
  derniereVerification: string | null;
}

/** Issue d'un match à partir de deux buts. */
function issue(butsDomicile: number, butsExterieur: number): 'team1' | 'team2' | 'draw' {
  if (butsDomicile > butsExterieur) return 'team1';
  if (butsExterieur > butsDomicile) return 'team2';
  return 'draw';
}

/**
 * Lit le score prédit tel qu'il est stocké (« 3 - 1 ») et en déduit l'issue.
 *
 * Renvoie `null` si le format n'est pas exploitable : une analyse illisible ne
 * doit pas compter comme un échec, elle ne doit simplement pas compter.
 */
function lirePrediction(score: string | null): { buts: [number, number]; issue: string } | null {
  const m = (score ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return null;
  const buts: [number, number] = [Number(m[1]), Number(m[2])];
  return { buts, issue: issue(buts[0], buts[1]) };
}

/**
 * Retrouve le résultat réel d'une analyse.
 *
 * On cherche la confrontation entre les deux équipes autour de la date de
 * l'analyse. Renvoie `null` tant que le match n'est pas terminé — l'analyse
 * reste alors en attente et sera reprise au passage suivant.
 */
async function trouverResultat(analyse: any): Promise<{
  fixtureId: number;
  butsDomicile: number;
  butsExterieur: number;
  inverse: boolean;
} | null> {
  const logo1 = String(analyse.team1_logo ?? '');
  const logo2 = String(analyse.team2_logo ?? '');
  // Les identifiants du fournisseur sont contenus dans l'URL des logos, seule
  // trace fiable : les identifiants stockés sont des slugs internes.
  const id1 = logo1.match(/teams\/(\d+)\.png/)?.[1];
  const id2 = logo2.match(/teams\/(\d+)\.png/)?.[1];
  if (!id1 || !id2) return null;

  const data = await apiFootball<any>(
    `/fixtures/headtohead?h2h=${id1}-${id2}&last=10`,
    CACHE_TTL.STANDINGS
  );
  const matchs = data?.response ?? [];
  if (!matchs.length) return null;

  const creee = new Date(analyse.created_at).getTime();

  // Le match visé est le premier disputé APRÈS la création de l'analyse : une
  // analyse ne peut pas porter sur une rencontre déjà jouée au moment où elle
  // a été produite.
  const candidats = matchs
    .filter((f: any) => ['FT', 'AET', 'PEN'].includes(f.fixture?.status?.short))
    .filter((f: any) => new Date(f.fixture.date).getTime() >= creee - 6 * 3600 * 1000)
    .sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

  const match = candidats[0];
  if (!match) return null;

  // L'analyse nomme « team1 » l'équipe interrogée en premier, qui n'est pas
  // toujours celle qui reçoit. Sans ce redressement, un 2-1 à l'extérieur serait
  // compté comme une victoire de l'adversaire.
  const inverse = String(match.teams?.home?.id) !== id1;

  return {
    fixtureId: match.fixture.id,
    butsDomicile: match.goals?.home ?? 0,
    butsExterieur: match.goals?.away ?? 0,
    inverse,
  };
}

/**
 * Confronte les analyses passées aux résultats réels et enregistre le verdict.
 *
 * Appelée par la tâche quotidienne. Traite un lot borné pour rester dans le
 * temps d'exécution alloué ; le reliquat est repris au passage suivant.
 */
export async function verifierPronostics(limite = 60): Promise<{
  examinees: number;
  verifiees: number;
  enAttente: number;
}> {
  const sb = createAdminClient();

  const { data, error } = await sb
    .from('analysis_history')
    .select('id, team1_logo, team2_logo, score, created_at')
    .is('verified_at', null)
    // Deux heures, et non vingt-quatre.
    //
    // Le délai précédent rendait invisible tout match joué le jour même. Le 12
    // août 2026, Paris Saint-Germain — Aston Villa a été analysé par une
    // dizaine d'abonnés puis joué dans la foulée : la vérification refusait de
    // le regarder avant le lendemain, et le diagnostic affichait « 1 match
    // vérifié, 271 en attente » alors que le résultat était connu de tous.
    //
    // Une rencontre dure environ deux heures. Passé ce délai, elle PEUT être
    // terminée ; c'est la recherche du résultat qui tranche, et elle ne retient
    // que les matchs réellement achevés.
    .lt('created_at', new Date(Date.now() - 2 * 3600 * 1000).toISOString())
    // Les analyses les plus récentes d'abord : ce sont les matchs du jour qui
    // intéressent, pas un arriéré de la semaine passée.
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('[PRECISION] Lecture impossible :', error.message);
    return { examinees: 0, verifiees: 0, enAttente: 0 };
  }

  let verifiees = 0;
  let enAttente = 0;

  for (const analyse of data ?? []) {
    const prediction = lirePrediction(analyse.score);
    const resultat = await trouverResultat(analyse);

    if (!resultat || !prediction) {
      enAttente++;
      continue;
    }

    const [butsEq1, butsEq2] = resultat.inverse
      ? [resultat.butsExterieur, resultat.butsDomicile]
      : [resultat.butsDomicile, resultat.butsExterieur];

    const issueReelle = issue(butsEq1, butsEq2);

    const { error: erreurEcriture } = await sb
      .from('analysis_history')
      .update({
        real_score: `${butsEq1} - ${butsEq2}`,
        real_winner: issueReelle,
        predicted_winner: prediction.issue,
        winner_correct: prediction.issue === issueReelle,
        score_correct: prediction.buts[0] === butsEq1 && prediction.buts[1] === butsEq2,
        verified_at: new Date().toISOString(),
        fixture_id: resultat.fixtureId,
        is_finished: true,
      })
      .eq('id', analyse.id);

    if (erreurEcriture) {
      console.error(`[PRECISION] Écriture impossible sur ${analyse.id} :`, erreurEcriture.message);
      enAttente++;
      continue;
    }
    verifiees++;
  }

  console.log(`[PRECISION] ${verifiees} pronostic(s) vérifié(s), ${enAttente} en attente.`);
  return { examinees: data?.length ?? 0, verifiees, enAttente };
}

/**
 * Précision constatée, calculée uniquement sur les analyses vérifiées.
 *
 * Ne renvoie jamais de pourcentage tant qu'aucun match n'a été confronté : un
 * taux calculé sur zéro observation n'a aucun sens et retomberait dans le
 * défaut qu'on corrige.
 */
export async function getPrecisionReelle(): Promise<PrecisionReelle> {
  const sb = createAdminClient();

  const [verifiees, attente] = await Promise.all([
    sb
      .from('analysis_history')
      .select('winner_correct, score_correct, verified_at, fixture_id, team1_name, team2_name, analysis_data')
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1000),
    sb
      .from('analysis_history')
      .select('id', { count: 'exact', head: true })
      .is('verified_at', null),
  ]);

  // Tant que la migration n'a pas été appliquée, les colonnes de vérification
  // n'existent pas et la requête échoue. Ce n'est pas une raison pour casser la
  // page : on retombe sur l'état « aucune mesure », qui est la vérité.
  if (verifiees.error) {
    console.warn(
      '[PRECISION] Colonnes de vérification absentes — appliquer la migration ' +
        '20260809_verification_pronostics.sql. Détail :',
      verifiees.error.message
    );
  }

  // ── UN MATCH COMPTE POUR UN ────────────────────────────────────────────────
  //
  // Vingt personnes qui analysent la même rencontre ne fournissent pas vingt
  // observations : elles en fournissent UNE. Compter chaque analyse séparément
  // laisse une seule affiche décider du chiffre global.
  //
  // Constaté le 12 août 2026 : Paris Saint-Germain — Aston Villa pesait 29 des
  // 49 vérifications, soit 59 % de la mesure. Le match a fini 2-1, et le défaut
  // du « 2-1 par défaut » annonçait précisément 2-1 : vingt-cinq analyses ont
  // décroché le score exact par pur hasard, hissant ce taux à 67 % alors qu'il
  // tourne autour de 10 % pour tout le monde dans ce métier.
  //
  // On regroupe donc par rencontre. Au sein d'une même rencontre, le verdict
  // retenu est celui de la MAJORITÉ des analyses : c'est ce que l'application a
  // dit à ses abonnés sur ce match-là.
  const brutes = verifiees.data ?? [];

  const parMatch = new Map<string, { justes: number; exacts: number; total: number; date: string }>();
  for (const l of brutes as any[]) {
    const cle = l.fixture_id
      ? `f${l.fixture_id}`
      : [l.team1_name, l.team2_name].map((n) => String(n ?? '').toLowerCase()).sort().join('|');
    const m = parMatch.get(cle) ?? { justes: 0, exacts: 0, total: 0, date: l.verified_at };
    m.total++;
    if (l.winner_correct) m.justes++;
    if (l.score_correct) m.exacts++;
    if (l.verified_at > m.date) m.date = l.verified_at;
    parMatch.set(cle, m);
  }

  const lignes = [...parMatch.values()]
    .map((m) => ({
      winner_correct: m.justes * 2 > m.total,
      score_correct: m.exacts * 2 > m.total,
      verified_at: m.date,
    }))
    .sort((a, b) => (a.verified_at < b.verified_at ? 1 : -1));

  const total = lignes.length;

  if (!total) {
    return {
      verifiees: 0,
      enAttente: attente.count ?? 0,
      vainqueurCorrect: null,
      scoreExact: null,
      serieEnCours: 0,
      derniereVerification: null,
    };
  }

  const bonsVainqueurs = lignes.filter((l: any) => l.winner_correct).length;
  const bonsScores = lignes.filter((l: any) => l.score_correct).length;

  // Série en cours : les lignes sont triées du plus récent au plus ancien, on
  // compte tant que le pronostic est bon.
  let serie = 0;
  for (const l of lignes as any[]) {
    if (!l.winner_correct) break;
    serie++;
  }

  // En dessous du seuil, on renvoie le décompte mais aucun taux : publier un
  // pourcentage sur deux ou trois matchs reviendrait à présenter du hasard
  // comme une performance.
  const assezDeMatchs = total >= ECHANTILLON_MINIMUM;

  return {
    verifiees: total,
    enAttente: attente.count ?? 0,
    vainqueurCorrect: assezDeMatchs ? Math.round((bonsVainqueurs / total) * 1000) / 10 : null,
    scoreExact: assezDeMatchs ? Math.round((bonsScores / total) * 1000) / 10 : null,
    serieEnCours: serie,
    derniereVerification: (lignes[0] as any)?.verified_at ?? null,
  };
}
