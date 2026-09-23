/**
 * LES PRÉVISIONS DE BUTS, RAMENÉES À CE QUI ARRIVE VRAIMENT.
 *
 * ── LE DÉFAUT, MESURÉ LE 23 SEPTEMBRE 2026 ────────────────────────────────
 *
 * Sur 1 422 rencontres analysées par des abonnés puis jugées (90 jours,
 * `analysis_history` : ce que l'écran a RÉELLEMENT affiché), les prévisions de
 * buts sont trop tranchées aux deux bouts :
 *
 *     PLUS DE 2,5 BUTS      annoncé 26 %  →  arrivé 51 %   (39 rencontres)
 *                           annoncé 35 %  →  arrivé 51 %   (134)
 *                           annoncé 83 %  →  arrivé 67 %   (57)
 *     LES DEUX MARQUENT     annoncé 35 %  →  arrivé 51 %   (107)
 *                           annoncé 73 %  →  arrivé 66 %   (79)
 *     PLUS DE 1,5 BUT       annoncé 57 %  →  arrivé 71 %   (51)
 *
 * Le milieu de l'échelle est juste ; ce sont les affirmations les plus fortes
 * qui ne tiennent pas. Or ce sont exactement celles que l'abonné retient.
 *
 * ── LA CORRECTION, ET CE QU'ELLE VAUT ─────────────────────────────────────
 *
 * Une seule opération, la plus simple qui existe pour ça : on ramène la
 * probabilité vers le milieu, d'un facteur mesuré, marché par marché
 * (`p' = sigmoïde(a + b · logit(p))`).
 *
 * Les coefficients sont AJUSTÉS SUR LA PREMIÈRE MOITIÉ des rencontres, et
 * jugés sur la seconde — celle que l'ajustement n'a jamais vue (711
 * rencontres) :
 *
 *     | marché              | Brier avant | après  |
 *     |---------------------|-------------|--------|
 *     | plus de 0,5 but     | 0,0677      | 0,0666 |
 *     | plus de 1,5 but     | 0,1675      | 0,1664 |
 *     | plus de 2,5 buts    | 0,2479      | 0,2407 |
 *     | plus de 3,5 buts    | 0,2381      | 0,2368 |
 *     | les deux marquent   | 0,2544      | 0,2506 |
 *
 * Les cinq gagnent, et gagnent aussi sur la première moitié. Aucun vainqueur
 * annoncé ne change : cette couche ne touche QUE les prévisions de buts.
 */

/** Les coefficients mesurés, marché par marché. */
export const COEFFICIENTS: Readonly<Record<string, { a: number; b: number }>> = {
  plus05: { a: 0.8, b: 0.75 },
  plus15: { a: 0.1, b: 0.9 },
  plus25: { a: 0.2, b: 0.75 },
  plus35: { a: 0.15, b: 0.85 },
  lesDeuxMarquent: { a: 0, b: 0.75 },
  /**
   * ── LA CAGE INVIOLÉE, AJOUTÉE LE MÊME JOUR ──────────────────────────────
   *
   * Même mesure, mêmes rencontres :
   *
   *     annoncé 44 %  →  arrivé 35 %   (204 observations)
   *     annoncé 54 %  →  arrivé 45 %   (84)
   *     annoncé 64 %  →  arrivé 39 %   (31)
   *
   * Ajusté sur la première moitié, jugé sur la seconde (966 observations) :
   * Brier 0,1849 → 0,1815. La première moitié gagne aussi (0,1849 → 0,1837).
   */
  cageInviolee: { a: -0.35, b: 0.7 },
};

export type MarcheDeButs = keyof typeof COEFFICIENTS;

const borner = (p: number) => Math.max(1e-4, Math.min(0.9999, p));

/**
 * Corrige une prévision de buts exprimée en pour-cent entier.
 *
 * Rend la valeur d'origine quand elle est illisible : une prévision absente ne
 * doit jamais devenir un chiffre inventé.
 */
export function calibrerMarcheDeButs(marche: MarcheDeButs, pourcent: unknown): number {
  const v = Number(pourcent);
  if (!Number.isFinite(v)) return Number(pourcent) as number;
  const c = COEFFICIENTS[marche];
  if (!c) return Math.round(v);
  const p = borner(v / 100);
  const z = c.a + c.b * Math.log(p / (1 - p));
  const corrige = 1 / (1 + Math.exp(-z));
  return Math.round(100 * corrige);
}
