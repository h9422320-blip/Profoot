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
/**
 * ── DEUX MARCHÉS RÉAJUSTÉS LE 29 SEPTEMBRE 2026 ──────────────────────────
 *
 * Les coefficients d'origine avaient été ajustés sur 711 rencontres. Le banc
 * en rejoue désormais 3 090, avec le score réel de chacune : de quoi les
 * remesurer sérieusement.
 *
 * L'ÉPREUVE, DANS LES DEUX SENS. Ajuster sur une moitié et juger sur l'autre
 * ne prouve rien si l'on ne fait le trajet qu'une fois : la seconde moitié
 * peut simplement ressembler à la première. Chaque marché a donc été ajusté
 * sur la 1re moitié puis jugé sur la 2e, PUIS ajusté sur la 2e et jugé sur la
 * 1re. Un coefficient n'est retenu que s'il gagne DANS LES DEUX SENS.
 *
 *     marché              1re → 2e     2e → 1re     retenu
 *     plus de 1,5 but     +0,0013      +0,0051      oui
 *     plus de 3,5 buts    +0,0021      +0,0097      oui
 *     plus de 2,5 buts    -0,0008      +0,0052      NON
 *     les deux marquent   -0,0017      +0,0022      NON
 *
 * Les deux refusés gagnaient dans un sens et perdaient dans l'autre : c'est la
 * signature d'un ajustement qui apprend une moitié par cœur. Leurs
 * coefficients d'origine restent en place, et ils font leur travail — sur la
 * moitié jamais vue, « plus de 2,5 buts » passe de 0,2449 brut à 0,2415.
 *
 * CE QUE « PLUS DE 3,5 BUTS » COÛTAIT. Son calibrage faisait moins bien que ne
 * rien faire du tout : 0,2220 contre 0,2214 en brut. Il annonçait 60-70 % là
 * où il arrive 45,6 %.
 *
 * ── ET POURQUOI IL N'A PAS SON OPTIMUM ───────────────────────────────────
 *
 * L'ajustement libre donnait { a: -0,37 ; b: 0,43 }. Il CASSAIT L'ORDRE DES
 * SEUILS : à 0,70 but attendu, « plus de 3,5 buts » ressortait à 9 % quand
 * « plus de 2,5 » ressortait à 8 %. Un écran qui annonce plus de chances de
 * voir quatre buts que trois est absurde, et cette absurdité coûte plus cher
 * qu'un millième de Brier.
 *
 * Le couple retenu est donc le meilleur PARMI CEUX QUI TIENNENT L'ORDRE sur
 * toute la plage de buts attendus — 88 couples le tenaient et gagnaient dans
 * les deux sens, celui-ci est le plus solide des deux côtés :
 * +0,0097 sur la 1re moitié, +0,0033 sur la 2e.
 *
 * POURQUOI UN `b` AUSSI BAS. Mesuré par tranche, l'écart annoncé/arrivé est
 * toujours le même : trop d'assurance en haut, pas assez en bas. « Plus de 1,5
 * but » annonce 40-50 % là où il arrive 70,4 %, et 80-100 % là où il arrive
 * 82,9 %. La vraie plage est bien plus étroite que celle annoncée : c'est
 * exactement ce que corrige un `b` qui resserre.
 *
 * AUCUN VAINQUEUR ANNONCÉ NE CHANGE : ces coefficients ne touchent que les
 * prévisions de buts.
 */
export const COEFFICIENTS: Readonly<Record<string, { a: number; b: number }>> = {
  plus05: { a: 0.8, b: 0.75 },
  // Réajusté le 29/09/2026 sur 3 090 rencontres (voir ci-dessus).
  plus15: { a: 0.75, b: 0.43 },
  plus25: { a: 0.2, b: 0.75 },
  // Réajusté le 29/09/2026 : l'ancien faisait moins bien que le brut.
  plus35: { a: -0.25, b: 0.55 },
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
