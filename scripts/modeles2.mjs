/**
 * LES LEVIERS A, C, D — chacun ajouté SEUL au Poisson de référence, pour que
 * son effet propre soit lisible.
 */
import { depuisButsAttendus } from './banc.mjs';
import { COUPES } from './modeles.mjs';

/**
 * Fabrique commune. Les trois leviers sont des drapeaux : on peut les activer
 * un par un et mesurer exactement ce que chacun apporte.
 */
export function poissonAvance(options = {}) {
  const {
    amorti = 6,
    // LEVIER A — recaler les championnats les uns par rapport aux autres.
    normaliserLigues = false,
    vitesseLigue = 0.03,
    /**
     * Amortissement du coefficient, appliqué au moment de s'en servir.
     *
     * À 1, on fait pleinement confiance à la hiérarchie apprise. En dessous,
     * on la ramène vers l'égalité. Contrôlé le 24 août 2026 : le sommet du
     * classement se reproduit d'une saison à l'autre à 0,06 près, mais le
     * milieu de tableau bouge beaucoup — corrélation de rang 0,62. Amortir
     * est donc une assurance contre une hiérarchie apprise sur trop peu de
     * confrontations.
     */
    puissanceCoef = 1,
    // LEVIER C — donner plus de poids aux matchs récents.
    ponderationTemporelle = false,
    memoire = 40,
    // LEVIER D — forces séparées à domicile et à l'extérieur.
    domicileExterieurSepares = false,
    nom = 'Poisson avance',
  } = options;

  const equipes = new Map();
  const ligues = new Map();
  const coefLigue = new Map();

  const fiche = (id) => {
    if (!equipes.has(id)) equipes.set(id, {
      marques: 0, encaisses: 0, matchs: 0,
      marquesDom: 0, encaissesDom: 0, matchsDom: 0,
      marquesExt: 0, encaissesExt: 0, matchsExt: 0,
      ligues: new Map(),
    });
    return equipes.get(id);
  };
  const ficheLigue = (id) => {
    if (!ligues.has(id)) ligues.set(id, { butsDom: 0, butsExt: 0, matchs: 0 });
    return ligues.get(id);
  };
  const coef = (l) => (l === null || l === undefined ? 1 : (coefLigue.get(l) ?? 1));

  const ligueDe = (id) => {
    const f = equipes.get(id);
    if (!f) return null;
    let meilleure = null, max = 0;
    for (const [l, n] of f.ligues) if (!COUPES.has(l) && n > max) { max = n; meilleure = l; }
    return meilleure;
  };

  const force = (valeur, moyenne, matchs) => {
    if (!moyenne || !matchs) return 1;
    const poids = matchs / (matchs + amorti);
    return 1 + poids * (valeur / moyenne - 1);
  };

  /**
   * Les buts attendus.
   *
   * Isolé pour servir aussi à l'apprentissage du coefficient de championnat :
   * on y compare ce qui était attendu à ce qui est arrivé.
   */
  const attendus = (m) => {
    const lDom = ligueDe(m.dom);
    const lExt = ligueDe(m.ext);
    const refDom = ficheLigue(lDom ?? m.ligue);
    const refExt = ficheLigue(lExt ?? m.ligue);

    // Sans matière, on retombe sur les valeurs universelles du football.
    const moyDom = refDom.matchs ? refDom.butsDom / refDom.matchs : 1.45;
    const moyExt = refExt.matchs ? refExt.butsExt / refExt.matchs : 1.15;
    const moyGen = (r) => (r.matchs ? (r.butsDom + r.butsExt) / (2 * r.matchs) : 1.3);

    const a = fiche(m.dom);
    const b = fiche(m.ext);

    // LEVIER D : à domicile, une équipe n'est pas la même qu'à l'extérieur.
    // Le seuil de trois matchs évite de juger sur une seule rencontre.
    const [aM, aE, aN] = domicileExterieurSepares && a.matchsDom >= 3
      ? [a.marquesDom, a.encaissesDom, a.matchsDom]
      : [a.marques, a.encaisses, a.matchs];
    const [bM, bE, bN] = domicileExterieurSepares && b.matchsExt >= 3
      ? [b.marquesExt, b.encaissesExt, b.matchsExt]
      : [b.marques, b.encaisses, b.matchs];

    const attDom = force(aN ? aM / aN : 0, moyGen(refDom), aN);
    const defDom = force(aN ? aE / aN : 0, moyGen(refDom), aN);
    const attExt = force(bN ? bM / bN : 0, moyGen(refExt), bN);
    const defExt = force(bN ? bE / bN : 0, moyGen(refExt), bN);

    // LEVIER A : deux forces mesurées dans deux championnats ne sont pas
    // comparables. Le coefficient les ramène sur une échelle commune. Il ne
    // s'applique QUE lorsque les championnats diffèrent : à l'intérieur d'un
    // même vivier, il se simplifierait de lui-même.
    let cDom = 1;
    let cExt = 1;
    if (normaliserLigues && lDom !== null && lExt !== null && lDom !== lExt) {
      // L'amortissement s'applique ICI, à l'usage, et non à l'apprentissage :
      // le coefficient continue d'apprendre pleinement, on se contente de le
      // croire avec plus ou moins de force.
      cDom = Math.pow(coef(lDom), puissanceCoef);
      cExt = Math.pow(coef(lExt), puissanceCoef);
    }

    const bornes = (v) => Math.min(4, Math.max(0.25, v));
    return {
      lDom: bornes(attDom * cDom * (defExt / cExt) * moyDom),
      lExt: bornes(attExt * cExt * (defDom / cDom) * moyExt),
      ligueDom: lDom,
      ligueExt: lExt,
    };
  };

  return {
    nom,
    predire(m) {
      const x = attendus(m);
      return depuisButsAttendus(x.lDom, x.lExt);
    },
    apprendre(m) {
      // ── LEVIER A : le coefficient s'apprend des matchs entre championnats ──
      //
      // Eux seuls disent quelque chose de la force RELATIVE de deux
      // championnats. Un match interne ne compare que deux équipes du même
      // vivier : il n'apprend rien sur l'échelle.
      if (normaliserLigues) {
        const x = attendus(m);
        if (x.ligueDom !== null && x.ligueExt !== null && x.ligueDom !== x.ligueExt) {
          const rapportDom = (m.butsDom + 0.5) / (x.lDom + 0.5);
          const rapportExt = (m.butsExt + 0.5) / (x.lExt + 0.5);
          // Marquer plus que prévu fait monter son championnat, en encaisser
          // plus le fait descendre. On avance à petits pas : un seul match ne
          // doit pas redessiner la hiérarchie du continent.
          const pas = Math.exp((vitesseLigue * (Math.log(rapportDom) - Math.log(rapportExt))) / 2);
          const borner = (v) => Math.min(1.6, Math.max(0.6, v));
          coefLigue.set(x.ligueDom, borner(coef(x.ligueDom) * pas));
          coefLigue.set(x.ligueExt, borner(coef(x.ligueExt) / pas));
        }
      }

      const a = fiche(m.dom);
      const b = fiche(m.ext);

      // ── LEVIER C : la mémoire s'efface ──────────────────────────────────
      //
      // Sans oubli, un match d'il y a deux ans pèse autant que celui de
      // dimanche. On escompte donc l'ancien avant d'ajouter le nouveau : au
      // bout de `memoire` matchs, le poids d'une rencontre est divisé par e.
      if (ponderationTemporelle) {
        const oubli = Math.exp(-1 / memoire);
        for (const f of [a, b]) {
          f.marques *= oubli; f.encaisses *= oubli; f.matchs *= oubli;
          f.marquesDom *= oubli; f.encaissesDom *= oubli; f.matchsDom *= oubli;
          f.marquesExt *= oubli; f.encaissesExt *= oubli; f.matchsExt *= oubli;
        }
      }

      a.marques += m.butsDom; a.encaisses += m.butsExt; a.matchs++;
      a.marquesDom += m.butsDom; a.encaissesDom += m.butsExt; a.matchsDom++;
      b.marques += m.butsExt; b.encaisses += m.butsDom; b.matchs++;
      b.marquesExt += m.butsExt; b.encaissesExt += m.butsDom; b.matchsExt++;

      a.ligues.set(m.ligue, (a.ligues.get(m.ligue) ?? 0) + 1);
      b.ligues.set(m.ligue, (b.ligues.get(m.ligue) ?? 0) + 1);

      const l = ficheLigue(m.ligue);
      l.butsDom += m.butsDom; l.butsExt += m.butsExt; l.matchs++;
    },
    coefLigue,
    ligueDe,
  };
}
