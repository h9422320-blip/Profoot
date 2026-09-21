/**
 * LA FORCE DE CHAQUE SÉLECTION NATIONALE — UNE COUCHE DU MOTEUR.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────
 *
 * Demande du propriétaire, le 21 septembre 2026, pendant la trêve : « connaître
 * toutes les équipes nationales, européennes, africaines, américaines ». Le
 * moteur jugeait une sélection sur ses statistiques DANS la compétition en
 * cours et sur sa forme récente. Or à la première journée d'une
 * qualification, la compétition n'a encore rien joué, et une sélection ne
 * joue que dix matchs par an : sa « forme » mélange un amical contre les
 * Comores et une demi-finale de CAN.
 *
 * ── CE QUE LA COUCHE APPORTE ─────────────────────────────────────────────
 *
 * Un classement Elo — la méthode du classement mondial de référence — calculé
 * sur 9 819 matchs internationaux de sélections A depuis 2014 : Coupe du
 * monde, Euro, CAN, Copa América, Coupe d'Asie, Gold Cup, Ligues des nations,
 * toutes les qualifications, les coupes régionales et les amicaux. Chaque
 * match compte selon son importance (60 en Coupe du monde, 20 en amical) et
 * son écart de buts.
 *
 * Mesuré en marche avant sur 4 626 matchs de 2022 à 2026, chaque match prédit
 * avec la note connue la veille :
 *
 *     la note Elo                          56,5 %
 *     les moyennes de buts (10 derniers)   52,0 %
 *     la forme (5 derniers)                50,2 %
 *
 * Et en la mêlant à la lecture des buts, comme le moteur mêle déjà l'avis du
 * marché et celui de la mémoire des clubs :
 *
 *     part Elo 0      53,2 %   Brier 0,5862   sûrs 71,9 % sur 918
 *     part Elo 0,5    56,8 %   Brier 0,5509   sûrs 75,3 % sur 1 455
 *     part Elo 0,75   57,2 %   Brier 0,5438   sûrs 73,8 % sur 1 823   ← retenu
 *     part Elo 1      56,5 %   Brier 0,5437   sûrs 70,8 % sur 2 192
 *
 * Environ 185 bons vainqueurs de plus sur 4 626 matchs.
 *
 * ── CE QU'ELLE NE FAIT PAS ───────────────────────────────────────────────
 *
 * Elle ne touche AUCUN club : les identifiants des sélections ne croisent
 * jamais ceux des clubs chez le fournisseur. Elle se tait quand l'une des deux
 * sélections a joué moins de dix matchs connus. Elle cède la place à l'avis du
 * marché s'il existe. Et une réserve absente la rend muette : l'analyse
 * calcule alors exactement comme avant.
 *
 * ── D'OÙ VIENNENT LES NOTES ──────────────────────────────────────────────
 *
 * Recalculées chaque jour sur l'ordinateur du challenger
 * (`scripts/challenger/elo-selections-publier.mts`) et rangées dans la réserve
 * partagée : relire dix mille matchs n'est pas possible en soixante secondes.
 */

import { lireReservePatiemment } from './api-football';

export const CLE_ELO_SELECTIONS = 'selections:elo:v1';

/** La part de l'avis Elo, mesurée ci-dessus. */
export const PART_ELO_SELECTIONS = 0.75;

/** Sous ce nombre de matchs connus, la note d'une sélection n'est pas encore fiable. */
export const MATCHS_MINIMUM_ELO = 10;

/** Avantage de celui qui reçoit, en points Elo — nul en phase finale de tournoi. */
export const AVANTAGE_TERRAIN_ELO = 100;

/**
 * Les phases finales, jouées presque toujours sur terrain neutre : Coupe du
 * monde, Euro, CAN, Coupe d'Asie, Copa América, Gold Cup, Confédérations,
 * Finalissima, Océanie, barrages intercontinentaux, CHAN, coupes régionales.
 */
export const PHASES_FINALES: ReadonlySet<number> = new Set([1, 4, 6, 7, 9, 22, 21, 913, 806, 37, 19, 25, 860, 535, 859]);

