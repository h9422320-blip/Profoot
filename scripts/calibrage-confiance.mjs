/**
 * LA CONFIANCE ANNONCÉE DOIT VOULOIR DIRE QUELQUE CHOSE.
 *
 * LE PROBLÈME, CONSTATÉ DANS L'ADMINISTRATION
 *
 * Confiance moyenne annoncée 75,8 %, réussite réelle 46 %. Vingt-neuf points
 * d'écart. Pire, la tranche « 70 à 80 % » ne réussit que 37,5 % : c'est la plus
 * trompeuse de toutes, parce qu'un abonné y lit une quasi-certitude.
 *
 * D'OÙ ÇA VIENT
 *
 * La confiance ne mesurait pas la chance d'avoir raison. Elle mesurait la
 * SOLIDITÉ de l'analyse — quantité de données, netteté de l'écart entre issues
 * — sur une échelle arbitraire de 55 à 92. Deux notions différentes affichées
 * sous le même mot. L'abonné, lui, lit « 80 % de chances que ce soit juste ».
 *
 * CE QU'ON MESURE ICI
 *
 * Quand le modèle donne X % à l'issue qu'il annonce, combien de fois a-t-il
 * raison ? C'est cette courbe, et elle seule, qui doit dicter le chiffre affiché.
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

/** @param rho correction de Dixon-Coles ; négative, elle renforce les nuls. */
function grille(l1, l2, rho = 0) {
  const p1 = Array.from({ length: MAX + 1 }, (_, i) => poisson(i, l1));
  const p2 = Array.from({ length: MAX + 1 }, (_, j) => poisson(j, l2));
  const tau = (i, j) => {
    if (rho === 0) return 1;
    if (i === 0 && j === 0) return 1 - l1 * l2 * rho;
    if (i === 0 && j === 1) return 1 + l1 * rho;
    if (i === 1 && j === 0) return 1 + l2 * rho;
    if (i === 1 && j === 1) return 1 - rho;
    return 1;
  };
  let v1 = 0, n = 0, v2 = 0;
  const best = { 1: { s: [1, 0], e: Infinity, p: -1 }, 0: { s: [0, 0], e: Infinity, p: -1 }, 2: { s: [0, 1], e: Infinity, p: -1 } };
  for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) {
    const p = p1[i] * p2[j] * tau(i, j);
    const c = i > j ? 1 : i === j ? 0 : 2;
    if (c === 1) v1 += p; else if (c === 0) n += p; else v2 += p;
    const e = Math.abs(i - l1) + Math.abs(j - l2);
    if ((p >= best[c].p * 0.25 || best[c].p < 0) && (e < best[c].e || (e === best[c].e && p > best[c].p))) best[c] = { s: [i, j], e, p };
  }
  const t = v1 + n + v2;
  // ATTENTION AU RANGEMENT : le tableau va domicile, nul, extérieur ; le code
  // d'issue, lui, vaut 1 pour le domicile, 0 pour le nul, 2 pour l'extérieur.
  // Les confondre faisait lire la probabilité du NUL comme celle d'une victoire.
  const probas = [v1 / t, n / t, v2 / t];
  const iss = probas[1] >= probas[0] && probas[1] >= probas[2] ? 0 : probas[0] >= probas[2] ? 1 : 2;
  const rang = iss === 1 ? 0 : iss === 0 ? 1 : 2;
  return { score: best[iss].s, issue: iss, probas, pTop: probas[rang] };
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
  const [a, b, c] = await Promise.all([matchsDe(id, 2023), matchsDe(id, 2024), matchsDe(id, 2025)]);
  if (a.length < 100 || b.length < 100 || c.length < 100) continue;
  donnees.push({ s2023: a, s2024: b, s2025: c });
}

const RHO = [0, -0.05, -0.1, -0.15];
const collecte = {}; // phase -> rho -> [{pTop, juste, issue, iReel}]

function evaluer(passee, courante, phase) {
  const ecoulees = [];
  for (const m of courante) {
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);
    ecoulees.push(m);
    if (!f1 || !f2) continue;
    const l1 = borner(f1.attaque * f2.defense * forces.butsDomicile, 0.25, 4);
    const l2 = borner(f2.attaque * f1.defense * forces.butsExterieur, 0.25, 4);
    const iReel = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
    for (const rho of RHO) {
      const g = grille(l1, l2, rho);
      ((collecte[phase] ??= {})[rho] ??= []).push({
        pTop: g.pTop, juste: g.issue === iReel, issue: g.issue, iReel,
        pNul: g.probas[1], estNul: iReel === 0,
        exact: g.score[0] === m.butsDomicile && g.score[1] === m.butsExterieur,
      });
    }
  }
}

for (const d of donnees) {
  evaluer(d.s2023, d.s2024, 'RÉGLAGE');
  evaluer(d.s2024, d.s2025, 'VALIDATION');
}

// ── 1. La courbe de calibrage : probabilité annoncée contre réussite réelle ──
console.log('=========== QUAND LE MODÈLE DIT X %, IL A RAISON COMBIEN DE FOIS ? ===========');
console.log('(sans correction Dixon-Coles)\n');
console.log('  proba annoncée | matchs | réussite réelle | écart');
for (const phase of ['RÉGLAGE', 'VALIDATION']) {
  console.log(`\n  --- ${phase} ---`);
  const obs = collecte[phase][0];
  for (const [min, max] of [[0, 0.35], [0.35, 0.40], [0.40, 0.45], [0.45, 0.50], [0.50, 0.55], [0.55, 0.60], [0.60, 0.70], [0.70, 1]]) {
    const s = obs.filter((o) => o.pTop >= min && o.pTop < max);
    if (s.length < 40) continue;
    const annonce = 100 * s.reduce((a, o) => a + o.pTop, 0) / s.length;
    const reel = 100 * s.filter((o) => o.juste).length / s.length;
    console.log(`  ${(100 * min).toFixed(0).padStart(3)}-${(100 * max).toFixed(0).padStart(3)} %      | ${String(s.length).padStart(6)} | ${annonce.toFixed(1).padStart(6)} % → ${reel.toFixed(1).padStart(5)} % | ${(reel - annonce >= 0 ? '+' : '') + (reel - annonce).toFixed(1)}`);
  }
}

// ── 2. Effet de Dixon-Coles sur la probabilité du nul et sur la justesse ────
console.log('\n\n=========== DIXON-COLES : LE NUL ET LA JUSTESSE ===========');
for (const phase of ['RÉGLAGE', 'VALIDATION']) {
  console.log(`\n  --- ${phase} ---`);
  for (const rho of RHO) {
    const obs = collecte[phase][rho];
    const nulsAnnonces = obs.filter((o) => o.issue === 0).length;
    const nulsReels = obs.filter((o) => o.estNul).length;
    const pNulMoyen = 100 * obs.reduce((a, o) => a + o.pNul, 0) / obs.length;
    const brier = obs.reduce((a, o) => a + Math.pow(o.pTop - (o.juste ? 1 : 0), 2), 0) / obs.length;
    console.log(
      `  rho ${String(rho).padStart(5)} | issue juste ${(100 * obs.filter((o) => o.juste).length / obs.length).toFixed(2)} % | ` +
      `exact ${(100 * obs.filter((o) => o.exact).length / obs.length).toFixed(2)} % | ` +
      `nul annoncé ${(100 * nulsAnnonces / obs.length).toFixed(1)} % (réel ${(100 * nulsReels / obs.length).toFixed(1)} %) | ` +
      `proba nul moyenne ${pNulMoyen.toFixed(1)} %`
    );
  }
}
