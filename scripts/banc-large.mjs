/**
 * BANC D'ESSAI LARGE — des milliers de matchs, pas soixante-trois.
 *
 * POURQUOI
 *
 * Sur soixante-trois rencontres, un écart de cinq points peut être du hasard.
 * Une saison complète de cinq championnats en fournit près de deux mille : là,
 * un écart veut dire quelque chose.
 *
 * COMMENT
 *
 * On parcourt la saison journée après journée. Pour chaque match, on ne connaît
 * que les rencontres DÉJÀ jouées à cette date — jamais la suite. C'est
 * exactement la situation d'un abonné qui lance une analyse la veille.
 *
 * Coût : un appel par championnat. Le reste est du calcul.
 */
import fs from 'fs';
import { createJiti } from 'jiti';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

const jiti = createJiti(import.meta.url);
const { apiFootball, CACHE_TTL } = await jiti.import('../src/lib/api-football.ts');

const LIGUES = [
  { id: 39, nom: 'Premier League' },
  { id: 140, nom: 'La Liga' },
  { id: 135, nom: 'Serie A' },
  { id: 78, nom: 'Bundesliga' },
  { id: 61, nom: 'Ligue 1' },
  { id: 94, nom: 'Primeira Liga' },
  { id: 88, nom: 'Eredivisie' },
  { id: 144, nom: 'Jupiler Pro League' },
];
const SAISON = 2025;
const TERMINE = ['FT', 'AET', 'PEN'];

/** Nombre de matchs déjà joués par équipe avant qu'on accepte de prédire. */
const HISTORIQUE_MINIMUM = 5;

const rencontres = [];
for (const l of LIGUES) {
  const d = await apiFootball(`/fixtures?league=${l.id}&season=${SAISON}`, CACHE_TTL.TEAM_INFO);
  const fx = (d?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      ligue: l.id,
      date: new Date(f.fixture.date).getTime(),
      dom: f.teams.home.id,
      ext: f.teams.away.id,
      nomDom: f.teams.home.name,
      nomExt: f.teams.away.name,
      bd: Number(f.goals.home ?? 0),
      be: Number(f.goals.away ?? 0),
    }));
  console.log(`  ${l.nom.padEnd(20)} ${fx.length} matchs terminés`);
  rencontres.push(...fx);
}
rencontres.sort((a, b) => a.date - b.date);
console.log(`\nTotal : ${rencontres.length} matchs\n`);

const poisson = (k, l) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; };
const borner = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX = 8;

/**
 * Ce que sait le championnat à un instant donné.
 *
 * Deux lectures des mêmes matchs :
 *
 *  - BRUTE : buts marqués et encaissés par match, sans se demander contre qui.
 *    C'est ce que fait le moteur aujourd'hui.
 *
 *  - AJUSTÉE : la force d'attaque et de défense de chaque équipe RELATIVEMENT
 *    à celles qu'elle a rencontrées, obtenue en répétant le calcul jusqu'à ce
 *    qu'il se stabilise. Battre le dernier 3-0 n'y vaut pas la même chose que
 *    battre le premier.
 */
class Etat {
  constructor() { this.eq = new Map(); this.butsDom = 0; this.butsExt = 0; this.matchs = 0; }

  ajouter(m) {
    for (const [id, pour, contre, aDom] of [[m.dom, m.bd, m.be, true], [m.ext, m.be, m.bd, false]]) {
      const e = this.eq.get(id) ?? { j: 0, pour: 0, contre: 0, jDom: 0, pourDom: 0, contreDom: 0, jExt: 0, pourExt: 0, contreExt: 0, adv: [] };
      e.j++; e.pour += pour; e.contre += contre;
      if (aDom) { e.jDom++; e.pourDom += pour; e.contreDom += contre; }
      else { e.jExt++; e.pourExt += pour; e.contreExt += contre; }
      e.adv.push({ adversaire: aDom ? m.ext : m.dom, pour, contre, aDom });
      this.eq.set(id, e);
    }
    this.butsDom += m.bd; this.butsExt += m.be; this.matchs++;
  }

  /** Moyenne de buts d'une équipe qui reçoit, et d'une équipe qui se déplace. */
  moyennes() {
    if (this.matchs < 20) return { dom: 1.5, ext: 1.2 };
    return { dom: this.butsDom / this.matchs, ext: this.butsExt / this.matchs };
  }

