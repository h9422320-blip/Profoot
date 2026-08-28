/**
 * CE QUE LA BOUTIQUE FERMÉE A ENCAISSÉ, FIGÉ POUR TOUJOURS.
 *
 * ── POURQUOI CES CHIFFRES SONT ÉCRITS ICI, EN DUR ─────────────────────────
 *
 * Chariow a fermé la boutique le 27 août 2026. Ces recettes ne bougeront donc
 * plus jamais : elles sont finies, définitives, et pourtant elles fondent la
 * rémunération d'un partenaire mois après mois.
 *
 * Les garder dans un cache serait les confier à quelque chose qui a le droit
 * de disparaître. Le 28 août, la page d'administration affichait déjà zéro
 * partout parce que sa seule source — l'API de Chariow — venait d'être
 * débranchée. Une deuxième dépendance fragile au même endroit serait une
 * faute répétée.
 *
 * Écrits dans le code, ils sont versionnés, relisibles, et comparables ligne à
 * ligne avec le tableau de bord de Chariow tant que le compte existe.
 *
 * ── LA DATE RETENUE EST CELLE DE LA CRÉATION DE LA VENTE ──────────────────
 *
 * Vérifié le 28 août 2026 contre l'écran de Chariow : le 27 août, il affiche
 * 11 ventes et 38 000 FCFA. En classant par date d'ENCAISSEMENT, on trouve 12
 * ventes et 40 000 — une vente créée le 26 à 17 h 58 n'a été réglée que le 27
 * à 02 h 40. C'est la date de CRÉATION qui reproduit les chiffres de la
 * boutique, et c'est elle qui décide du jour, donc du mois, donc de ce qui est
 * dû au partenaire.
 *
 * ── D'OÙ ILS SORTENT ──────────────────────────────────────────────────────
 *
 * Des 358 ventes encaissées (statut « settled ») relevées le 28 août 2026 dans
 * la réserve locale des ventes Chariow, avant que celle-ci n'expire. Total
 * général : 1 094 200 FCFA. Total sur la période du contrat, du 16 au 27
 * août : 1 055 000 FCFA — chiffre confirmé de mémoire par le propriétaire
 * avant tout calcul.
 */

/** Recettes d'un jour : ce qui est entré, et combien de ventes l'ont fait. */
export interface JourneeFigee {
  xof: number;
  ventes: number;
}

/**
 * La commission que Chariow prélevait sur chaque journée.
 *
 * Quinze pour cent du chiffre d'affaires, retenus au fil de l'eau. Ce taux ne
 * changera plus : la boutique est fermée.
 */
export const TAUX_CHARIOW = 0.15;

/** Les recettes Chariow, jour par jour, du premier au dernier. */
export const HISTOIRE_CHARIOW: Record<string, JourneeFigee> = {
  '2026-08-07': { xof: 11000, ventes: 2 },
  '2026-08-08': { xof: 9000, ventes: 1 },
  '2026-08-11': { xof: 3000, ventes: 1 },
  '2026-08-12': { xof: 6000, ventes: 2 },
  '2026-08-13': { xof: 7200, ventes: 4 },
  '2026-08-14': { xof: 3000, ventes: 1 },
  // ── À partir d'ici, le contrat du partenaire court ──────────────────────
  '2026-08-16': { xof: 18000, ventes: 9 },
  '2026-08-17': { xof: 12000, ventes: 3 },
  '2026-08-18': { xof: 32000, ventes: 16 },
  '2026-08-19': { xof: 52000, ventes: 10 },
  '2026-08-20': { xof: 53000, ventes: 22 },
  '2026-08-21': { xof: 113000, ventes: 21 },
  '2026-08-22': { xof: 117000, ventes: 48 },
  '2026-08-23': { xof: 226000, ventes: 72 },
  '2026-08-24': { xof: 145000, ventes: 48 },
  '2026-08-25': { xof: 118000, ventes: 40 },
  '2026-08-26': { xof: 131000, ventes: 47 },
  '2026-08-27': { xof: 38000, ventes: 11 },
};

/** Le dernier jour où Chariow a encaissé quoi que ce soit. */
export const DERNIER_JOUR_CHARIOW = '2026-08-27';

/**
 * Total figé de toute l'ère Chariow.
 *
 * Calculé à la lecture plutôt qu'écrit à la main : un total recopié se
 * désynchronise du détail à la première correction, et personne ne s'en
 * aperçoit avant qu'un partenaire ne compte lui-même.
 */
export function totalChariow(): JourneeFigee {
  return Object.values(HISTOIRE_CHARIOW).reduce(
    (t, j) => ({ xof: t.xof + j.xof, ventes: t.ventes + j.ventes }),
    { xof: 0, ventes: 0 }
  );
}
