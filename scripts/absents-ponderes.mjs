/**
 * LES ABSENTS, PONDÉRÉS PAR CE QU'ILS PÈSENT RÉELLEMENT.
 *
 * Le simple décompte ne dit rien — mesuré : une équipe à six absents marque
 * autant qu'une équipe au complet. C'était attendu : six remplaçants absents ne
 * valent pas un buteur absent.
 *
 * On pèse donc chaque absent par ce qu'il apportait la saison précédente : sa
 * part des buts de l'équipe, et sa part du temps de jeu. Un attaquant qui a
 * inscrit un tiers des buts et un remplaçant qui n'a jamais joué ne comptent
 * plus pareil.
 *
 * Si l'écart reste nul, la piste est morte pour de bon.
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
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

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
 * indiscutable compte, même s'il ne marque pas.
 */
async function poidsJoueurs(equipe, an) {
  const poids = new Map();
  let butsEquipe = 0, minutesEquipe = 0;
  const brut = [];

  for (let page = 1; page <= 4; page++) {
    const d = await apiFootball(`/players?team=${equipe}&season=${an}&page=${page}`, CACHE_TTL.TEAM_INFO);
    await pause(220); // Le fournisseur limite le nombre d'appels par minute.
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

  for (const j of brut) {
    const partButs = butsEquipe > 0 ? j.buts / butsEquipe : 0;
    const partTemps = minutesEquipe > 0 ? j.minutes / minutesEquipe : 0;
    poids.set(j.id, 0.5 * partButs + 0.5 * partTemps);
  }
  return poids;
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

const observations = [];

for (const [ligue, nom] of LIGUES) {
  const [passee, courante] = await Promise.all([fixtures(ligue, SAISON - 1), fixtures(ligue, SAISON)]);
  if (passee.length < 100 || courante.length < 100) { console.log(`  ${nom} ignoré`); continue; }

  const equipes = new Set();
  for (const m of courante) { equipes.add(m.domicile); equipes.add(m.exterieur); }

  console.log(`  ${nom} — poids des joueurs pour ${equipes.size} équipes…`);
  const poidsParEquipe = new Map();
  for (const e of equipes) poidsParEquipe.set(e, await poidsJoueurs(e, SAISON - 1));

  const ecoulees = [];
  for (const m of courante) {
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);
    ecoulees.push(m);
    if (!f1 || !f2) continue;

    const abs = await absents(m.id);
    const perte = (equipe) => {
      const poids = poidsParEquipe.get(equipe) ?? new Map();
      return (abs.get(equipe) ?? []).reduce((a, id) => a + (poids.get(id) ?? 0), 0);
    };

    observations.push(
      { perte: perte(m.domicile), attendu: borner(f1.attaque * f2.defense * forces.butsDomicile, 0.25, 4), marque: m.butsDomicile },
      { perte: perte(m.exterieur), attendu: borner(f2.attaque * f1.defense * forces.butsExterieur, 0.25, 4), marque: m.butsExterieur }
    );
  }
  console.log(`     ${observations.length} observations cumulées`);
}

const moy = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

console.log(`\n=========== BUTS MARQUÉS SELON LE POIDS DES ABSENTS ===========`);
console.log('  Le « poids perdu » est la part de l\'équipe absente : 0,20 = un cinquième');
console.log('  de sa force offensive et de son temps de jeu habituel.\n');
console.log('  poids perdu | équipes |  attendu | marqué |  écart');
const tranches = [[0, 0.02], [0.02, 0.06], [0.06, 0.12], [0.12, 0.20], [0.20, 0.30], [0.30, 9]];
for (const [min, max] of tranches) {
  const s = observations.filter((o) => o.perte >= min && o.perte < max);
  if (s.length < 40) continue;
  const att = moy(s.map((o) => o.attendu)), mar = moy(s.map((o) => o.marque));
  console.log(
    `  ${min.toFixed(2)}-${max === 9 ? '  + ' : max.toFixed(2)} | ${String(s.length).padStart(7)} | ${att.toFixed(3).padStart(8)} | ${mar.toFixed(3).padStart(6)} | ${(mar - att >= 0 ? '+' : '') + (mar - att).toFixed(3)}`
  );
}

const faible = observations.filter((o) => o.perte < 0.06);
const fort = observations.filter((o) => o.perte >= 0.20);
if (faible.length > 40 && fort.length > 40) {
  const a = moy(faible.map((o) => o.marque - o.attendu));
  const b = moy(fort.map((o) => o.marque - o.attendu));
  console.log(`\n  Peu d'absence (< 6 %)  : ${(a >= 0 ? '+' : '') + a.toFixed(3)} but sur l'attendu (${faible.length} cas)`);
  console.log(`  Grosse absence (≥ 20 %) : ${(b >= 0 ? '+' : '') + b.toFixed(3)} but sur l'attendu (${fort.length} cas)`);
  console.log(`  Différence              : ${(b - a).toFixed(3)} but`);
  console.log(
    Math.abs(b - a) < 0.08
      ? '\n  => PISTE MORTE. Même pondérés, les absents ne prédisent pas les buts.'
      : `\n  => SIGNAL. Une équipe amputée marque ${(b - a).toFixed(2)} but de moins qu'attendu.`
  );
}
