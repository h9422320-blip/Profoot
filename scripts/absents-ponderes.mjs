/**
 * LES ABSENTS, PONDÉRÉS PAR CE QU'ILS PÈSENT RÉELLEMENT.
 *
 * POURQUOI LE DÉCOMPTE BRUT NE SUFFIT PAS
 *
 * Mesuré sur 1 436 rencontres : une équipe à six absents marque autant qu'une
 * équipe au complet. C'était attendu — six remplaçants absents ne valent pas un
 * buteur absent.
 *
 * On pèse donc chaque absent par ce qu'il apportait la saison précédente : sa
 * part des buts de l'équipe et sa part du temps de jeu. Un attaquant qui a
 * inscrit un tiers des buts et un remplaçant qui n'a jamais joué ne comptent
 * plus pareil.
 *
 * LE SCRIPT REPREND OÙ IL S'ARRÊTE
 *
 * Une première tentative a été interrompue en cours de route et tout était
 * perdu. Les poids des joueurs sont désormais écrits sur le disque au fur et à
 * mesure : une reprise ne repaie pas ce qui a déjà été payé.
 *
 * UNE RÉSERVE À GARDER EN TÊTE
 *
 * `/injuries?fixture=` renvoie les absents CONSTATÉS. Avant le match, on ne
 * connaît que les absents ANNONCÉS — les forfaits de dernière minute manquent.
 * Tout gain mesuré ici est donc un plafond, pas une promesse.
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
const { calculerForces } = await jiti.import('../src/lib/forces-equipes.ts');

const LIGUES = [[39, 'Premier League'], [140, 'La Liga'], [135, 'Serie A'], [61, 'Ligue 1']];
const TERMINE = ['FT', 'AET', 'PEN'];
const borner = (v, a, b) => Math.min(b, Math.max(a, v));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const FICHIER_POIDS = 'scripts/.poids-joueurs.json';
const poidsSauves = fs.existsSync(FICHIER_POIDS)
  ? JSON.parse(fs.readFileSync(FICHIER_POIDS, 'utf8'))
  : {};

async function fixtures(ligue, an) {
  const d = await apiFootball(`/fixtures?league=${ligue}&season=${an}`, CACHE_TTL.TEAM_INFO);
  return (d?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      id: f.fixture.id, date: new Date(f.fixture.date).getTime(),
      domicile: f.teams.home.id, exterieur: f.teams.away.id,
      butsDomicile: Number(f.goals.home ?? 0), butsExterieur: Number(f.goals.away ?? 0),
    }))
    .sort((a, b) => a.date - b.date);
}

/**
 * Poids de chaque joueur dans son équipe, d'après la saison précédente.
 * Moitié part des buts, moitié part du temps de jeu : un défenseur central
 * indiscutable compte, même s'il ne marque jamais.
 */
async function poidsJoueurs(equipe, an) {
  const cle = `${equipe}:${an}`;
  if (poidsSauves[cle]) return new Map(Object.entries(poidsSauves[cle]).map(([k, v]) => [Number(k), v]));

  const brut = [];
  let butsEquipe = 0, minutesEquipe = 0;
  for (let page = 1; page <= 4; page++) {
    const d = await apiFootball(`/players?team=${equipe}&season=${an}&page=${page}`, CACHE_TTL.TEAM_INFO);
    await pause(350); // Le fournisseur limite le nombre d'appels par minute.
    const rep = d?.response ?? [];
    for (const p of rep) {
      const st = (p.statistics ?? []).reduce(
        (a, s) => ({ buts: a.buts + (s.goals?.total ?? 0), minutes: a.minutes + (s.games?.minutes ?? 0) }),
        { buts: 0, minutes: 0 }
      );
      brut.push({ id: Number(p.player?.id), buts: st.buts, minutes: st.minutes });
      butsEquipe += st.buts;
      minutesEquipe += st.minutes;
    }
    if (!d?.paging || page >= (d.paging.total ?? 1)) break;
  }

  const obj = {};
  for (const j of brut) {
    const partButs = butsEquipe > 0 ? j.buts / butsEquipe : 0;
    const partTemps = minutesEquipe > 0 ? j.minutes / minutesEquipe : 0;
    obj[j.id] = 0.5 * partButs + 0.5 * partTemps;
  }
  poidsSauves[cle] = obj;
  fs.writeFileSync(FICHIER_POIDS, JSON.stringify(poidsSauves));
  return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
}

