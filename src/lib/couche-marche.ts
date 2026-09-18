/**
 * LA COUCHE DU MARCHÉ : UNE SOURCE D'INFORMATION DE PLUS SUR LE MATCH.
 *
 * ── CE QU'ELLE APPORTE ────────────────────────────────────────────────────
 *
 * Les cotes relevées chaque jour par `cotes-marche.ts` résument ce que des
 * milliers d'observateurs pensent d'une rencontre : blessures de dernière
 * minute, rotation annoncée, forme du moment. Elles ne sont jamais montrées à
 * l'abonné — ProFoot est un moteur d'analyse pour les passionnés de football,
 * pas un outil de paris —, mais elles disent au moteur ce qu'il n'a pas vu.
 *
 * ── CE QU'ELLE FAIT ───────────────────────────────────────────────────────
 *
 * Elle garde le TOTAL de buts que le moteur attend, et reprend l'avis du
 * marché sur la question que l'abonné pose vraiment : qui domine. Elle se
 * pose par-dessus tout le calcul existant, dans la proportion voulue, et ne
 * remplace rien — décision du propriétaire du 11 septembre 2026.
 *
 * ── CE QUI A ÉTÉ MESURÉ, ET CE QUI RESTE À PROUVER ────────────────────────
 *
 * Aperçu du 11 septembre 2026, sur 733 matchs à la fois cotés et jugés :
 * le marché seul trouve le bon vainqueur 53,6 % puis 56,4 % des fois selon
 * la moitié, contre 49,7 % et 49,6 % pour le vainqueur annoncé par le moteur.
 *
 * Le propriétaire a fixé 1 000 matchs avant toute décision. La couche est
 * donc bâtie et essayée chaque jour par le challenger ; elle n'est BRANCHÉE
 * en production que lorsqu'elle aura gagné, sur assez de matchs.
 *
 * Fonctions pures, sans réseau ni base.
 */

/** Même correction des petits scores que la grille du moteur. */
const RHO = -0.1;

function poisson(k: number, lambda: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / f;
}

/** Probabilités domicile, nul, extérieur pour deux buts attendus. */
function issues(l1: number, l2: number): [number, number, number] {
  let v1 = 0, n = 0, v2 = 0;
  for (let i = 0; i <= 10; i++)
    for (let j = 0; j <= 10; j++) {
      let t = 1;
      if (i === 0 && j === 0) t = 1 - l1 * l2 * RHO;
      else if (i === 0 && j === 1) t = 1 + l1 * RHO;
      else if (i === 1 && j === 0) t = 1 + l2 * RHO;
      else if (i === 1 && j === 1) t = 1 - RHO;
      const p = poisson(i, l1) * poisson(j, l2) * t;
      if (i > j) v1 += p;
      else if (i === j) n += p;
      else v2 += p;
    }
  const s = v1 + n + v2;
  return [v1 / s, n / s, v2 / s];
}

/**
 * Les buts attendus qu'impliquent les probabilités du marché, pour un total
 * de buts donné — ou `null` si les probabilités sont illisibles.
 */
export function butsAttendusDuMarche(
  proba: { dom: number; nul: number; ext: number },
  total: number
): { dom: number; ext: number } | null {
  const pd = Number(proba?.dom), pn = Number(proba?.nul), pe = Number(proba?.ext);
  const somme = pd + pn + pe;
  if (![pd, pn, pe, total].every(Number.isFinite) || somme <= 0 || total <= 0.2) return null;
  // Ce que le marché dit de la domination : l'écart entre les deux victoires.
  const cible = (pd - pe) / somme;
  // L'écart de buts qui produit cette domination, au total du moteur. La
  // domination croît avec l'écart : une dichotomie suffit.
  let bas = -(total - 0.1);
  let haut = total - 0.1;
  for (let i = 0; i < 40; i++) {
    const milieu = (bas + haut) / 2;
    const [p1, , p2] = issues((total + milieu) / 2, (total - milieu) / 2);
    if (p1 - p2 < cible) bas = milieu;
    else haut = milieu;
  }
  const ecart = (bas + haut) / 2;
  return { dom: (total + ecart) / 2, ext: (total - ecart) / 2 };
}