  /** Forces ajustées par la qualité des adversaires rencontrés. */
  forces() {
    if (this._forces) return this._forces;
    const { dom, ext } = this.moyennes();
    const f = new Map();
    for (const [id] of this.eq) f.set(id, { att: 1, def: 1 });

    for (let tour = 0; tour < 4; tour++) {
      const suivant = new Map();
      for (const [id, e] of this.eq) {
        let attNum = 0, attDen = 0, defNum = 0, defDen = 0;
        for (const a of e.adv) {
          const adv = f.get(a.adversaire) ?? { att: 1, def: 1 };
          const baseP = (a.aDom ? dom : ext) * adv.def;
          const baseC = (a.aDom ? ext : dom) * adv.att;
          attNum += a.pour; attDen += baseP;
          defNum += a.contre; defDen += baseC;
        }
        // AMORTISSEMENT : une équipe vue cinq fois ne mérite pas qu'on la croie
        // autant qu'une équipe vue trente fois. Le poids de ses propres chiffres
        // grandit avec son nombre de matchs.
        const K = 6;
        const p = e.j / (e.j + K);
        suivant.set(id, {
          att: borner(p * (attDen > 0 ? attNum / attDen : 1) + (1 - p) * 1, 0.35, 2.6),
          def: borner(p * (defDen > 0 ? defNum / defDen : 1) + (1 - p) * 1, 0.35, 2.6),
        });
      }
      for (const [id, v] of suivant) f.set(id, v);
    }
    this._forces = f;
    return f;
  }

  invalider() { this._forces = null; }
}

/** Grille de scores et issue, à partir de deux espérances de buts. */
function depuisLambda(l1, l2, rho = 0) {
  const p1 = Array.from({ length: MAX + 1 }, (_, i) => poisson(i, l1));
  const p2 = Array.from({ length: MAX + 1 }, (_, j) => poisson(j, l2));
  // Correction de Dixon-Coles : deux équipes ne marquent pas indépendamment
  // l'une de l'autre. Le Poisson simple sous-estime 0-0 et 1-1 — c'est-à-dire
  // les nuls — et surestime 1-0 et 0-1.
  const tau = (i, j) => {
    if (rho === 0) return 1;
    if (i === 0 && j === 0) return 1 - l1 * l2 * rho;
    if (i === 0 && j === 1) return 1 + l1 * rho;
    if (i === 1 && j === 0) return 1 + l2 * rho;
    if (i === 1 && j === 1) return 1 - rho;
    return 1;
  };
  let v1 = 0, n = 0, v2 = 0;
  const meilleur = { 1: { s: [1, 0], e: Infinity, p: -1 }, 0: { s: [0, 0], e: Infinity, p: -1 }, 2: { s: [0, 1], e: Infinity, p: -1 } };
  for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) {
    const p = p1[i] * p2[j] * tau(i, j);
    const cle = i > j ? 1 : i === j ? 0 : 2;
    if (cle === 1) v1 += p; else if (cle === 0) n += p; else v2 += p;
    const e = Math.abs(i - l1) + Math.abs(j - l2);
    const cur = meilleur[cle];
    if ((p >= cur.p * 0.25 || cur.p < 0) && (e < cur.e || (e === cur.e && p > cur.p))) meilleur[cle] = { s: [i, j], e, p };
  }
  const issue = n >= v1 && n >= v2 ? 0 : v1 >= v2 ? 1 : 2;
  return { score: meilleur[issue].s, probas: [v1, n, v2], issue };
}

// ── LES DEUX MODÈLES ────────────────────────────────────────────────────────

/** Ce que fait le moteur aujourd'hui : moyennes brutes, avantage fixe. */
function modeleActuel(etat, m) {
  const a = etat.eq.get(m.dom), b = etat.eq.get(m.ext);
  const j1 = Math.max(1, a.j), j2 = Math.max(1, b.j);
  const att1 = a.pour / j1, def1 = a.contre / j1;
  const att2 = b.pour / j2, def2 = b.contre / j2;
  const moyenne = Math.max(0.4, (att1 + att2 + def1 + def2) / 4);
  const l1 = borner((att1 / moyenne) * (def2 / moyenne) * moyenne * 1.15, 0.25, 4);
  const l2 = borner((att2 / moyenne) * (def1 / moyenne) * moyenne * 0.92, 0.25, 4);
  return depuisLambda(l1, l2);
}

/** Forces ajustées à l'adversaire, avantage du terrain mesuré sur le championnat. */
function modeleAjuste(etat, m, rho = 0) {
  const f = etat.forces();
  const { dom, ext } = etat.moyennes();
  const a = f.get(m.dom) ?? { att: 1, def: 1 };
  const b = f.get(m.ext) ?? { att: 1, def: 1 };
  const l1 = borner(a.att * b.def * dom, 0.25, 4);
  const l2 = borner(b.att * a.def * ext, 0.25, 4);
  return depuisLambda(l1, l2, rho);
}

