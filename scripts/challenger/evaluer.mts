/**
 * UNE ÉVALUATION DU CHALLENGER, DANS SON PROPRE PROCESSUS.
 *
 * ── CE QUI EST REJOUÉ ─────────────────────────────────────────────────────
 *
 * Les matchs des sept grands championnats, de la Ligue des champions et de
 * l'Europa League, entre `debut` et `fin`. Pour chacun, avec seulement ce qui
 * était connu la veille :
 *
 *   - les statistiques de la compétition du match, saison en cours, comme
 *     les lit le pré-calcul — un match sans elles est sauté, comme en
 *     production ;
 *   - le relevé des tirs, reconstruit par le VRAI calcul,
 *     `forcesDepuisRencontres`, sur les 240 jours précédents ;
 *   - le VRAI `calculerScoreProbable`.
 *
 * ── LES COUCHES ───────────────────────────────────────────────────────────
 *
 * Depuis la décision du propriétaire du 11 septembre 2026, on n'essaie plus
 * de variantes des réglages existants : on essaie des COUCHES posées
 * par-dessus le moteur.
 *
 *   erreurs-clubs  ce que le moteur a appris de ses erreurs, club par club —
 *                  n'apprend que des JOURS PRÉCÉDENTS ;
 *   marche         l'avis du marché sur qui domine — n'agit que sur les
 *                  matchs cotés, et la liste de ces matchs est rendue avec
 *                  le résultat pour qu'on la juge sur eux seuls.
 *
 * Usage : `npx tsx scripts/challenger/evaluer.mts <tâche.json>`
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS, FICHIER_COTES, GRANDS, COUPES_SUIVIES } from './commun.mjs';
import type { Pronostic } from './porte.js';

type Couche =
  | { type: 'erreurs-clubs'; retrecissement: number; poids: number }
  | { type: 'marche'; poids: number }
  | { type: 'elo'; k: number; poids: number }
  | { type: 'terrain'; retrecissement: number; poids: number }
  | { type: 'duel'; retrecissement: number; poids: number };

chargerEnv();
const tache: {
  debut: string;
  fin: string;
  variantes: { nom: string; env: Record<string, string>; couche?: Couche }[];
  /**
   * ── LE BANC ÉLARGI, AJOUTÉ LE 12 SEPTEMBRE 2026 ──────────────────────
   *
   * Par défaut (champ absent), le rejeu porte sur les 7 grands
   * championnats + C1 + C3 : le périmètre du produit, celui de l'épreuve
   * officielle, INCHANGÉ.
   *
   * `'cotes'` rejoue À LA PLACE toutes les rencontres COTÉES, quelle que
   * soit la compétition. La couche du marché n'agit que sur celles-là, et
   * le périmètre étroit n'en compte que 188 contre 1 035 au total : la
   * porte refusait faute de matchs, pas faute de résultats.
   */
  univers?: 'suivies' | 'cotes';
  sortie: string;
} = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Chargés APRÈS l'environnement : les réglages du relevé sont lus à l'import.
const { calculerScoreProbable } = await import('../../src/lib/score-probable.js');
const { forcesDepuisRencontres, butsAttendusOccasions } = await import('../../src/lib/forme-occasions.js');
const { apprendreErreurs, correctionPour } = await import('../../src/lib/couche-erreurs.js');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
rencontres.sort((a, b) => a.date.localeCompare(b.date));
const tirs: any[] = JSON.parse(fs.readFileSync(FICHIER_TIRS, 'utf8'));
const cotes: Record<string, { dom: number; nul: number; ext: number }> = fs.existsSync(FICHIER_COTES)
  ? JSON.parse(fs.readFileSync(FICHIER_COTES, 'utf8'))
  : {};
const quand = (x: any) => Date.parse(x.date);

// ── LE RELEVÉ, TEL QU'IL AURAIT ÉTÉ LA VEILLE ──────────────────────────────
const releves = new Map<string, any>();
function releveLaVeille(jour: string) {
  if (releves.has(jour)) return releves.get(jour);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  // Une copie : le calcul trie sur place.
  const liste = tirs.filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin).map((t) => ({ ...t }));
  // Comme en production : rien sous cent rencontres.
  const r = liste.length >= 100 ? forcesDepuisRencontres(liste as any, undefined, new Date(fin).toISOString()) : null;
  releves.set(jour, r);
  return r;
}

