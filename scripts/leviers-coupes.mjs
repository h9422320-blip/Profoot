/**
 * LES COUPES D'EUROPE : DES FORCES QUI NE SONT PAS COMPARABLES.
 *
 * LE DÉFAUT
 *
 * Quand le moteur analyse Bodø/Glimt — Real Madrid, il lit les forces des deux
 * clubs dans la Ligue des champions elle-même : huit à treize rencontres, et
 * chacune mesurée par rapport à cette même poule. Une attaque de 1,4 en Norvège
 * et une attaque de 1,4 en Espagne y sont traitées à égalité.
 *
 * Elles ne le sont pas. Un club qui domine son championnat national ne vaut pas
 * automatiquement un club qui finit cinquième d'un grand championnat.
 *
 * CE QU'ON ESSAIE
 *
 * Prendre la force de chaque club dans SON championnat — trente-huit journées,
 * une matière autrement plus solide — puis corriger par le NIVEAU de ce
 * championnat, niveau qu'on estime à partir des confrontations européennes des
 * saisons précédentes. Aucune valeur écrite à la main : les championnats se
 * classent par leurs résultats.
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

const COUPES = [[2, 'Ligue des champions'], [3, 'Ligue Europa'], [848, 'Conference League']];
const CHAMPIONNATS = [39, 140, 135, 78, 61, 94, 88, 144, 203, 179, 218, 207, 119, 103, 106, 197, 113, 197, 271, 283, 345, 172, 210, 235, 197, 262, 218];
const TERMINE = ['FT', 'AET', 'PEN'];
const borner = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX = 8;
const poisson = (k, l) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; };

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

function issueDe(l1, l2) {
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
  return { issue: iss, score: best[iss].s };
}

// ── Chargement ──────────────────────────────────────────────────────────────
const SAISONS = [2023, 2024, 2025];
const ligues = new Map();   // `${ligue}:${an}` -> matchs
const equipeLigue = new Map(); // `${equipe}:${an}` -> ligue

for (const l of [...new Set(CHAMPIONNATS)]) {
  for (const an of SAISONS) {
    const m = await matchsDe(l, an);
    if (m.length < 80) continue;
    ligues.set(`${l}:${an}`, m);
    for (const x of m) {
      equipeLigue.set(`${x.domicile}:${an}`, l);
      equipeLigue.set(`${x.exterieur}:${an}`, l);
    }
  }
}
console.log(`${ligues.size} couples championnat/saison chargés`);

const coupes = new Map();
for (const [c] of COUPES) for (const an of SAISONS) {
  const m = await matchsDe(c, an);
  if (m.length) coupes.set(`${c}:${an}`, m);
}
console.log(`${[...coupes.values()].reduce((a, m) => a + m.length, 0)} rencontres européennes\n`);

/** Forces d'un championnat pour une saison, mises en réserve. */
const cacheForces = new Map();
function forcesChampionnat(ligue, an) {
  const cle = `${ligue}:${an}`;
  if (!cacheForces.has(cle)) {
    const m = ligues.get(cle);
    cacheForces.set(cle, m ? calculerForces(m, []) : null);
  }
  return cacheForces.get(cle);
}

/**
 * Niveau de chaque championnat, estimé sur les confrontations européennes
 * d'une ou plusieurs saisons. On part de « tous égaux » et on corrige.
 */
function niveauxDesChampionnats(saisonsReference) {
  const niveau = new Map();
  for (const cle of ligues.keys()) niveau.set(Number(cle.split(':')[0]), 1);

  for (let tour = 0; tour < 6; tour++) {
    const cumul = new Map(); // ligue -> { obs, att }
    for (const [cleCoupe, matchs] of coupes) {
      const an = Number(cleCoupe.split(':')[1]);
      if (!saisonsReference.includes(an)) continue;
      for (const m of matchs) {
        const lD = equipeLigue.get(`${m.domicile}:${an}`);
        const lE = equipeLigue.get(`${m.exterieur}:${an}`);
        if (!lD || !lE) continue;
        const fD = forcesChampionnat(lD, an)?.equipes.get(m.domicile);
        const fE = forcesChampionnat(lE, an)?.equipes.get(m.exterieur);
        if (!fD || !fE) continue;

        const nD = niveau.get(lD) ?? 1, nE = niveau.get(lE) ?? 1;
        // Ce que le modèle attend, niveaux compris.
        const attD = fD.attaque * nD * fE.defense / nE * 1.45;
        const attE = fE.attaque * nE * fD.defense / nD * 1.15;

        for (const [l, marques, attendus] of [[lD, m.butsDomicile, attD], [lE, m.butsExterieur, attE]]) {
          const c = cumul.get(l) ?? { obs: 0, att: 0 };
          c.obs += marques; c.att += attendus;
          cumul.set(l, c);
        }
      }
    }
    for (const [l, c] of cumul) {
      if (c.att <= 0 || c.obs <= 0) continue;
      // Amortissement : un championnat vu six fois n'a pas prouvé grand-chose.
      const ratio = Math.sqrt(c.obs / c.att);
      niveau.set(l, borner((niveau.get(l) ?? 1) * Math.pow(ratio, 0.5), 0.55, 1.8));
    }
  }
  return niveau;
}