// ── Parcours chronologique ──────────────────────────────────────────────────
const etats = new Map();
const calibrage = {};
const resultats = {};
const noter = (nom, m, r) => {
  const s = (resultats[nom] ??= { n: 0, issue: 0, exact: 0, brier: 0, nuls: 0, buts: 0 });
  const iR = m.bd > m.be ? 1 : m.bd === m.be ? 0 : 2;
  s.n++;
  if (r.issue === iR) s.issue++;
  if (r.score[0] === m.bd && r.score[1] === m.be) s.exact++;
  if (r.issue === 0) s.nuls++;
  s.buts += r.score[0] + r.score[1];
  const t = r.probas[0] + r.probas[1] + r.probas[2];
  const reel = [iR === 1 ? 1 : 0, iR === 0 ? 1 : 0, iR === 2 ? 1 : 0];
  s.brier += Math.pow(r.probas[0] / t - reel[0], 2) + Math.pow(r.probas[1] / t - reel[1], 2) + Math.pow(r.probas[2] / t - reel[2], 2);
};

let evalues = 0, butsReels = 0, nulsReels = 0;
for (const m of rencontres) {
  const etat = etats.get(m.ligue) ?? new Etat();
  etats.set(m.ligue, etat);
  const a = etat.eq.get(m.dom), b = etat.eq.get(m.ext);

  if (a && b && a.j >= HISTORIQUE_MINIMUM && b.j >= HISTORIQUE_MINIMUM) {
    noter('moteur actuel', m, modeleActuel(etat, m));
    noter('forces ajustées', m, modeleAjuste(etat, m));
    // Rho NÉGATIF : c'est le signe de la littérature. Positif, la correction
    // faisait l'inverse de ce qu'on attend d'elle — elle effaçait les nuls.
    for (const rho of [-0.05, -0.1, -0.15, -0.2]) noter(`forces ajustées + D-C ${rho}`, m, modeleAjuste(etat, m, rho));
    // Recalibrage direct du nul : la mesure dit qu'il est sous-estimé d'environ
    // cinq points. On le corrige et on renormalise, sans toucher au reste.
    for (const boost of [1.15, 1.25, 1.35]) {
      const r = modeleAjuste(etat, m, -0.1);
      const p = [r.probas[0], r.probas[1] * boost, r.probas[2]];
      const t = p[0] + p[1] + p[2];
      const iss = p[1] >= p[0] && p[1] >= p[2] ? 0 : p[0] >= p[2] ? 1 : 2;
      noter(`nul relevé x${boost}`, m, { score: iss === 0 ? [1, 1] : r.score, probas: p.map((x) => x / t), issue: iss });
    }
    noter('repère : toujours le domicile', m, { score: [2, 1], probas: [1, 0, 0], issue: 1 });

    // CALIBRAGE DU NUL : quand le modèle annonce x % de nul, combien de nuls
    // arrivent vraiment ? Si le chiffre est juste, ne jamais annoncer de nul est
    // le bon choix. S'il est trop bas, c'est là qu'est le gisement.
    const r = modeleAjuste(etat, m, 0.1);
    const t = r.probas[0] + r.probas[1] + r.probas[2];
    const pNul = r.probas[1] / t;
    const seau = Math.min(5, Math.floor(pNul * 20)); // pas de 5 points
    (calibrage[seau] ??= { n: 0, nuls: 0, somme: 0 });
    calibrage[seau].n++;
    calibrage[seau].somme += pNul;
    if (m.bd === m.be) calibrage[seau].nuls++;
    evalues++;
    butsReels += m.bd + m.be;
    if (m.bd === m.be) nulsReels++;
  }

  etat.ajouter(m);
  etat.invalider();
}

console.log(`Matchs évalués : ${evalues}`);
console.log(`Buts réels par match : ${(butsReels / evalues).toFixed(2)} — nuls réels : ${((100 * nulsReels) / evalues).toFixed(1)} %\n`);

for (const [nom, s] of Object.entries(resultats)) {
  console.log(
    `${nom.padEnd(32)} issue ${((100 * s.issue) / s.n).toFixed(1).padStart(5)} % | exact ${((100 * s.exact) / s.n).toFixed(1).padStart(5)} % | nuls annoncés ${((100 * s.nuls) / s.n).toFixed(1).padStart(5)} % | buts ${(s.buts / s.n).toFixed(2)} | Brier ${(s.brier / s.n).toFixed(4)}`
  );
}

console.log('\n=========== LE MODÈLE SAIT-IL RECONNAÎTRE UN NUL ? ===========');
console.log('  Si la probabilité annoncée colle au réel, ne jamais annoncer de nul');
console.log('  est le bon choix. Si elle est trop basse, le gisement est là.\n');
for (const [seau, c] of Object.entries(calibrage).sort()) {
  const annonce = (100 * c.somme) / c.n;
  const reel = (100 * c.nuls) / c.n;
  console.log(
    `  tranche ${String(5 * Number(seau)).padStart(2)}-${5 * Number(seau) + 5} % : ${String(c.n).padStart(4)} matchs — annoncé ${annonce.toFixed(1)} % — réel ${reel.toFixed(1)} %${reel > annonce + 2 ? '   <-- sous-estimé' : ''}`
  );
}
