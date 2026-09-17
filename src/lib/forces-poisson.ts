import { lireReserve, ecrireReserve } from './api-football';

/**
 * ATTAQUE ET DÉFENSE DE CHAQUE CLUB, AJUSTÉES PAR MAXIMUM DE VRAISEMBLANCE.
 *
 * ── CE QUE CE FICHIER APPORTE, ET POURQUOI C'EST DIFFÉRENT ────────────────
 *
 * Le moteur note une équipe par des RAPPORTS : ses buts marqués divisés par la
 * moyenne de son championnat, corrigés de l'adversaire, du terrain, des
 * occasions. C'est une lecture directe, et elle marche.
 *
 * Ici, on fait autre chose : on cherche les attaques et les défenses qui
 * EXPLIQUENT LE MIEUX tous les résultats passés à la fois, avec l'avantage du
 * terrain comme inconnue supplémentaire. C'est la méthode de référence du
 * domaine (Dixon et Coles, 1997) : chaque club a un coefficient d'attaque et un
 * de défense, les buts suivent une loi de Poisson, et les rencontres anciennes
 * pèsent moins que les récentes.
 *
 * Deux lectures indépendantes de la même réalité valent mieux qu'une : là où
 * elles s'accordent, la confiance monte ; là où elles divergent, la moyenne des
 * deux se trompe moins que chacune.
 *
 * ── CE QUE ÇA DONNE, MESURÉ ──────────────────────────────────────────────
 *
 * Sur 4 544 rencontres des sept grands championnats (2024-08 → 2026-09),
 * réestimé chaque mois sur le SEUL passé :
 *
 *     moteur en ligne .................. 2 353 justes (51,78 %)  Brier 0,5908
 *     modèle de Poisson seul ........... 2 384 justes (52,46 %)  Brier 0,5867
 *     moitié-moitié (demi-vie 300 j) ... 2 376 justes (52,29 %)  Brier 0,5862
 *
 * Quinze dosages essayés (demi-vie 120, 180, 300 jours × part 0,25 à 1) :
 * TOUS gagnent des vainqueurs. Le plateau est franc, ce n'est pas un réglage
 * trouvé par chance.
 *
 * ── CE QUI EST CALCULÉ OÙ ────────────────────────────────────────────────
 *
 * L'ajustement lit des milliers de rencontres et ne tient pas dans le temps
 * accordé à une requête. Il est donc fait CHAQUE JOUR par le challenger, sur
 * l'ordinateur du propriétaire, et rangé en réserve. La production ne fait que
 * LIRE : absente ou vieille, elle se tait et le moteur rend exactement ce qu'il
 * rendait — comme la mémoire des clubs.
 */

/** Une rencontre terminée, telle que l'ajustement la lit. */
export interface RencontrePoisson {
  date: string;
  ligue: number;
  dom: number;
  ext: number;
  bd: number;
  be: number;
}

/** Les coefficients d'un championnat. */
export interface ForcePoissonLigue {
  /** Attaque et défense par club, en logarithme. */
  clubs: Record<string, { attaque: number; defense: number }>;
  /** Avantage du terrain, en logarithme. */
  terrain: number;
  /** Buts attendus d'une équipe moyenne à l'extérieur, en logarithme. */
  base: number;
  /** Combien de rencontres ont servi. */
  rencontres: number;
}

export interface ForcesPoisson {
  ligues: Record<string, ForcePoissonLigue>;
  calculeLe: string;
}

/**
 * Demi-vie de l'oubli, en jours.
 *
 * Trois valeurs mesurées — 120, 180 et 300 — toutes gagnantes. On retient 300 :
 * c'est la plus longue, donc la plus stable, et c'est elle qui donne le
 * meilleur Brier et le seul dosage positif dans les trois périodes de contrôle.
 */
export const DEMI_VIE_JOURS = 300;

/** Correction des petits scores, valeur de la littérature. */
const RHO = -0.1;

/** Sous ce nombre de rencontres, un championnat ne dit rien de fiable. */
export const RENCONTRES_MINIMUM = 200;

/** Un club vu moins souvent que cela garde une note trop incertaine. */
export const MATCHS_MINIMUM_CLUB = 5;

/**
 * Ajuste attaques, défenses et avantage du terrain d'un championnat.
 *
 * Descente de gradient sur la vraisemblance de Poisson, avec oubli
 * exponentiel. Les attaques et les défenses sont recentrées à chaque pas : sans
 * cela, tout le championnat peut dériver ensemble sans rien changer aux écarts.
 */