const res = {};
const noter = (phase, nom, m, r) => {
  const s = (res[`${phase}|${nom}`] ??= { n: 0, ok: 0, exact: 0 });
  const iR = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
  s.n++;
  if (r.issue === iR) s.ok++;
  if (r.score[0] === m.butsDomicile && r.score[1] === m.butsExterieur) s.exact++;
};

function evaluer(anCible, phase, niveaux) {
  for (const [cleCoupe, matchs] of coupes) {
    const [coupe, an] = cleCoupe.split(':').map(Number);
    if (an !== anCible) continue;

    const ecoulees = [];
    for (const m of matchs) {
      // ── Modèle actuel : les forces lues DANS la coupe elle-même ─────────
      const socleCoupe = coupes.get(`${coupe}:${an - 1}`);
      if (socleCoupe) {
        const f = calculerForces(socleCoupe, ecoulees);
        const a = f.equipes.get(m.domicile), b = f.equipes.get(m.exterieur);
        if (a && b) {
          noter(phase, 'actuel : forces lues dans la coupe', m, issueDe(
            borner(a.attaque * b.defense * f.butsDomicile, 0.25, 4),
            borner(b.attaque * a.defense * f.butsExterieur, 0.25, 4)
          ));
        }
      }

      // ── Proposé : forces du championnat national, corrigées du niveau ───
      const lD = equipeLigue.get(`${m.domicile}:${an}`) ?? equipeLigue.get(`${m.domicile}:${an - 1}`);
      const lE = equipeLigue.get(`${m.exterieur}:${an}`) ?? equipeLigue.get(`${m.exterieur}:${an - 1}`);
      if (lD && lE) {
        const fD = forcesChampionnat(lD, an - 1)?.equipes.get(m.domicile);
        const fE = forcesChampionnat(lE, an - 1)?.equipes.get(m.exterieur);
        if (fD && fE) {
          const nD = niveaux.get(lD) ?? 1, nE = niveaux.get(lE) ?? 1;
          noter(phase, 'proposé : championnat + niveau', m, issueDe(
            borner(fD.attaque * nD * (fE.defense / nE) * 1.45, 0.25, 4),
            borner(fE.attaque * nE * (fD.defense / nD) * 1.15, 0.25, 4)
          ));
          // Sans correction de niveau, pour isoler ce que le niveau apporte.
          noter(phase, 'championnat SANS niveau', m, issueDe(
            borner(fD.attaque * fE.defense * 1.45, 0.25, 4),
            borner(fE.attaque * fD.defense * 1.15, 0.25, 4)
          ));
        }
      }

      noter(phase, 'repère : toujours le domicile', m, { issue: 1, score: [2, 1] });
      ecoulees.push(m);
    }
  }
}

// Niveaux estimés sur 2023-24 seulement, puis appliqués aux deux jeux : aucune
// information de la saison jugée ne sert à établir le niveau.
const niveaux = niveauxDesChampionnats([2023]);
const tri = [...niveaux.entries()].sort((a, b) => b[1] - a[1]);
console.log('Niveau estimé des championnats (échantillon 2023-24) :');
for (const [l, n] of tri.slice(0, 6)) console.log(`   ligue ${String(l).padStart(4)} : ${n.toFixed(3)}`);
console.log('   ...');
for (const [l, n] of tri.slice(-4)) console.log(`   ligue ${String(l).padStart(4)} : ${n.toFixed(3)}`);

evaluer(2024, 'RÉGLAGE 2024-25', niveaux);
evaluer(2025, 'VALIDATION 2025-26', niveaux);

for (const phase of ['RÉGLAGE 2024-25', 'VALIDATION 2025-26']) {
  console.log(`\n================ ${phase} — COUPES D'EUROPE ================`);
  for (const [k, s] of Object.entries(res)) {
    if (!k.startsWith(phase + '|')) continue;
    console.log(`  ${k.split('|')[1].padEnd(36)} ${String(s.n).padStart(4)} | issue ${((100 * s.ok) / s.n).toFixed(2).padStart(6)} % | exact ${((100 * s.exact) / s.n).toFixed(2).padStart(5)} %`);
  }
}
