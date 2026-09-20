/**
 * COMPLÈTE LES BLOCS QUE LE MODÈLE A PU OUBLIER.
 *
 * ── LE DÉFAUT DU 20 SEPTEMBRE 2026 ──────────────────────────────────────
 *
 * Une analyse s'est terminée par l'écran « Cette page n'a pas pu s'afficher »,
 * avec « Cannot read properties of undefined (reading 'team1') ». Le calcul
 * était bon ; c'est la mise en forme qui tombait, parce que le modèle de
 * langage avait rendu un `comparison` — ou un `advancedMetrics` — amputé
 * d'une ligne. L'abonné, lui, perd son analyse et son argent.
 *
 * On ne fait jamais confiance à la forme d'un texte rendu par un modèle. Les
 * valeurs posées ici sont NEUTRES : elles ne racontent rien, elles empêchent
 * seulement la page de tomber. Les chiffres qui comptent — score, issues,
 * confiance — viennent du calcul et sont imposés juste avant.
 */
export function completerLesBlocs(d: any): any {
  if (!d || typeof d !== 'object') return d;

  const nombre = (v: any, defaut: number) => (Number.isFinite(Number(v)) ? Number(v) : defaut);
  /** Une paire team1/team2 complète, quoi qu'il arrive. */
  const paire = (o: any, d1: number, d2 = d1) => ({
    ...(o && typeof o === 'object' ? o : {}),
    team1: nombre(o?.team1, d1),
    team2: nombre(o?.team2, d2),
  });

  // La comparaison : six lignes, toutes affichées côte à côte.
  const comp = d.comparison && typeof d.comparison === 'object' ? d.comparison : {};
  d.comparison = {
    ...comp,
    attack: paire(comp.attack, 50),
    defense: paire(comp.defense, 50),
    form: paire(comp.form, 50),
    h2h: paire(comp.h2h, 50),
    goals: paire(comp.goals, 50),
    global: paire(comp.global, 50),
  };

  // Les prédictions annexes. Les buts attendus viennent du calcul quand il
  // les a posés ; sinon zéro, ce qui n'affirme rien.
  const pre = d.predictions && typeof d.predictions === 'object' ? d.predictions : {};
  d.predictions = {
    ...pre,
    expectedGoals: {
      ...paire(pre.expectedGoals, 0),
      total: nombre(pre.expectedGoals?.total, nombre(pre.expectedGoals?.team1, 0) + nombre(pre.expectedGoals?.team2, 0)),
    },
    cleanSheet: paire(pre.cleanSheet, 0),
    btts: {
      yes: nombre(pre.btts?.yes, 50),
      no: nombre(pre.btts?.no, 50),
    },
    overUnder: {
      over05: nombre(pre.overUnder?.over05, 0),
      over15: nombre(pre.overUnder?.over15, 0),
      over25: nombre(pre.overUnder?.over25, 0),
      over35: nombre(pre.overUnder?.over35, 0),
    },
  };

  // Les mesures avancées : la page les affiche ligne par ligne, et chaque
  // ligne absente la faisait tomber.
  if (d.advancedMetrics && typeof d.advancedMetrics === 'object') {
    const m = d.advancedMetrics;
    d.advancedMetrics = {
      ...m,
      possession: paire(m.possession, 50),
      xG: paire(m.xG, 0),
      xT: paire(m.xT, 0),
      ppda: paire(m.ppda, 10),
    };
  }

  // Les statistiques RÉELLES n'existent que pour un match joué : on ne les
  // invente pas. Présentes, elles doivent être complètes.
  if (d.stats && typeof d.stats === 'object') {
    const st = d.stats;
    d.stats = {
      ...st,
      possession: paire(st.possession, 50),
      shots: paire(st.shots, 0),
      shotsOnTarget: paire(st.shotsOnTarget, 0),
      corners: paire(st.corners, 0),
      fouls: paire(st.fouls, 0),
      passes: paire(st.passes, 0),
    };
  }

  // Les listes : jamais `undefined`, la page les parcourt.
  const liste = (v: any) => (Array.isArray(v) ? v : []);
  const ks = d.keyStrengths && typeof d.keyStrengths === 'object' ? d.keyStrengths : {};
  d.keyStrengths = { ...ks, team1: liste(ks.team1), team2: liste(ks.team2) };
  const kw = d.keyWeaknesses && typeof d.keyWeaknesses === 'object' ? d.keyWeaknesses : {};
  d.keyWeaknesses = { ...kw, team1: liste(kw.team1), team2: liste(kw.team2) };
  d.scenarios = liste(d.scenarios);
  d.keyFactors = liste(d.keyFactors);

  return d;
}