async function absents(fixtureId) {
  const d = await apiFootball(`/injuries?fixture=${fixtureId}`, CACHE_TTL.TEAM_INFO);
  const par = new Map();
  for (const x of d?.response ?? []) {
    const id = Number(x?.team?.id);
    if (!Number.isFinite(id)) continue;
    if (!String(x?.player?.type ?? '').toLowerCase().includes('missing')) continue;
    const e = par.get(id) ?? [];
    e.push(Number(x?.player?.id));
    par.set(id, e);
  }
  return par;
}

// ── PHASE 1 : les poids, payés une seule fois ───────────────────────────────
const jeux = [];
for (const [ligue, nom] of LIGUES) {
  // 2024-25 sert de RÉGLAGE, 2025-26 de VALIDATION.
  const [s2023, s2024, s2025] = await Promise.all([fixtures(ligue, 2023), fixtures(ligue, 2024), fixtures(ligue, 2025)]);
  if (s2023.length < 100 || s2024.length < 100 || s2025.length < 100) { console.log(`  ${nom} ignoré`); continue; }
  jeux.push({ ligue, nom, s2023, s2024, s2025 });
}

const equipesAPeser = new Set();
for (const j of jeux) {
  for (const m of [...j.s2024, ...j.s2025]) { equipesAPeser.add(`${m.domicile}:2023`); equipesAPeser.add(`${m.exterieur}:2023`); }
  for (const m of j.s2025) { equipesAPeser.add(`${m.domicile}:2024`); equipesAPeser.add(`${m.exterieur}:2024`); }
}
console.log(`Poids à établir : ${equipesAPeser.size} couples équipe/saison (${Object.keys(poidsSauves).length} déjà en réserve)`);
let fait = 0;
for (const cle of equipesAPeser) {
  const [equipe, an] = cle.split(':');
  await poidsJoueurs(Number(equipe), Number(an));
  fait++;
  if (fait % 20 === 0) console.log(`  ${fait}/${equipesAPeser.size}`);
}
console.log('Poids établis.\n');

// ── PHASE 2 : observation ───────────────────────────────────────────────────
const obs = { 'RÉGLAGE': [], 'VALIDATION': [] };

async function collecter(passee, courante, anPoids, phase) {
  const ecoulees = [];
  for (const m of courante) {
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);
    ecoulees.push(m);
    if (!f1 || !f2) continue;

    const abs = await absents(m.id);
    const [pD, pE] = await Promise.all([poidsJoueurs(m.domicile, anPoids), poidsJoueurs(m.exterieur, anPoids)]);
    const perte = (equipe, poids) => (abs.get(equipe) ?? []).reduce((a, id) => a + (poids.get(id) ?? 0), 0);

    obs[phase].push({
      perteDom: perte(m.domicile, pD), perteExt: perte(m.exterieur, pE),
      l1: borner(f1.attaque * f2.defense * forces.butsDomicile, 0.25, 4),
      l2: borner(f2.attaque * f1.defense * forces.butsExterieur, 0.25, 4),
      bd: m.butsDomicile, be: m.butsExterieur,
    });
  }
}

for (const j of jeux) {
  await collecter(j.s2023, j.s2024, 2023, 'RÉGLAGE');
  console.log(`  ${j.nom} réglage : ${obs['RÉGLAGE'].length} observations`);
  await collecter(j.s2024, j.s2025, 2024, 'VALIDATION');
  console.log(`  ${j.nom} validation : ${obs['VALIDATION'].length} observations`);
}