// ── LES STATISTIQUES DE LA COMPÉTITION, AVANT LE MATCH ─────────────────────
const parEquipe = new Map<number, any[]>();
for (const m of rencontres)
  for (const e of [m.dom, m.ext]) {
    if (!parEquipe.has(e)) parEquipe.set(e, []);
    parEquipe.get(e)!.push(m);
  }
function statsAvant(equipe: number, m: any) {
  let bm = 0, be = 0, n = 0;
  for (const x of parEquipe.get(equipe) ?? []) {
    if (x.ligue !== m.ligue || x.saison !== m.saison || quand(x) >= quand(m)) continue;
    n++;
    if (x.dom === equipe) { bm += x.bd; be += x.be; } else { bm += x.be; be += x.bd; }
  }
  return { butsMarques: bm, butsEncaisses: be, matchsJoues: n };
}

// ── LA LISTE DES MATCHS, LA MÊME POUR TOUS LES ESSAIS ──────────────────────
const suivies = new Set([...Object.keys(GRANDS), ...Object.keys(COUPES_SUIVIES)].map(Number));
const entrees: { m: any; s1: any; s2: any; occ: any; jour: string }[] = [];
const surCotes = tache.univers === 'cotes';
for (const m of rencontres) {
  const retenue = surCotes ? cotes[String(m.id)] !== undefined : suivies.has(Number(m.ligue));
  if (!retenue || m.date < tache.debut || m.date >= tache.fin) continue;
  const s1 = statsAvant(m.dom, m);
  const s2 = statsAvant(m.ext, m);
  if (s1.matchsJoues < 1 || s2.matchsJoues < 1) continue;
  const jour = m.date.slice(0, 10);
  entrees.push({ m, s1, s2, occ: butsAttendusOccasions(releveLaVeille(jour), m.nomDom, m.nomExt), jour });
}

const versPronostic = (m: any, r: any): Pronostic => {
  const p = [Number(r.probaVictoire1), Number(r.probaNul), Number(r.probaVictoire2)];
  const somme = p[0] + p[1] + p[2] || 1;
  return {
    id: Number(m.id),
    date: String(m.date),
    ligue: Number(m.ligue),
    reel: m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2,
    parScore: r.buts1 > r.buts2 ? 0 : r.buts1 === r.buts2 ? 1 : 2,
    probas: [p[0] / somme, p[1] / somme, p[2] / somme],
  };
};

// ── LES BUTS ATTENDUS DU MOTEUR ACTUEL, DONT LA COUCHE DES ERREURS APPREND ──
let attendus: Map<number, { a1: number; a2: number }> | null = null;
function baseAttendus() {
  if (attendus) return attendus;
  attendus = new Map();
  for (const { m, s1, s2, occ } of entrees) {
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ);
    attendus.set(Number(m.id), { a1: Number(r.butsAttendus1), a2: Number(r.butsAttendus2) });
  }
  return attendus;
}

// ── LA COUCHE DES ERREURS, REJOUÉE JOUR APRÈS JOUR ────────────────────────
function avecErreurs(retrecissement: number, poids: number): Pronostic[] {
  const base = baseAttendus();
  const out: Pronostic[] = [];
  const passes: any[] = [];
  let jourCourant = '';
  let clubs = apprendreErreurs([]);
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      // La leçon ne contient que les matchs des jours précédents.
      clubs = apprendreErreurs(passes);
      jourCourant = jour;
    }
    const corr = correctionPour(clubs, String(m.dom), String(m.ext), { retrecissement, poids });
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr);
    out.push(versPronostic(m, r));
    const a = base.get(Number(m.id))!;
    passes.push({ dom: String(m.dom), ext: String(m.ext), attenduDom: a.a1, attenduExt: a.a2, reelDom: m.bd, reelExt: m.be });
  }
  return out;
}

// ── LA COUCHE DU MARCHÉ, SUR LES MATCHS COTÉS ─────────────────────────────
function avecMarche(poids: number): { pronostics: Pronostic[]; actifs: number[] } {
  const pronostics: Pronostic[] = [];
  const actifs: number[] = [];
  for (const { m, s1, s2, occ } of entrees) {
    const c = cotes[String(m.id)];
    const marche = c ? { ...c, poids } : null;
    if (marche) actifs.push(Number(m.id));
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, marche);
    pronostics.push(versPronostic(m, r));
  }
  return { pronostics, actifs };
}