/**
 * ── L'AVIS DU MARCHÉ POUR UNE RENCONTRE, TEL QUE LE MOTEUR LE PREND ────────
 *
 * EN LIGNE DEPUIS LE 18 SEPTEMBRE 2026, SUR LES SEPT GRANDS CHAMPIONNATS.
 *
 * Les cotes relevées par la production ne remontaient qu'au 11 septembre :
 * 307 matchs, trop peu pour trancher — et la mesure faite dessus concluait,
 * à tort, que le marché ne désignait pas mieux le vainqueur. Avec les cotes
 * d'avant-match publiques de football-data.co.uk (moyenne des bookmakers,
 * relevée avant le match, jamais la clôture), rattachées à 4 577 rencontres
 * des sept grands championnats depuis août 2024 :
 *
 *     vainqueurs, deux moitiés ............ +53 / +54
 *     vainqueurs, trois tranches .......... +39 / +36 / +32   (+107)
 *     matchs sûrs ......................... 72,0 / 73,5 %  (moteur ~69-70 %)
 *     3 mis en avant par jour ............. 66,0 → 68,6 %   (+20 journées parfaites)
 *     5 mis en avant par jour ............. 64,9 → 68,5 %
 *
 * Sept dosages essayés (part 0,25 à 1, par les buts ou par les probabilités) :
 * TOUS passent la porte et les trois tranches. Le gain croît avec la part ; on
 * retient la part pleine, par les buts : le moteur garde son total de buts et
 * reprend l'avis du marché sur qui domine.
 *
 * Seulement les sept grands championnats : c'est là, et là seulement, que la
 * mesure a été faite. Ailleurs — coupes d'Europe comprises — le moteur reste
 * seul. Les cotes ne sont JAMAIS montrées à l'abonné.
 */
export const PART_DU_MARCHE = 1;

// ── UNE JOURNÉE DE COTES, LUE UNE FOIS ─────────────────────────────────────
//
// La lecture de la réserve abandonne au bout d'une seconde et demie. Lue une
// fois par MATCH, une journée chargée multipliait les chances qu'une lecture
// lente fasse manquer l'avis du marché — sans rien signaler, le moteur
// retombant sur son seul calcul. Constaté le 18 septembre 2026 en local.
// La journée est donc gardée en mémoire dix minutes ; une lecture ratée
// n'est PAS gardée, pour être retentée au match suivant.
const JOURNEES = new Map<string, { quand: number; matchs: Map<number, any> }>();
const DUREE_JOURNEE_MS = 10 * 60 * 1000;
async function journeeDeCotes(jour: string): Promise<Map<number, any> | null> {
  const connue = JOURNEES.get(jour);
  if (connue && Date.now() - connue.quand < DUREE_JOURNEE_MS) return connue.matchs;
  const { lireCotesDuJourPatiemment } = await import('./cotes-marche');
  const releve = await lireCotesDuJourPatiemment(jour);
  if (!releve?.matchs) return null;
  const matchs = new Map(releve.matchs.map((m) => [Number(m.id), m]));
  JOURNEES.set(jour, { quand: Date.now(), matchs });
  return matchs;
}

/**
 * Les championnats où l'avis du marché est mesuré, et donc branché.
 *
 * Les sept grands : Premier League, Liga, Serie A, Bundesliga, Ligue 1,
 * Primeira Liga, Eredivisie.
 *
 * ── ET NEUF DE PLUS, LE MÊME JOUR ─────────────────────────────────────────
 *
 * Championship, Écosse, 2. Bundesliga, Serie B, Segunda División, Ligue 2,
 * Belgique, Turquie, Grèce — mêmes cotes d'avant-match de football-data.co.uk,
 * 6 034 rencontres, part pleine :
 *
 *     vainqueurs ................ +137, positif sur les trois périodes (+71, +13, +53)
 *     matchs sûrs ............... 61,8 % → 71,1 %
 *     chaque championnat gagne : Serie B +39, Turquie +33, Belgique +18,
 *     Segunda +17, Ligue 2 +9, Championship +8, 2. Bundesliga +7,
 *     Grèce +4, Écosse +2.
 */
