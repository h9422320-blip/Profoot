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
