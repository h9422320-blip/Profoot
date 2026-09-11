/**
 * LA PORTE DU CHALLENGER : CE QU'UN RÉGLAGE DOIT PROUVER POUR ÊTRE PROPOSÉ.
 *
 * Fonctions pures, sans réseau ni fichier, vérifiées par
 * `tests/challenger-porte.test.ts`.
 *
 * ── LA RÈGLE, ET D'OÙ ELLE VIENT ──────────────────────────────────────────
 *
 * C'est la discipline qui a fermé une douzaine de fausses pistes sur ce
 * projet, écrite une fois pour toutes et appliquée chaque nuit sans fatigue :
 *
 *   1. mêmes matchs pour tous — champion et variante sont jugés sur les
 *      mêmes rencontres, coupées en deux moitiés dans le temps ;
 *   2. assez de matchs — en dessous, un écart n'est que du bruit ;
 *   3. meilleur VAINQUEUR ANNONCÉ dans les DEUX moitiés — c'est le critère
 *      du propriétaire : « quand il dit que cette équipe gagne, que cette
 *      équipe gagne » ;
 *   4. Brier non dégradé — on ne gagne pas des vainqueurs en racontant
 *      n'importe quoi sur les pourcentages ;
 *   5. matchs sûrs non dégradés — ce sont eux que l'abonné ouvre en premier ;
 *   6. plusieurs nuits gagnées — une nuit heureuse peut être un coup de chance.
 */

export type Pronostic = {
  id: number;
  date: string;
  ligue: number;
  /** Issue réelle : 0 domicile, 1 nul, 2 extérieur. */
  reel: number;
  /** Issue du score ANNONCÉ — ce que l'abonné lit : « Victoire de … ». */
  parScore: number;
  /** Probabilités domicile, nul, extérieur, de somme 1. */
  probas: number[];
};

export type Mesure = {
  n: number;
  /** Vainqueurs annoncés justes. */
  justes: number;
  brier: number;
  /** Matchs où le moteur est sûr de lui (≥ SEUIL_SUR), et combien justes. */
  surs: number;
  sursJustes: number;
};

export const SEUIL_SUR = 0.6;
export const MATCHS_MINIMUM_PAR_MOITIE = 150;
/** Une variante n'est proposée qu'après autant de nuits gagnantes… */
export const NUITS_POUR_PROPOSER = 2;
/** …parmi les dernières nuits que voici. */
export const FENETRE_NUITS = 3;

export function mesurer(liste: Pronostic[]): Mesure {
  let justes = 0, brier = 0, surs = 0, sursJustes = 0;
  for (const p of liste) {
    if (p.parScore === p.reel) justes++;
    brier += p.probas.reduce((s, v, i) => s + (v - (i === p.reel ? 1 : 0)) ** 2, 0);
    const max = Math.max(...p.probas);
    if (max >= SEUIL_SUR) {
      surs++;
      if (p.probas.indexOf(max) === p.reel) sursJustes++;
    }
  }
  return { n: liste.length, justes, brier: liste.length ? brier / liste.length : 0, surs, sursJustes };
}

/** Deux moitiés chronologiques, toujours découpées de la même façon. */
export function moities(liste: Pronostic[]): [Pronostic[], Pronostic[]] {
  const triee = [...liste].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const m = Math.floor(triee.length / 2);
  return [triee.slice(0, m), triee.slice(m)];
}

export type Verdict = { gagne: boolean; raisons: string[] };

export function verdict(champion: [Mesure, Mesure], challenger: [Mesure, Mesure]): Verdict {
  const raisons: string[] = [];
  let gagne = true;
  for (const k of [0, 1] as const) {
    const a = champion[k];
    const b = challenger[k];
    const nom = k === 0 ? '1re moitié' : '2e moitié';
    if (a.n !== b.n) {
      gagne = false;
      raisons.push(`${nom} : pas jugés sur les mêmes matchs (${a.n} contre ${b.n})`);
      continue;
    }
    if (a.n < MATCHS_MINIMUM_PAR_MOITIE) {
      gagne = false;
      raisons.push(`${nom} : ${a.n} matchs, il en faut ${MATCHS_MINIMUM_PAR_MOITIE}`);
    }
    if (b.justes < a.justes + 1) {
      gagne = false;
      raisons.push(`${nom} : ${b.justes} vainqueurs justes contre ${a.justes}`);
    }
    if (b.brier > a.brier) {
      gagne = false;
      raisons.push(`${nom} : Brier ${b.brier.toFixed(4)} contre ${a.brier.toFixed(4)}`);
    }
    const pa = a.surs >= 10 ? a.sursJustes / a.surs : null;
    const pb = b.surs >= 10 ? b.sursJustes / b.surs : null;
    if (pa !== null && pb !== null && pb < pa - 0.01) {
      gagne = false;
      raisons.push(`${nom} : matchs sûrs ${(100 * pb).toFixed(1)} % contre ${(100 * pa).toFixed(1)} %`);
    }
  }
  if (gagne) raisons.push('plus de vainqueurs justes dans les deux moitiés, rien de dégradé');
  return { gagne, raisons };
}

/** A-t-elle gagné assez de nuits récentes pour être proposée ? */
export function aProposer(
  historique: { nuit: string; variante: string; gagne: boolean }[],
  variante: string
): boolean {
  const nuits = [...new Set(historique.map((h) => h.nuit))].sort().slice(-FENETRE_NUITS);
  const gagnees = nuits.filter((n) => historique.some((h) => h.nuit === n && h.variante === variante && h.gagne)).length;
  return gagnees >= NUITS_POUR_PROPOSER;
}
