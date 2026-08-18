/**
 * LES JOUEURS ABSENTS ONT-ILS UN EFFET MESURABLE ?
 *
 * On ne branche rien sur le moteur avant de savoir si le signal existe. La
 * question posée ici est la plus simple possible : une équipe privée de
 * plusieurs joueurs marque-t-elle MOINS que ce que le modèle attendait d'elle ?
 *
 * Si l'écart est nul, la piste est morte et il faut le dire. S'il existe, on
 * saura de combien, et on pourra le traduire en correction.
 *
 * UNE RÉSERVE À GARDER EN TÊTE
 *
 * `/injuries?fixture=` renvoie les absents CONSTATÉS. Avant le match, on ne
 * connaît que les absents ANNONCÉS — les forfaits de dernière minute manquent.
 * Le gain mesuré ici est donc un plafond, pas une promesse.
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
const SAISON = 2025;
const TERMINE = ['FT', 'AET', 'PEN'];
const borner = (v, a, b) => Math.min(b, Math.max(a, v));

async function fixtures(ligue, an) {
  const d = await apiFootball(`/fixtures?league=${ligue}&season=${an}`, CACHE_TTL.TEAM_INFO);
  return (d?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      id: f.fixture.id,
      date: new Date(f.fixture.date).getTime(),
      domicile: f.teams.home.id, exterieur: f.teams.away.id,
      butsDomicile: Number(f.goals.home ?? 0), butsExterieur: Number(f.goals.away ?? 0),
    }))
    .sort((a, b) => a.date - b.date);
}

/** Absents par équipe pour une rencontre. */
async function absents(fixtureId) {
  const d = await apiFootball(`/injuries?fixture=${fixtureId}`, CACHE_TTL.TEAM_INFO);
  const par = new Map();
  for (const x of d?.response ?? []) {
    const id = Number(x?.team?.id);
    if (!Number.isFinite(id)) continue;
    const e = par.get(id) ?? { total: 0, forfaits: 0, joueurs: [] };
    e.total++;
    if (String(x?.player?.type ?? '').toLowerCase().includes('missing')) e.forfaits++;
    e.joueurs.push({ id: Number(x?.player?.id), nom: x?.player?.name, type: x?.player?.type });
    par.set(id, e);
  }
  return par;
}

console.log('Chargement des championnats…');
const parLigue = [];
for (const [id, nom] of LIGUES) {
  const [passee, courante] = await Promise.all([fixtures(id, SAISON - 1), fixtures(id, SAISON)]);
  if (passee.length < 100 || courante.length < 100) { console.log(`  ${nom} ignoré`); continue; }
  parLigue.push({ id, nom, passee, courante });
  console.log(`  ${nom} : ${courante.length} matchs`);
}

// ── Étape 1 : l'écart entre buts attendus et buts marqués, selon le nombre
//    d'absents. Aucune modification du moteur, juste une observation.
const observations = [];
let appels = 0;

for (const l of parLigue) {
  const ecoulees = [];
  for (const m of l.courante) {
    const forces = calculerForces(l.passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);
    ecoulees.push(m);
    if (!f1 || !f2) continue;

    const attendu1 = borner(f1.attaque * f2.defense * forces.butsDomicile, 0.25, 4);
    const attendu2 = borner(f2.attaque * f1.defense * forces.butsExterieur, 0.25, 4);

    const abs = await absents(m.id);
    appels++;
    const aD = abs.get(m.domicile) ?? { total: 0, forfaits: 0 };
    const aE = abs.get(m.exterieur) ?? { total: 0, forfaits: 0 };

    observations.push(
      { absents: aD.forfaits, attendu: attendu1, marque: m.butsDomicile, encaisse: m.butsExterieur, absentsAdverse: aE.forfaits },
      { absents: aE.forfaits, attendu: attendu2, marque: m.butsExterieur, encaisse: m.butsDomicile, absentsAdverse: aD.forfaits }
    );
  }
  console.log(`  ${l.nom} — ${appels} rencontres interrogées`);
}

console.log(`\n${observations.length} observations (deux par match)\n`);

const moy = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

console.log('=========== BUTS MARQUÉS SELON LE NOMBRE D\'ABSENTS ===========');
console.log('  absents | équipes |  attendu | marqué | écart   | encaissé');
for (const [min, max, libelle] of [[0, 0, '0'], [1, 1, '1'], [2, 2, '2'], [3, 3, '3'], [4, 5, '4-5'], [6, 99, '6+']]) {
  const s = observations.filter((o) => o.absents >= min && o.absents <= max);
  if (s.length < 30) continue;
  const att = moy(s.map((o) => o.attendu));
  const mar = moy(s.map((o) => o.marque));
  const enc = moy(s.map((o) => o.encaisse));
  console.log(
    `  ${libelle.padStart(7)} | ${String(s.length).padStart(7)} | ${att.toFixed(3).padStart(8)} | ${mar.toFixed(3).padStart(6)} | ${(mar - att >= 0 ? '+' : '') + (mar - att).toFixed(3)} | ${enc.toFixed(3)}`
  );
}

console.log('\n=========== LECTURE ===========');
const sans = observations.filter((o) => o.absents === 0);
const beaucoup = observations.filter((o) => o.absents >= 4);
if (sans.length > 30 && beaucoup.length > 30) {
  const ecartSans = moy(sans.map((o) => o.marque - o.attendu));
  const ecartBeaucoup = moy(beaucoup.map((o) => o.marque - o.attendu));
  console.log(`  Sans absent   : ${(ecartSans >= 0 ? '+' : '') + ecartSans.toFixed(3)} but par rapport à l'attendu (${sans.length} cas)`);
  console.log(`  4 absents ou + : ${(ecartBeaucoup >= 0 ? '+' : '') + ecartBeaucoup.toFixed(3)} but par rapport à l'attendu (${beaucoup.length} cas)`);
  console.log(`  Différence     : ${(ecartBeaucoup - ecartSans).toFixed(3)} but`);
  console.log(
    Math.abs(ecartBeaucoup - ecartSans) < 0.08
      ? '\n  => AUCUN SIGNAL EXPLOITABLE. Le nombre d\'absents ne dit rien sur les buts.'
      : '\n  => SIGNAL PRÉSENT. Il vaut la peine d\'être traduit en correction.'
  );
}
