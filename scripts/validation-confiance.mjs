/**
 * LA NOUVELLE CONFIANCE TIENT-ELLE SA PROMESSE ?
 *
 * On rejoue deux saisons avec le moteur RÉEL et on vérifie la seule chose qui
 * compte : quand il affiche X %, réussit-il X % du temps ?
 *
 * On vérifie en même temps que la justesse et le score exact n'ont pas bougé —
 * la correction porte sur l'étiquette, pas sur le pronostic.
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
const { calculerScoreProbable } = await jiti.import('../src/lib/score-probable.ts');

const LIGUES = [39, 140, 135, 78, 61, 94, 88, 144, 203, 179, 218, 207, 119, 103, 106, 197];
const TERMINE = ['FT', 'AET', 'PEN'];

async function matchsDe(ligue, an) {
  const d = await apiFootball(`/fixtures?league=${ligue}&season=${an}`, CACHE_TTL.TEAM_INFO);
  return (d?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      date: new Date(f.fixture.date).getTime(),
      domicile: f.teams.home.id, exterieur: f.teams.away.id,
      butsDomicile: Number(f.goals.home ?? 0), butsExterieur: Number(f.goals.away ?? 0),
    }))
    .sort((a, b) => a.date - b.date);
}

const donnees = [];
for (const id of LIGUES) {
  const [a, b, c] = await Promise.all([matchsDe(id, 2023), matchsDe(id, 2024), matchsDe(id, 2025)]);
  if (a.length < 100 || b.length < 100 || c.length < 100) continue;
  donnees.push({ s2023: a, s2024: b, s2025: c });
}

const obs = { 'RÉGLAGE': [], 'VALIDATION': [] };

function evaluer(passee, courante, phase) {
  const ecoulees = [];
  for (const m of courante) {
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);
    ecoulees.push(m);
    if (!f1 || !f2) continue;

    const s = calculerScoreProbable(
      { butsMarques: 0, butsEncaisses: 0, matchsJoues: 0 },
      { butsMarques: 0, butsEncaisses: 0, matchsJoues: 0 },
      true, false, undefined,
      { equipe1: f1, equipe2: f2, butsDomicile: forces.butsDomicile, butsExterieur: forces.butsExterieur }
    );

    const iP = s.buts1 > s.buts2 ? 1 : s.buts1 === s.buts2 ? 0 : 2;
    const iR = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
    obs[phase].push({
      confiance: s.confiance,
      juste: iP === iR,
      exact: s.buts1 === m.butsDomicile && s.buts2 === m.butsExterieur,
      probaNul: s.probaNul,
      estNul: iR === 0,
      buts: s.buts1 + s.buts2,
      butsReels: m.butsDomicile + m.butsExterieur,
      nulAnnonce: iP === 0,
    });
  }
}

for (const d of donnees) {
  evaluer(d.s2023, d.s2024, 'RÉGLAGE');
  evaluer(d.s2024, d.s2025, 'VALIDATION');
}

for (const phase of ['RÉGLAGE', 'VALIDATION']) {
  const o = obs[phase];
  const moy = (f) => o.reduce((a, x) => a + f(x), 0) / o.length;
  console.log(`\n================ ${phase} — ${o.length} matchs ================`);
  console.log(`  Confiance moyenne annoncée : ${moy((x) => x.confiance).toFixed(1)} %`);
  console.log(`  Réussite réelle            : ${(100 * o.filter((x) => x.juste).length / o.length).toFixed(1)} %`);
  console.log(`  ÉCART                      : ${(moy((x) => x.confiance) - 100 * o.filter((x) => x.juste).length / o.length).toFixed(1)} points`);
  console.log(`  Score exact                : ${(100 * o.filter((x) => x.exact).length / o.length).toFixed(2)} %`);
  console.log(`  Buts annoncés / réels      : ${moy((x) => x.buts).toFixed(2)} / ${moy((x) => x.butsReels).toFixed(2)}`);
  console.log(`  Proba de nul annoncée      : ${moy((x) => x.probaNul).toFixed(1)} % — nuls réels ${(100 * o.filter((x) => x.estNul).length / o.length).toFixed(1)} %`);

  console.log('\n  Par tranche de confiance affichée :');
  for (const [min, max] of [[0, 40], [40, 45], [45, 50], [50, 55], [55, 60], [60, 70], [70, 101]]) {
    const s = o.filter((x) => x.confiance >= min && x.confiance < max);
    if (s.length < 40) continue;
    const annonce = s.reduce((a, x) => a + x.confiance, 0) / s.length;
    const reel = 100 * s.filter((x) => x.juste).length / s.length;
    const drapeau = Math.abs(reel - annonce) >= 10 ? '  <-- ÉCART' : '';
    console.log(`    ${String(min).padStart(3)}-${max === 101 ? 100 : max - 1} % : ${String(s.length).padStart(5)} matchs — annoncé ${annonce.toFixed(1).padStart(5)} % → réussi ${reel.toFixed(1).padStart(5)} %${drapeau}`);
  }
}