export const CHAMPIONNATS_DU_MARCHE: ReadonlySet<number> = new Set([
  39, 140, 135, 78, 61, 94, 88,
  40, 179, 79, 136, 141, 62, 144, 203, 197,
]);

/**
 * ── LES COUPES D'EUROPE, DEPUIS LE 18 SEPTEMBRE 2026 ──────────────────────
 *
 * Ligue des champions, Ligue Europa, Ligue Conférence. Aucune cote historique
 * publique ne couvre les coupes : la mesure vient des cotes relevées par la
 * production, sur 68 matchs joués depuis août (`scripts/_marche-en-coupe.mts`) :
 *
 *     favori du marché juste ....... 42
 *     analyse du moteur juste ...... 32
 *     quand les deux divergent (29) : marché 16, moteur 6
 *
 * C'est là que le moteur faisait ses pires fautes : Manchester United 0-3
 * Sabah (4-0), Crystal Palace 1-4 Lech Poznan (4-0), Sunderland 1-3 AZ (1-0),
 * NEC vainqueur à la Juventus (5-0). Le rapport entre championnats y décide
 * seul, et un championnat peu confronté aux autres le fausse.
 *
 * Seul l'avis 1N2 est branché ici ; le nombre de buts du marché reste
 * réservé aux championnats, où il est mesuré.
 */
export const COUPES_DU_MARCHE: ReadonlySet<number> = new Set([2, 3, 848]);

/** Le marché donne-t-il son avis sur le vainqueur dans cette compétition ? */
export function avisDuMarcheBranche(ligue: number | string | null | undefined): boolean {
  return CHAMPIONNATS_DU_MARCHE.has(Number(ligue)) || COUPES_DU_MARCHE.has(Number(ligue));
}

export async function avisDuMarchePour(
  fixtureId: number | string | null | undefined,
  coupDEnvoi: string | null | undefined,
  ligue: number | string | null | undefined
): Promise<{ dom: number; nul: number; ext: number; poids: number } | null> {
  if (!fixtureId || !coupDEnvoi || !avisDuMarcheBranche(ligue)) return null;
  try {
    const m = (await journeeDeCotes(String(coupDEnvoi).slice(0, 10)))?.get(Number(fixtureId));
    const p = m?.proba;
    if (!p || !(p.dom > 0) || !(p.ext > 0) || !(p.nul > 0)) return null;
    return { dom: p.dom, nul: p.nul, ext: p.ext, poids: PART_DU_MARCHE };
  } catch {
    return null;
  }
}

/**
 * La probabilité de « plus de 2,5 buts » selon le marché, pour une rencontre
 * des championnats où le marché est mesuré. `null` si le relevé ne la porte
 * pas (relevé antérieur au 18 septembre 2026, ou bookmakers muets).
 */
export async function totalDuMarchePour(
  fixtureId: number | string | null | undefined,
  coupDEnvoi: string | null | undefined,
  ligue: number | string | null | undefined
): Promise<number | null> {
  if (!fixtureId || !coupDEnvoi || !CHAMPIONNATS_DU_MARCHE.has(Number(ligue))) return null;
  try {
    const m = (await journeeDeCotes(String(coupDEnvoi).slice(0, 10)))?.get(Number(fixtureId));
    const p = Number(m?.plusDeDeuxCinq);
    return Number.isFinite(p) && p > 0 && p < 1 ? p : null;
  } catch {
    return null;
  }
}
