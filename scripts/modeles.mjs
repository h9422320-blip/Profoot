/**
 * LES MODÈLES MIS EN CONCURRENCE.
 *
 * Chacun expose la même chose : `predire(match)` avant que le match soit joué,
 * puis `apprendre(match)` une fois le résultat connu. Le banc les appelle dans
 * cet ordre, match après match, dans l'ordre du calendrier.
 */
import { depuisButsAttendus, issueReelle, normaliser } from './banc.mjs';

/** Les coupes européennes : elles ne sont le championnat de personne. */
export const COUPES = new Set([2, 3, 848, 531]);

/* ══════════════════════════════════════════════════════════════════════════
   RÉFÉRENCE — « le domicile gagne »
   Le seuil qu'un modèle doit franchir pour mériter d'exister.
   ══════════════════════════════════════════════════════════════════════════ */
export function referenceDomicile() {
  const compte = { dom: 1, nul: 1, ext: 1 };
  return {
    nom: 'Reference : le domicile gagne',
    predire() {
      // Les fréquences de base observées jusqu'ici : c'est la meilleure
      // probabilité qu'on puisse annoncer sans rien savoir des équipes.
      return { probas: normaliser(compte), score: [1, 0] };
    },
    apprendre(m) { compte[issueReelle(m)]++; },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   MODÈLE A — POISSON PAR CHAMPIONNAT  (ce que fait la production)
   Attaque et défense mesurées À L'INTÉRIEUR du championnat de chaque équipe.
   ══════════════════════════════════════════════════════════════════════════ */
export function poissonParLigue(options = {}) {
  const { amorti = 6, nom = 'A. Poisson par championnat' } = options;

  const equipes = new Map();   // id → {marques, encaisses, matchs, ligues:Map}
  const ligues = new Map();    // id → {butsDom, butsExt, matchs}

  const fiche = (id) => {
    if (!equipes.has(id)) equipes.set(id, { marques: 0, encaisses: 0, matchs: 0, ligues: new Map() });
    return equipes.get(id);
  };
  const ficheLigue = (id) => {
    if (!ligues.has(id)) ligues.set(id, { butsDom: 0, butsExt: 0, matchs: 0 });
    return ligues.get(id);
  };

  /** Le championnat d'une équipe : celui où elle joue le plus, hors coupe. */
  const ligueDe = (id) => {
    const f = equipes.get(id);
    if (!f) return null;
    let meilleure = null, max = 0;
    for (const [l, n] of f.ligues) if (!COUPES.has(l) && n > max) { max = n; meilleure = l; }
    return meilleure;
  };

  /** Force ramenée vers 1 tant que l'équipe est peu vue : sinon, deux matchs suffisent à la déclarer invincible. */
  const force = (valeur, moyenne, matchs) => {
    if (!moyenne || !matchs) return 1;
    const poids = matchs / (matchs + amorti);
    return 1 + poids * (valeur / moyenne - 1);
  };

  return {
    nom,
    predire(m) {
      const lDom = ligueDe(m.dom), lExt = ligueDe(m.ext);
      const refDom = ficheLigue(lDom ?? m.ligue), refExt = ficheLigue(lExt ?? m.ligue);

      // Moyennes de buts du championnat de chacun. Sans matière, on retombe
      // sur les valeurs universelles du football : 1,45 à domicile, 1,15 dehors.
      const moyDom = refDom.matchs ? refDom.butsDom / refDom.matchs : 1.45;
      const moyExt = refExt.matchs ? refExt.butsExt / refExt.matchs : 1.15;
      const moyMarqueDom = refDom.matchs ? (refDom.butsDom + refDom.butsExt) / (2 * refDom.matchs) : 1.3;
      const moyMarqueExt = refExt.matchs ? (refExt.butsDom + refExt.butsExt) / (2 * refExt.matchs) : 1.3;

      const a = fiche(m.dom), b = fiche(m.ext);
      const attDom = force(a.matchs ? a.marques / a.matchs : 0, moyMarqueDom, a.matchs);
      const defDom = force(a.matchs ? a.encaisses / a.matchs : 0, moyMarqueDom, a.matchs);
      const attExt = force(b.matchs ? b.marques / b.matchs : 0, moyMarqueExt, b.matchs);
      const defExt = force(b.matchs ? b.encaisses / b.matchs : 0, moyMarqueExt, b.matchs);

      const bornes = (v) => Math.min(4, Math.max(0.25, v));
      return depuisButsAttendus(bornes(attDom * defExt * moyDom), bornes(attExt * defDom * moyExt));
    },
    apprendre(m) {
      const a = fiche(m.dom), b = fiche(m.ext);
      a.marques += m.butsDom; a.encaisses += m.butsExt; a.matchs++;
      b.marques += m.butsExt; b.encaisses += m.butsDom; b.matchs++;
      a.ligues.set(m.ligue, (a.ligues.get(m.ligue) ?? 0) + 1);
      b.ligues.set(m.ligue, (b.ligues.get(m.ligue) ?? 0) + 1);
      const l = ficheLigue(m.ligue);
      l.butsDom += m.butsDom; l.butsExt += m.butsExt; l.matchs++;
    },
    ligueDe,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   MODÈLE B — ELO, UNE ÉCHELLE UNIQUE POUR TOUT LE MONDE
   Une note continue mise à jour par les résultats. Elle traverse les
   frontières sans rien demander : battre le Bayern rapporte, où qu'on joue.
   ══════════════════════════════════════════════════════════════════════════ */
export function elo(options = {}) {
  const { K = 20, avantageDom = 60, nom = 'B. Elo (echelle unique)' } = options;
  const notes = new Map();
  const note = (id) => notes.get(id) ?? 1500;

  // La conversion « écart de note → probabilités » n'est PAS supposée : elle
  // est APPRISE des résultats déjà vus. Chaque tranche d'écart garde le compte
  // de ce qui est réellement arrivé, ce qui rend le modèle calibré d'office.
  const tranches = new Map();
  const trancheDe = (ecart) => Math.max(-8, Math.min(8, Math.round(ecart / 50)));
  const fiche = (t) => {
    if (!tranches.has(t)) tranches.set(t, { dom: 1, nul: 1, ext: 1 });
    return tranches.get(t);
  };

  return {
    nom,
    note,
    predire(m) {
      const ecart = note(m.dom) + avantageDom - note(m.ext);
      // On agrège les tranches voisines : une tranche isolée sur peu de matchs
      // donnerait une probabilité tirée du hasard.
      const t = trancheDe(ecart);
      const c = { dom: 0, nul: 0, ext: 0 };
      for (let d = -1; d <= 1; d++) {
        const f = tranches.get(t + d);
        if (!f) continue;
        const poids = d === 0 ? 2 : 1;
        c.dom += f.dom * poids; c.nul += f.nul * poids; c.ext += f.ext * poids;
      }
      if (!c.dom && !c.nul && !c.ext) { c.dom = 1; c.nul = 1; c.ext = 1; }
      const probas = normaliser(c);

      // Elo ne dit rien du nombre de buts : le score vient d'un Poisson calé
      // sur les probabilités d'issue, pour rester cohérent avec elles.
      const total = 2.7;
      const partDom = Math.min(0.8, Math.max(0.2, 0.5 + (ecart / 1000)));
      return { probas, score: depuisButsAttendus(total * partDom, total * (1 - partDom)).score };
    },
    apprendre(m) {
      const ecart = note(m.dom) + avantageDom - note(m.ext);
      fiche(trancheDe(ecart))[issueReelle(m)]++;

      const attendu = 1 / (1 + Math.pow(10, -ecart / 400));
      const reel = m.butsDom > m.butsExt ? 1 : m.butsDom === m.butsExt ? 0.5 : 0;
      // L'ampleur du succès compte : un 4-0 informe plus qu'un 1-0.
      const marge = Math.abs(m.butsDom - m.butsExt);
      const ampleur = Math.log(marge + 1) || 1;
      const delta = K * ampleur * (reel - attendu);
      notes.set(m.dom, note(m.dom) + delta);
      notes.set(m.ext, note(m.ext) - delta);
    },
  };
}
