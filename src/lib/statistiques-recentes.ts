import { estMatchDePreparation, type StatistiquesEquipe } from './score-probable';

/**
 * CE QU'UNE ÉQUIPE A MARQUÉ ET ENCAISSÉ SUR SES DERNIERS MATCHS JOUÉS.
 *
 * Sert d'ancre au moteur (`melangerStatistiques`) : toutes compétitions et
 * toutes saisons confondues, elle empêche un unique match de championnat de
 * dicter toute la prédiction en début de saison.
 *
 * ── POURQUOI CE FICHIER ───────────────────────────────────────────────────
 *
 * Ce calcul vivait dans la route d'analyse seule. La préparation de la
 * sélection du jour — qui fige aussi les pronostics jugés au mur des preuves —
 * ne l'avait pas, et calculait donc avec un moteur différent de celui que lit
 * l'abonné. Mesuré le 17 septembre 2026 sur 697 matchs joués depuis le
 * 1er septembre : 23 désaccords entre le pronostic figé et l'analyse, dont 14
 * où l'analyse avait raison contre 4. Un seul calcul, partagé, pour ne plus
 * jamais diverger.
 */

/**
 * Quatre rencontres officielles suffisent à décrire une équipe. En dessous,
 * mieux vaut un amical qu'une moyenne calculée sur deux matchs.
 */
const MATCHS_OFFICIELS_SUFFISANTS = 4;

export function statistiquesDepuisMatchs(fixtures: any[], teamId: string): StatistiquesEquipe {
  const termines = (fixtures || []).filter((f: any) =>
    ['FT', 'AET', 'PEN'].includes(f?.fixture?.status?.short)
  );

  // ── LES MATCHS DE PRÉPARATION NE DISENT RIEN DE LA VRAIE FORCE ───────────
  //
  // Un amical d'été se joue avec des remplaçants, sans enjeu, contre ce qui
  // se présente. Les compter à égalité avec une finale européenne fausse tout.
  //
  // Cas mesuré : à la veille du Trophée des Champions, le moteur voyait Lens
  // à 2,00 buts marqués par match et le Paris Saint-Germain à 1,83 — donc
  // Lens devant. Les douze derniers matchs de Lens contenaient un 4-1 contre
  // Boulogne et un 3-0 contre Crystal Palace, tous deux amicaux ; ceux du PSG,
  // un 3-0 encaissé à Majorque avec une équipe remaniée.
  //
  // On les écarte donc — mais seulement s'il reste assez de matchs officiels.
  // En début de saison, un amical vaut mieux que rien.
  const officiels = termines.filter((f: any) => !estMatchDePreparation(f?.league));
  const joues = officiels.length >= MATCHS_OFFICIELS_SUFFISANTS ? officiels : termines;

  let marques = 0;
  let encaisses = 0;
  for (const f of joues) {
    const domicile = String(f?.teams?.home?.id) === String(teamId);
    const bh = Number(f?.goals?.home ?? 0);
    const ba = Number(f?.goals?.away ?? 0);
    marques += domicile ? bh : ba;
    encaisses += domicile ? ba : bh;
  }
  return { butsMarques: marques, butsEncaisses: encaisses, matchsJoues: joues.length };
}