export interface ReserveEloSelections {
  calculeLe: string;
  /** Note Elo par identifiant de sélection chez le fournisseur. */
  notes: Record<string, number>;
  /** Matchs connus par sélection. */
  joues: Record<string, number>;
  /**
   * Par tranche de 50 points d'écart (−12 à +12), combien de victoires à
   * domicile, de nuls et de victoires à l'extérieur ont été observés.
   */
  tranches: Record<string, [number, number, number]>;
}

let memoire: { quand: number; contenu: ReserveEloSelections | null } | null = null;

/** Les notes, depuis la réserve. Dix minutes de mémoire : elles changent une fois par jour. */
export async function lireEloSelections(): Promise<ReserveEloSelections | null> {
  if (memoire && Date.now() - memoire.quand < 10 * 60 * 1000) return memoire.contenu;
  try {
    // Une réserve périmée reste utile : les notes bougent lentement.
    const lu = await lireReservePatiemment<ReserveEloSelections>(CLE_ELO_SELECTIONS);
    const contenu = lu && lu.notes ? lu : null;
    // Un échec n'est pas gardé : on retentera à la prochaine analyse.
    if (contenu) memoire = { quand: Date.now(), contenu };
    return contenu;
  } catch {
    return null;
  }
}

/** Probabilités domicile / nul / extérieur pour un écart de notes, lissées sur trois tranches. */
export function probabilitesPourEcart(
  tranches: Record<string, [number, number, number]>,
  ecart: number
): [number, number, number] {
  const k = Math.max(-12, Math.min(12, Math.round(ecart / 50)));
  const somme: [number, number, number] = [1, 1, 1];
  for (const [d, poids] of [[0, 2], [-1, 1], [1, 1]] as [number, number][]) {
    const c = tranches[String(k + d)];
    if (c) for (let i = 0; i < 3; i++) somme[i] += poids * Number(c[i] ?? 0);
  }
  const total = somme[0] + somme[1] + somme[2];
  return [somme[0] / total, somme[1] / total, somme[2] / total];
}

/**
 * L'avis Elo sur une rencontre de sélections, vu de celle qui reçoit — ou
 * `null` quand l'une des deux n'est pas une sélection connue.
 *
 * Rend exactement la forme qu'attend le moteur pour un avis extérieur :
 * `{ dom, nul, ext, poids }`, comme l'avis du marché et celui de la mémoire.
 */
export function avisEloPour(
  reserve: ReserveEloSelections | null,
  domicile: number | string | null | undefined,
  exterieur: number | string | null | undefined,
  ligue: number | string | null | undefined
): { dom: number; nul: number; ext: number; poids: number } | null {
  if (!reserve || !domicile || !exterieur) return null;
  const n1 = reserve.notes[String(domicile)];
  const n2 = reserve.notes[String(exterieur)];
  if (!Number.isFinite(n1) || !Number.isFinite(n2)) return null;
  if ((reserve.joues[String(domicile)] ?? 0) < MATCHS_MINIMUM_ELO) return null;
  if ((reserve.joues[String(exterieur)] ?? 0) < MATCHS_MINIMUM_ELO) return null;
  const neutre = PHASES_FINALES.has(Number(ligue));
  const [dom, nul, ext] = probabilitesPourEcart(reserve.tranches, n1 - n2 + (neutre ? 0 : AVANTAGE_TERRAIN_ELO));
  return { dom, nul, ext, poids: PART_ELO_SELECTIONS };
}

/** Une couche ne fait jamais tomber une analyse : la moindre erreur la rend muette. */
export async function coucheEloSelections(
  domicile: number | string | null | undefined,
  exterieur: number | string | null | undefined,
  ligue: number | string | null | undefined
): Promise<{ dom: number; nul: number; ext: number; poids: number } | null> {
  try {
    return avisEloPour(await lireEloSelections(), domicile, exterieur, ligue);
  } catch (e: any) {
    console.warn('[ELO SÉLECTIONS] Couche ignorée pour cette analyse :', e?.message);
    return null;
  }
}