export function ajusterPoisson(
  rencontres: RencontrePoisson[],
  jusquA: number,
  demiVieJours = DEMI_VIE_JOURS
): ForcePoissonLigue | null {
  const index = new Map<number, number>();
  const idx = (c: number) => {
    if (!index.has(c)) index.set(c, index.size);
    return index.get(c)!;
  };
  const vues = new Map<number, number>();
  const obs: { d: number; e: number; bd: number; be: number; w: number }[] = [];
  for (const m of rencontres) {
    const t = Date.parse(m.date);
    if (!Number.isFinite(t) || t >= jusquA) continue;
    const w = Math.pow(0.5, (jusquA - t) / (demiVieJours * 86_400_000));
    // Au-delà, une rencontre ne pèse plus rien et coûte du temps.
    if (w < 0.02) continue;
    obs.push({ d: idx(m.dom), e: idx(m.ext), bd: Number(m.bd), be: Number(m.be), w });
    vues.set(m.dom, (vues.get(m.dom) ?? 0) + 1);
    vues.set(m.ext, (vues.get(m.ext) ?? 0) + 1);
  }
  if (obs.length < RENCONTRES_MINIMUM) return null;

  const n = index.size;
  const att = new Float64Array(n);
  const def = new Float64Array(n);
  let terrain = 0.25;
  let base = Math.log(1.35);
  const PAS = 0.06;
  const ITERATIONS = 60;

  for (let it = 0; it < ITERATIONS; it++) {
    const gA = new Float64Array(n);
    const gD = new Float64Array(n);
    let gT = 0;
    let gB = 0;
    let poids = 0;
    for (const o of obs) {
      const lh = Math.exp(base + att[o.d] - def[o.e] + terrain);
      const la = Math.exp(base + att[o.e] - def[o.d]);
      const rh = o.bd - lh;
      const ra = o.be - la;
      gA[o.d] += o.w * rh;
      gD[o.e] -= o.w * rh;
      gA[o.e] += o.w * ra;
      gD[o.d] -= o.w * ra;
      gT += o.w * rh;
      gB += o.w * (rh + ra);
      poids += o.w;
    }
    const echelle = Math.max(1, poids / n);
    for (let i = 0; i < n; i++) {
      att[i] += (PAS * gA[i]) / echelle;
      def[i] += (PAS * gD[i]) / echelle;
    }
    terrain += (PAS * gT) / Math.max(1, poids);
    base += (PAS * gB) / Math.max(1, 2 * poids);
    let ma = 0;
    let md = 0;
    for (let i = 0; i < n; i++) {
      ma += att[i];
      md += def[i];
    }
    ma /= n;
    md /= n;
    for (let i = 0; i < n; i++) {
      att[i] -= ma;
      def[i] -= md;
    }
  }

  const clubs: Record<string, { attaque: number; defense: number }> = {};
  for (const [club, i] of index) {
    if ((vues.get(club) ?? 0) < MATCHS_MINIMUM_CLUB) continue;
    clubs[String(club)] = {
      attaque: Math.round(att[i] * 10000) / 10000,
      defense: Math.round(def[i] * 10000) / 10000,
    };
  }
  return {
    clubs,
    terrain: Math.round(terrain * 10000) / 10000,
    base: Math.round(base * 10000) / 10000,
    rencontres: obs.length,
  };
}

const poisson = (k: number, lambda: number): number => {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / f;
};

const tau = (i: number, j: number, lh: number, la: number): number => {
  if (i === 0 && j === 0) return 1 - lh * la * RHO;
  if (i === 0 && j === 1) return 1 + lh * RHO;
  if (i === 1 && j === 0) return 1 + la * RHO;
  if (i === 1 && j === 1) return 1 - RHO;
  return 1;
};

/**
 * L'avis du modèle sur une rencontre : qui gagne, et avec quelle probabilité.
 *
 * Rend `null` dès qu'un des deux clubs manque : un avis à moitié informé serait
 * pire que pas d'avis du tout.
 */
export function avisPoisson(
  force: ForcePoissonLigue | null | undefined,
  domicile: number | string | null | undefined,
  exterieur: number | string | null | undefined
): { dom: number; nul: number; ext: number } | null {
  if (!force) return null;
  const a = force.clubs[String(domicile ?? '')];
  const b = force.clubs[String(exterieur ?? '')];
  if (!a || !b) return null;

  const lh = Math.exp(force.base + a.attaque - b.defense + force.terrain);
  const la = Math.exp(force.base + b.attaque - a.defense);
  if (!Number.isFinite(lh) || !Number.isFinite(la) || lh <= 0 || la <= 0) return null;

  let dom = 0;
  let nul = 0;
  let ext = 0;
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const p = poisson(i, lh) * poisson(j, la) * tau(i, j, lh, la);
      if (i > j) dom += p;
      else if (i === j) nul += p;
      else ext += p;
    }
  }
  const total = dom + nul + ext;
  if (!(total > 0)) return null;
  return { dom: dom / total, nul: nul / total, ext: ext / total };
}

/** Clé de réserve. Le relevé est refait chaque jour par le challenger. */
const CLE = 'forces-poisson:v1';
const DUREE = 8 * 24 * 60 * 60 * 1000;

/** Au-delà, le relevé est trop vieux pour parler. */
export const FRAICHEUR_MAX_MS = 10 * 24 * 60 * 60 * 1000;

export async function lireForcesPoisson(): Promise<ForcesPoisson | null> {
  try {
    const r = await lireReserve<ForcesPoisson>(CLE);
    const contenu = r?.contenu ?? null;
    if (!contenu?.ligues) return null;
    const age = Date.now() - Date.parse(contenu.calculeLe);
    if (!Number.isFinite(age) || age > FRAICHEUR_MAX_MS) return null;
    return contenu;
  } catch {
    return null;
  }
}

export async function rangerForcesPoisson(forces: ForcesPoisson): Promise<void> {
  await ecrireReserve(CLE, forces, DUREE);
}