// ── LA COUCHE ELO : UNE NOTE PAR CLUB, BÂTIE SUR TOUS SES MATCHS ─────────────
//
// Chaque club part de 1 500. Chaque match déplace les deux notes selon le
// résultat, l'écart de buts et ce qui était attendu. Toutes les compétitions
// suivies comptent, coupes d'Europe comprises : c'est par elles que le niveau
// d'un championnat se transmet à un autre. Le match du jour ne connaît que
// les notes de la veille.
//
// La note se traduit en avis sur qui domine — mêmes probabilités que le
// marché, nul fixé à 26 % — et passe par le même point d'entrée : le moteur
// garde son total de buts et en ajuste la répartition.
const AVANTAGE_TERRAIN_ELO = 65;
const NUL_ELO = 0.26;
const toutesLesRencontres = [...rencontres].sort((a, b) => a.date.localeCompare(b.date));
function avecElo(k: number, poids: number): Pronostic[] {
  const note = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? 1500;
  const attendu = (dom: number, ext: number) => 1 / (1 + Math.pow(10, -(lire(dom) + AVANTAGE_TERRAIN_ELO - lire(ext)) / 400));
  const apprendre = (x: any) => {
    const we = attendu(x.dom, x.ext);
    const w = x.bd > x.be ? 1 : x.bd === x.be ? 0.5 : 0;
    const n = Math.abs(x.bd - x.be);
    const g = n <= 1 ? 1 : n === 2 ? 1.5 : (11 + n) / 8;
    const delta = k * g * (w - we);
    note.set(x.dom, lire(x.dom) + delta);
    note.set(x.ext, lire(x.ext) - delta);
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      // Tous les matchs des jours PRÉCÉDENTS, et rien d'autre.
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const we = attendu(m.dom, m.ext);
    const avis = { dom: (1 - NUL_ELO) * we, nul: NUL_ELO, ext: (1 - NUL_ELO) * (1 - we), poids };
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avis);
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LA COUCHE DU TERRAIN, PROPRE À CHAQUE CLUB ───────────────────────────
//
// Le moteur applique un avantage du terrain UNIQUE pour tous. Or certains
// clubs sont transformés chez eux et s'effondrent au loin. On mesure, pour
// chaque club, l'écart entre ce qu'il fait chez lui et ce qu'il fait
// dehors, puis on en retire ce que TOUT club gagne à recevoir : ce qui
// reste est sa spécialité propre, en buts par match.
//
// Un club n'est jugé qu'à partir de quatre matchs de chaque côté, et sa
// spécialité est ramenée vers zéro par n/(n+retrecissement). Elle entre
// par le point d'entrée des corrections additives, plafonné à un demi-but
// par le moteur lui-même. Comme pour Elo, le match du jour ne connaît que
// les matchs des jours précédents.
const MIN_COTES_TERRAIN = 4;
function avecTerrain(retrecissement: number, poids: number): Pronostic[] {
  type Cotes = { nD: number; dD: number; nE: number; dE: number };
  const par = new Map<number, Cotes>();
  let nTotal = 0;
  let diffTotale = 0;
  const cotes = (id: number) => {
    let c = par.get(id);
    if (!c) { c = { nD: 0, dD: 0, nE: 0, dE: 0 }; par.set(id, c); }
    return c;
  };
  const apprendre = (x: any) => {
    const d = cotes(x.dom); d.nD++; d.dD += x.bd - x.be;
    const e = cotes(x.ext); e.nE++; e.dE += x.be - x.bd;
    nTotal++; diffTotale += x.bd - x.be;
  };
  const specialite = (id: number) => {
    const c = par.get(id);
    if (!c || c.nD < MIN_COTES_TERRAIN || c.nE < MIN_COTES_TERRAIN) return 0;
    const moyen = nTotal ? diffTotale / nTotal : 0;
    const ecart = c.dD / c.nD - c.dE / c.nE - 2 * moyen;
    const n = Math.min(c.nD, c.nE);
    return ((n / (n + retrecissement)) * ecart) / 2;
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const d = (poids * (specialite(m.dom) + specialite(m.ext))) / 2;
    const corr = d === 0 ? null : { domicile: d / 2, exterieur: -d / 2 };
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr);
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── LA COUCHE DES CONFRONTATIONS DIRECTES ────────────────────────────────
//
// Certaines équipes ne se valent pas entre elles : l'une gêne l'autre
// match après match, quel que soit son niveau général. On ne garde QUE
// cette part-là : pour chaque duel passé, l'écart de buts réel moins
// l'écart que le moteur d'aujourd'hui attendrait, avantage du terrain
// retiré. La moyenne de ces surprises, ramenée vers zéro par
// n/(n+retrecissement), entre par les corrections additives.
//
// Toutes compétitions confondues, deux saisons, et seulement les duels
// joués AVANT le jour du match.
const TERRAIN_MOYEN_DUEL = 0.3;
function avecDuel(retrecissement: number, poids: number): Pronostic[] {
  const base = baseAttendus();
  const vus = new Map<string, { n: number; somme: number }>();
  const cle = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const apprendre = (x: any) => {
    const a = base.get(Number(x.id));
    // Sans attente du moteur pour ce duel, on ne sait pas ce qui est une
    // surprise : on le laisse de côté.
    if (!a) return;
    const petit = Math.min(x.dom, x.ext);
    const reel = x.bd - x.be - TERRAIN_MOYEN_DUEL;
    const attendu = a.a1 - a.a2 - TERRAIN_MOYEN_DUEL;
    const surprise = reel - attendu;
    const k = cle(x.dom, x.ext);
    let v = vus.get(k);
    if (!v) { v = { n: 0, somme: 0 }; vus.set(k, v); }
    v.n++;
    // Toujours du point de vue du club au plus petit numéro.
    v.somme += x.dom === petit ? surprise : -surprise;
  };
  const out: Pronostic[] = [];
  let j = 0;
  let jourCourant = '';
  for (const { m, s1, s2, occ, jour } of entrees) {
    if (jour !== jourCourant) {
      while (j < toutesLesRencontres.length && toutesLesRencontres[j].date.slice(0, 10) < jour) apprendre(toutesLesRencontres[j++]);
      jourCourant = jour;
    }
    const v = vus.get(cle(m.dom, m.ext));
    let d = 0;
    if (v && v.n > 0) {
      const moyenne = v.somme / v.n;
      const vu = Math.min(m.dom, m.ext) === m.dom ? moyenne : -moyenne;
      d = poids * (v.n / (v.n + retrecissement)) * vu;
    }
    const corr = d === 0 ? null : { domicile: d / 2, exterieur: -d / 2 };
    const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ, corr);
    out.push(versPronostic(m, r));
  }
  return out;
}

// ── CHAQUE ESSAI ──────────────────────────────────────────────────────────
const sortie: Record<string, Pronostic[]> = {};
const actifs: Record<string, number[]> = {};
for (const v of tache.variantes) {
  if (v.couche?.type === 'erreurs-clubs') {
    sortie[v.nom] = avecErreurs(v.couche.retrecissement, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'duel') {
    sortie[v.nom] = avecDuel(v.couche.retrecissement, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'terrain') {
    sortie[v.nom] = avecTerrain(v.couche.retrecissement, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'elo') {
    sortie[v.nom] = avecElo(v.couche.k, v.couche.poids);
    continue;
  }
  if (v.couche?.type === 'marche') {
    const r = avecMarche(v.couche.poids);
    sortie[v.nom] = r.pronostics;
    actifs[v.nom] = r.actifs;
    continue;
  }
  const avant: Record<string, string | undefined> = {};
  for (const [k, val] of Object.entries(v.env)) {
    avant[k] = process.env[k];
    process.env[k] = val;
  }
  try {
    sortie[v.nom] = entrees.map(({ m, s1, s2, occ }) =>
      versPronostic(m, calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ))
    );
  } finally {
    for (const [k, val] of Object.entries(avant)) {
      if (val === undefined) delete process.env[k];
      else process.env[k] = val;
    }
  }
}

fs.writeFileSync(tache.sortie, JSON.stringify({ matchs: entrees.length, variantes: sortie, actifs }));
console.log(
  `  évaluation terminée : ${entrees.length} matchs, ${tache.variantes.length} essai(s), ${releves.size} relevés reconstruits, ` +
    `${Object.keys(cotes).length} rencontres cotées disponibles`
);
