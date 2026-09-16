/**
 * LE REPOS ENTRE DEUX MATCHS.
 *
 * ── CE QUE LE MOTEUR NE VOYAIT PAS DU TOUT ───────────────────────────────
 *
 * Il juge deux clubs sur leurs moyennes, leurs occasions et leur classement,
 * sans jamais savoir que l'un a joué trois jours plus tôt et l'autre neuf. Une
 * équipe qui enchaîne coupe d'Europe et championnat ne produit pas ce que sa
 * moyenne annonce — et cela n'apparaît ni dans ses occasions, ni dans son
 * classement, ni dans sa forme récente : ses trois derniers matchs peuvent
 * avoir été excellents ET l'avoir épuisée.
 *
 * ── CE QUE ÇA VAUT, MESURÉ ───────────────────────────────────────────────
 *
 * Banc d'essai du 16 septembre 2026, 16 588 rencontres rejouées avec les seules
 * données de la veille, sur un banc aligné sur la production en six points :
 *
 *     poids 0,05 plafond 14 j   +8 / +5 vainqueurs justes   ← retenu
 *     poids 0,055               +10 / +6
 *     poids 0,07                 +9 / +11
 *     poids 0,05 plafond 13 j    +8 / +5
 *     poids 0,05 plafond 15 j    +6 / +4
 *
 * SEIZE réglages essayés au total, de 0,03 à 0,12 de poids et de 7 à 16 jours
 * de plafond : PAS UN SEUL ne perd. C'est un plateau, la signature d'un effet
 * réel — sous le hasard, la moitié serait négative. Six d'entre eux tiennent
 * même en trois tranches de temps, une épreuve plus dure que la porte.
 *
 * Le réglage retenu est celui qui passe la porte ENTIÈREMENT — plus de
 * vainqueurs justes dans les deux moitiés, Brier égal ou meilleur, et la
 * justesse des matchs mis en avant qui monte de 70,5 % à 71,8 % et 71,3 %.
 * C'est aussi le poids le plus prudent du plateau.
 *
 * ── LA CORRECTION PORTE SUR L'ÉCART, JAMAIS SUR LE REPOS ABSOLU ──────────
 *
 * Deux équipes également fatiguées ne doivent rien changer au pronostic : ce
 * qui compte est la DIFFÉRENCE. Et elle est plafonnée — au-delà de deux
 * semaines, un jour de plus ne dit plus rien, et une coupure de trêve
 * internationale fausserait tout.
 *
 * ── ELLE NE COÛTE AUCUN APPEL ────────────────────────────────────────────
 *
 * La route d'analyse demande déjà les douze derniers matchs de chaque club,
 * toutes compétitions confondues, pour son ancre de statistiques. La date du
 * dernier match s'y lit sans rien demander de plus.
 */

/** Ce qu'un match terminé vaut comme repère de date. */
const TERMINE = ['FT', 'AET', 'PEN'];

/**
 * Le poids de la correction, en buts, à écart de repos maximal.
 *
 * Cinq centièmes de but : volontairement petit. Le repos n'est pas un moteur,
 * c'est un ajustement — et le plateau mesuré montre que pousser plus fort
 * n'apporte rien de sûr.
 */
export const POIDS_REPOS = 0.05;

/** Au-delà, un jour de repos de plus ne dit plus rien. */
export const PLAFOND_JOURS = 14;

/**
 * La date du dernier match TERMINÉ d'un club avant une date donnée.
 *
 * Rend `null` quand rien n'est lisible : sans repère, la couche se tait
 * plutôt que d'inventer un repos.
 */
export function derniereRencontreAvant(fixtures: unknown, avant: number): number | null {
  const liste = Array.isArray((fixtures as { response?: unknown })?.response)
    ? ((fixtures as { response: unknown[] }).response as any[])
    : Array.isArray(fixtures)
      ? (fixtures as any[])
      : [];

  let derniere: number | null = null;
  for (const f of liste) {
    if (!TERMINE.includes(f?.fixture?.status?.short)) continue;
    const t = Date.parse(String(f?.fixture?.date ?? ''));
    if (!Number.isFinite(t) || t >= avant) continue;
    if (derniere === null || t > derniere) derniere = t;
  }
  return derniere;
}

/**
 * La correction du repos, en buts, exprimée du point de vue de CELUI QUI
 * REÇOIT et de CELUI QUI SE DÉPLACE.
 *
 * C'est le sens qu'attend `calculerScoreProbable` : il la remet lui-même dans
 * l'ordre des deux équipes selon qui joue à domicile. Se tromper de sens
 * appliquerait la correction à l'envers une fois sur deux.
 */
export function correctionRepos(
  quandLeMatch: number | null | undefined,
  derniereDuRecevant: number | null,
  derniereDuVisiteur: number | null,
  poids: number = POIDS_REPOS,
  plafondJours: number = PLAFOND_JOURS
): { domicile: number; exterieur: number } | null {
  const quand = Number(quandLeMatch);
  if (!Number.isFinite(quand)) return null;
  if (derniereDuRecevant === null || derniereDuVisiteur === null) return null;
  if (!(plafondJours > 0)) return null;

  const reposDe = (derniere: number) =>
    Math.min(plafondJours, Math.max(0, (quand - derniere) / 86_400_000));

  const ecart = (reposDe(derniereDuRecevant) - reposDe(derniereDuVisiteur)) / plafondJours;
  if (!Number.isFinite(ecart) || ecart === 0) return null;

  return { domicile: poids * ecart, exterieur: -poids * ecart };
}

/**
 * Additionne deux corrections exprimées en buts.
 *
 * Le moteur n'a qu'UN point d'entrée pour les corrections en buts. Empiler
 * l'élan, le terrain et le repos y passe donc par une somme — et c'est aussi
 * ce que fait le banc d'essai, à la ligne près.
 */
export function sommeDesCorrections(
  ...corrections: ({ domicile: number; exterieur: number } | null | undefined)[]
): { domicile: number; exterieur: number } | null {
  let domicile = 0;
  let exterieur = 0;
  let quelqueChose = false;
  for (const c of corrections) {
    if (!c) continue;
    const d = Number(c.domicile);
    const e = Number(c.exterieur);
    if (!Number.isFinite(d) || !Number.isFinite(e)) continue;
    domicile += d;
    exterieur += e;
    quelqueChose = true;
  }
  if (!quelqueChose) return null;
  if (domicile === 0 && exterieur === 0) return null;
  return { domicile, exterieur };
}
