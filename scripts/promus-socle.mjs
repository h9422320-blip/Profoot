/**
 * LE SOCLE DES PROMUS, SUR TOUTE LEUR SAISON.
 *
 * CE QUE J'AVAIS MAL VU
 *
 * Je croyais le problème limité aux quelques rencontres où le moteur retombe
 * sur l'ancien calcul. C'est faux : dès son premier match joué, un promu entre
 * dans le calcul avec une force NEUTRE — 1 en attaque, 1 en défense — c'est-à-
 * dire réputé aussi fort qu'une équipe ordinaire du championnat. Et cette
 * valeur le suit toute la saison, corrigée seulement à mesure qu'il joue.
 *
 * Or la mesure dit qu'un promu marque 15 % de moins et encaisse 11 % de plus.
 * Le moteur le surestime donc systématiquement, sur toutes ses rencontres.
 *
 * On compare ici, sur TOUS les matchs impliquant un promu, la force neutre
 * d'aujourd'hui et l'a priori mesuré.
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

const LIGUES = [39, 140, 135, 78, 61, 94, 88, 144, 203, 179, 218, 207, 119, 103, 106, 197];
const TERMINE = ['FT', 'AET', 'PEN'];
const borner = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX = 8;
const poisson = (k, l) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; };

function issueEtScore(l1, l2) {
  const p1 = Array.from({ length: MAX + 1 }, (_, i) => poisson(i, l1));
  const p2 = Array.from({ length: MAX + 1 }, (_, j) => poisson(j, l2));
  let v1 = 0, n = 0, v2 = 0;
  const best = { 1: { s: [1, 0], e: Infinity, p: -1 }, 0: { s: [0, 0], e: Infinity, p: -1 }, 2: { s: [0, 1], e: Infinity, p: -1 } };
  for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) {
    const p = p1[i] * p2[j];
    const c = i > j ? 1 : i === j ? 0 : 2;
    if (c === 1) v1 += p; else if (c === 0) n += p; else v2 += p;
    const e = Math.abs(i - l1) + Math.abs(j - l2);
    if ((p >= best[c].p * 0.25 || best[c].p < 0) && (e < best[c].e || (e === best[c].e && p > best[c].p))) best[c] = { s: [i, j], e, p };
  }
  const iss = n >= v1 && n >= v2 ? 0 : v1 >= v2 ? 1 : 2;
  return { score: best[iss].s, issue: iss };
}

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
  const [s2023, s2024, s2025] = await Promise.all([matchsDe(id, 2023), matchsDe(id, 2024), matchsDe(id, 2025)]);
  if (s2023.length < 100 || s2024.length < 100 || s2025.length < 100) continue;
  donnees.push({ id, s2023, s2024, s2025 });
}

/** A priori mesuré sur la SAISON DE RÉGLAGE seulement. */
let sa = 0, sd = 0, sn = 0;
for (const d of donnees) {
  const socle = calculerForces(d.s2023, []);
  const connus = new Set(socle.equipes.keys());
  const promus = new Set();
  for (const m of d.s2024) { if (!connus.has(m.domicile)) promus.add(m.domicile); if (!connus.has(m.exterieur)) promus.add(m.exterieur); }
  const apres = calculerForces(d.s2024, []);
  for (const id of promus) { const f = apres.equipes.get(id); if (f) { sa += f.attaque; sd += f.defense; sn++; } }
}
const APRIORI = { attaque: sa / sn, defense: sd / sn };
console.log(`A priori promu, mesuré sur ${sn} équipes du jeu de réglage : attaque ${APRIORI.attaque.toFixed(3)} / défense ${APRIORI.defense.toFixed(3)}\n`);

const res = {};
const noter = (phase, nom, m, r) => {
  const s = (res[`${phase}|${nom}`] ??= { n: 0, ok: 0, exact: 0, err: 0 });
  const iR = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
  s.n++;
  if (r.issue === iR) s.ok++;
  if (r.score[0] === m.butsDomicile && r.score[1] === m.butsExterieur) s.exact++;
  s.err += Math.abs(r.score[0] - m.butsDomicile) + Math.abs(r.score[1] - m.butsExterieur);
};

function evaluer(passee, courante, phase) {
  const socle = calculerForces(passee, []);
  const connus = new Set(socle.equipes.keys());
  const ecoulees = [];

  for (const m of courante) {
    const estPromu = (id) => !connus.has(id);
    const concerne = estPromu(m.domicile) || estPromu(m.exterieur);
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);
    ecoulees.push(m);
    if (!concerne || !f1 || !f2) continue;

    // (a) Ce que fait le moteur aujourd'hui : socle neutre pour le promu.
    noter(phase, 'aujourd hui : socle neutre', m, issueEtScore(
      borner(f1.attaque * f2.defense * forces.butsDomicile, 0.25, 4),
      borner(f2.attaque * f1.defense * forces.butsExterieur, 0.25, 4)
    ));

    // (b) A priori mesuré, appliqué au SOCLE du promu — donc dilué de la même
    //     façon par la saison en cours.
    const rectifier = (id, f) => {
      if (!estPromu(id)) return f;
      const joues = ecoulees.filter((x) => x.domicile === id || x.exterieur === id).length - 1;
      const poids = joues / (joues + 20);
      // On refait le mélange, mais avec l'a priori à la place du 1 neutre.
      const observeeAtt = (f.attaque - (1 - poids) * 1) / (poids || 1);
      const observeeDef = (f.defense - (1 - poids) * 1) / (poids || 1);
      return {
        attaque: borner((1 - poids) * APRIORI.attaque + poids * observeeAtt, 0.35, 2.6),
        defense: borner((1 - poids) * APRIORI.defense + poids * observeeDef, 0.35, 2.6),
      };
    };
    const r1 = rectifier(m.domicile, f1), r2 = rectifier(m.exterieur, f2);
    noter(phase, 'a priori promu mesuré', m, issueEtScore(
      borner(r1.attaque * r2.defense * forces.butsDomicile, 0.25, 4),
      borner(r2.attaque * r1.defense * forces.butsExterieur, 0.25, 4)
    ));

    noter(phase, 'repère : toujours le domicile', m, { score: [2, 1], issue: 1 });
  }
}

for (const d of donnees) {
  evaluer(d.s2023, d.s2024, 'RÉGLAGE 2024-25');
  evaluer(d.s2024, d.s2025, 'VALIDATION 2025-26');
}

for (const phase of ['RÉGLAGE 2024-25', 'VALIDATION 2025-26']) {
  console.log(`\n===== ${phase} — TOUS LES MATCHS AVEC UN PROMU =====`);
  for (const [k, s] of Object.entries(res)) {
    if (!k.startsWith(phase + '|')) continue;
    console.log(
      `  ${k.split('|')[1].padEnd(32)} ${String(s.n).padStart(4)} matchs | issue ${((100 * s.ok) / s.n).toFixed(2).padStart(6)} % | exact ${((100 * s.exact) / s.n).toFixed(2).padStart(5)} % | err. buts ${(s.err / s.n).toFixed(3)}`
    );
  }
}
