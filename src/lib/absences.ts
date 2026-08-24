/**
 * LES ABSENTS D'UNE ÉQUIPE, QUAND ON PEUT VRAIMENT LES CONNAÎTRE.
 *
 * ── CE QUE LE FOURNISSEUR REND, ET CE QU'ON EN CROYAIT ────────────────────
 *
 * `/injuries?team=X&season=Y` ne rend pas l'infirmerie du jour. Vérifié le
 * 24 août 2026 sur Arsenal : 220 lignes, 24 joueurs, 52 dates différentes,
 * du 17 août 2025 au 30 mai 2026. C'est l'HISTORIQUE DE TOUTE LA SAISON,
 * blessés guéris compris.
 *
 * Le texte envoyé au modèle prenait les cinq premières lignes de cette liste.
 * Il annonçait donc, comme absents du prochain match, des joueurs revenus
 * depuis des mois — et le modèle en tirait des phrases sur une infirmerie qui
 * n'existait plus. Une information fausse sur un joueur nommé est pire qu'une
 * information absente.
 *
 * ── CE QUI N'EST PAS DISPONIBLE AVANT LE MATCH ───────────────────────────
 *
 * Vérifié le même jour sur Aston Villa — Arsenal du 31 août :
 *
 *   /injuries?fixture=1557377        →  0 absent
 *   /fixtures/lineups?fixture=...    →  0 composition
 *
 * Les compositions n'existent qu'une quarantaine de minutes avant le coup
 * d'envoi. Les absences par match ne se remplissent qu'à l'approche. Aucune
 * des deux ne peut donc entrer dans le CALCUL d'une analyse d'avant-match :
 * ce serait fabriquer un effectif.
 *
 * ── CE QUE FAIT CE FICHIER ────────────────────────────────────────────────
 *
 * Il ne fait qu'une chose : ne retenir que les absences assez récentes pour
 * décrire l'effectif actuel, et se taire quand il n'y en a pas. Rien n'entre
 * dans le calcul du score ; seul le texte cesse de nommer des joueurs guéris.
 */

/** Au-delà, une absence ne dit plus rien de l'effectif du jour. */
const JOURS_DE_VALIDITE = 21;

/** Nombre d'absents cité, au maximum : au-delà c'est une liste, plus une information. */
const MAXIMUM_CITE = 5;

export interface AbsencesRetenues {
  /** Les noms retenus, dédoublonnés. Vide quand rien n'est utilisable. */
  noms: string[];
  /** La date des absences retenues, pour pouvoir la citer. */
  dateConstat: string | null;
}

type LigneBlessure = {
  player?: { name?: string | null; type?: string | null } | null;
  fixture?: { date?: string | null } | null;
};

/**
 * Les absents crédibles d'une équipe à la date d'un match donné.
 *
 * @param reponse   Le tableau rendu par `/injuries`, quel que soit son âge.
 * @param dateMatch Date du match analysé. Absente, on se réfère à maintenant.
 * @param maintenant Passé plutôt que lu, pour que les épreuves ne périment pas.
 */
export function absencesRetenues(
  reponse: unknown,
  dateMatch: string | null | undefined,
  maintenant: number = Date.now()
): AbsencesRetenues {
  const lignes = Array.isArray(reponse) ? (reponse as LigneBlessure[]) : [];
  if (!lignes.length) return { noms: [], dateConstat: null };

  // La référence : le match à venir s'il est connu, sinon l'instant présent.
  // Une absence constatée APRÈS le match analysé ne le concerne pas — cela
  // arrive quand on rejoue une vieille rencontre.
  const reference = dateMatch ? Date.parse(dateMatch) : maintenant;
  if (!Number.isFinite(reference)) return { noms: [], dateConstat: null };

  // On regroupe par date de constat, et l'on ne garde que la plus récente qui
  // précède le match. Mélanger deux dates ferait cohabiter un joueur sorti de
  // l'infirmerie et son remplaçant blessé depuis.
  let meilleureDate = -Infinity;
  for (const l of lignes) {
    const d = Date.parse(String(l?.fixture?.date ?? ''));
    if (!Number.isFinite(d) || d > reference) continue;
    if (d > meilleureDate) meilleureDate = d;
  }

  if (meilleureDate === -Infinity) return { noms: [], dateConstat: null };

  // Trop vieille pour décrire l'effectif d'aujourd'hui : on se tait.
  if ((reference - meilleureDate) / 86_400_000 > JOURS_DE_VALIDITE) {
    return { noms: [], dateConstat: null };
  }

  const noms: string[] = [];
  const vus = new Set<string>();
  for (const l of lignes) {
    if (Date.parse(String(l?.fixture?.date ?? '')) !== meilleureDate) continue;
    const nom = String(l?.player?.name ?? '').trim();
    if (!nom || vus.has(nom)) continue;
    vus.add(nom);
    noms.push(nom);
    if (noms.length >= MAXIMUM_CITE) break;
  }

  return { noms, dateConstat: new Date(meilleureDate).toISOString() };
}

/**
 * La ligne à écrire dans le texte envoyé au modèle.
 *
 * « Non communiqué » plutôt que « Aucune » : les deux ne veulent pas dire la
 * même chose, et affirmer qu'une équipe est au complet quand on n'en sait
 * rien est une invention comme une autre.
 */
export function ligneAbsences(a: AbsencesRetenues): string {
  if (!a.noms.length) return 'Non communiqué (le fournisseur ne publie pas les absents avant le coup d\'envoi)';
  const jour = a.dateConstat ? new Date(a.dateConstat).toISOString().slice(0, 10) : null;
  return `${a.noms.join(', ')}${jour ? ` (constaté le ${jour})` : ''}`;
}