fs.writeFileSync('scripts/.observations-absents.json', JSON.stringify(obs));

// ── PHASE 3 : y a-t-il un signal ? ──────────────────────────────────────────
const moy = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

for (const phase of ['RÉGLAGE', 'VALIDATION']) {
  const plat = obs[phase].flatMap((o) => [
    { perte: o.perteDom, attendu: o.l1, marque: o.bd },
    { perte: o.perteExt, attendu: o.l2, marque: o.be },
  ]);
  console.log(`\n=========== ${phase} — ${plat.length} observations ===========`);
  console.log('  poids perdu | équipes |  attendu | marqué |  écart');
  for (const [min, max] of [[0, 0.02], [0.02, 0.06], [0.06, 0.12], [0.12, 0.20], [0.20, 0.30], [0.30, 9]]) {
    const s = plat.filter((o) => o.perte >= min && o.perte < max);
    if (s.length < 40) continue;
    const a = moy(s.map((o) => o.attendu)), b = moy(s.map((o) => o.marque));
    console.log(`  ${min.toFixed(2)}-${max === 9 ? '  + ' : max.toFixed(2)} | ${String(s.length).padStart(7)} | ${a.toFixed(3).padStart(8)} | ${b.toFixed(3).padStart(6)} | ${(b - a >= 0 ? '+' : '') + (b - a).toFixed(3)}`);
  }
  const faible = plat.filter((o) => o.perte < 0.06), fort = plat.filter((o) => o.perte >= 0.20);
  if (faible.length > 40 && fort.length > 40) {
    const a = moy(faible.map((o) => o.marque - o.attendu)), b = moy(fort.map((o) => o.marque - o.attendu));
    console.log(`  Peu d'absence (< 6 %)   : ${(a >= 0 ? '+' : '') + a.toFixed(3)} but sur l'attendu`);
    console.log(`  Grosse absence (≥ 20 %) : ${(b >= 0 ? '+' : '') + b.toFixed(3)} but sur l'attendu`);
    console.log(`  DIFFÉRENCE              : ${(b - a).toFixed(3)} but`);
  }
}

// ── PHASE 4 : si on corrige les buts attendus, la justesse monte-t-elle ? ───
const MAX = 8;
const poisson = (k, l) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; };
function issueDe(l1, l2) {
  const p1 = Array.from({ length: MAX + 1 }, (_, i) => poisson(i, l1));
  const p2 = Array.from({ length: MAX + 1 }, (_, j) => poisson(j, l2));
  let v1 = 0, n = 0, v2 = 0;
  for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) {
    const p = p1[i] * p2[j];
    if (i > j) v1 += p; else if (i === j) n += p; else v2 += p;
  }
  return n >= v1 && n >= v2 ? 0 : v1 >= v2 ? 1 : 2;
}

console.log('\n\n=========== EN CORRIGEANT LES BUTS ATTENDUS ===========');
console.log('  « effet » = de combien on réduit l\'attaque par unité de poids perdu.\n');
for (const phase of ['RÉGLAGE', 'VALIDATION']) {
  console.log(`  --- ${phase} ---`);
  for (const effet of [0, 0.2, 0.4, 0.6]) {
    let ok = 0;
    for (const o of obs[phase]) {
      const l1 = Math.max(0.25, o.l1 * (1 - effet * o.perteDom));
      const l2 = Math.max(0.25, o.l2 * (1 - effet * o.perteExt));
      const iP = issueDe(l1, l2);
      const iR = o.bd > o.be ? 1 : o.bd === o.be ? 0 : 2;
      if (iP === iR) ok++;
    }
    const n = obs[phase].length;
    console.log(`    effet ${effet.toFixed(1)} : issue juste ${((100 * ok) / n).toFixed(2)} % sur ${n} matchs${effet === 0 ? '   <-- référence, aucune correction' : ''}`);
  }
}
