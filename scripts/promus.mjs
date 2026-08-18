/**
 * LES PROMUS, LA VRAIE COMPARAISON.
 *
 * Aujourd'hui, quand une équipe n'a pas de saison passée dans ce championnat,
 * le moteur ne se contente pas de « faire moins bien » : il RETOMBE sur
 * l'ancien calcul, celui des moyennes brutes — mesuré à 46 % en début de saison
 * contre 52,8 %. La bonne question n'est donc pas « a priori contre forces »,
 * mais « a priori contre ce repli ».
 *
 * On isole donc les seules rencontres concernées.
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
const borner = (v, a, b) => Math.min(b, Math.max(a, v));

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

/** L'a priori « promu », mesuré sur la saison de RÉGLAGE seulement. */
function mesurerApriori(donnees) {
  let att = 0, def = 0, n = 0;
  for (const d of donnees) {
    const socle = calculerForces(d.s2023, []);
    const connus = new Set(socle.equipes.keys());
    const nouveaux = new Set();
    for (const m of d.s2024) {
      if (!connus.has(m.domicile)) nouveaux.add(m.domicile);
      if (!connus.has(m.exterieur)) nouveaux.add(m.exterieur);
    }
    if (!nouveaux.size) continue;
    const apres = calculerForces(d.s2024, []);
    for (const id of nouveaux) {
      const f = apres.equipes.get(id);
      if (f) { att += f.attaque; def += f.defense; n++; }
    }
  }
  return { attaque: att / n, defense: def / n, echantillon: n };
}

const donnees = [];
for (const id of LIGUES) {
  const [s2023, s2024, s2025] = await Promise.all([matchsDe(id, 2023), matchsDe(id, 2024), matchsDe(id, 2025)]);
  if (s2023.length < 100 || s2024.length < 100 || s2025.length < 100) continue;
  donnees.push({ id, s2023, s2024, s2025 });
}

const APRIORI = mesurerApriori(donnees);
console.log(`A priori « promu » mesuré sur ${APRIORI.echantillon} équipes (saison de réglage) :`);
console.log(`  attaque ${APRIORI.attaque.toFixed(3)} — défense ${APRIORI.defense.toFixed(3)}`);
console.log(`  Autrement dit : un promu marque ${((1 - APRIORI.attaque) * 100).toFixed(0)} % de moins et encaisse ${((APRIORI.defense - 1) * 100).toFixed(0)} % de plus qu'une équipe ordinaire.\n`);

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
  const joues = new Map();
  const ecoulees = [];
  for (const m of courante) {
    const hD = joues.get(m.domicile) ?? { j: 0, pour: 0, contre: 0 };
    const hE = joues.get(m.exterieur) ?? { j: 0, pour: 0, contre: 0 };
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);

    // SEULES les rencontres où au moins un promu est impliqué.
    if (!f1 || !f2) {
      // (a) Ce que fait le moteur aujourd'hui : repli sur l'ancien calcul.
      const repli = calculerScoreProbable(
        { butsMarques: hD.pour, butsEncaisses: hD.contre, matchsJoues: hD.j },
        { butsMarques: hE.pour, butsEncaisses: hE.contre, matchsJoues: hE.j },
        true, false
      );
      noter(phase, 'aujourd hui : repli ancien calcul', m, { score: [repli.buts1, repli.buts2], issue: repli.buts1 > repli.buts2 ? 1 : repli.buts1 === repli.buts2 ? 0 : 2 });

      // (b) A priori « promu » à la place du repli.
      const g1 = f1 ?? { attaque: APRIORI.attaque, defense: APRIORI.defense };
      const g2 = f2 ?? { attaque: APRIORI.attaque, defense: APRIORI.defense };
      noter(phase, 'a priori promu', m, issueEtScore(
        borner(g1.attaque * g2.defense * forces.butsDomicile, 0.25, 4),
        borner(g2.attaque * g1.defense * forces.butsExterieur, 0.25, 4)
      ));

      // (c) Force neutre, pour vérifier que l'a priori mesuré vaut mieux que « moyen ».
      const n1 = f1 ?? { attaque: 1, defense: 1 };
      const n2 = f2 ?? { attaque: 1, defense: 1 };
      noter(phase, 'force neutre (1,1)', m, issueEtScore(
        borner(n1.attaque * n2.defense * forces.butsDomicile, 0.25, 4),
        borner(n2.attaque * n1.defense * forces.butsExterieur, 0.25, 4)
      ));

      noter(phase, 'repère : toujours le domicile', m, { score: [2, 1], issue: 1 });
    }

    hD.j++; hD.pour += m.butsDomicile; hD.contre += m.butsExterieur; joues.set(m.domicile, hD);
    hE.j++; hE.pour += m.butsExterieur; hE.contre += m.butsDomicile; joues.set(m.exterieur, hE);
    ecoulees.push(m);
  }
}

for (const d of donnees) {
  evaluer(d.s2023, d.s2024, 'RÉGLAGE 2024-25');
  evaluer(d.s2024, d.s2025, 'VALIDATION 2025-26');
}

for (const phase of ['RÉGLAGE 2024-25', 'VALIDATION 2025-26']) {
  console.log(`\n===== ${phase} — UNIQUEMENT LES MATCHS AVEC UN PROMU =====`);
  for (const [k, s] of Object.entries(res)) {
    if (!k.startsWith(phase + '|')) continue;
    console.log(
      `  ${k.split('|')[1].padEnd(34)} ${String(s.n).padStart(4)} matchs | issue ${((100 * s.ok) / s.n).toFixed(2).padStart(6)} % | exact ${((100 * s.exact) / s.n).toFixed(2).padStart(5)} % | err. buts ${(s.err / s.n).toFixed(3)}`
    );
  }
}
