/**
 * LES BUTS ATTENDUS (xG) COMME MESURE DE LA FORCE.
 *
 * L'IDÉE, ET POURQUOI C'EST LA PISTE LA PLUS SÉRIEUSE QUI RESTE
 *
 * Une équipe qui tire vingt fois et marque une fois a mal fini, pas mal joué.
 * L'inverse existe aussi : deux frappes, deux buts. Les buts contiennent
 * beaucoup de réussite pure, et la réussite ne se reproduit pas.
 *
 * Les buts ATTENDUS mesurent la qualité des occasions créées. En analyse
 * football, ils prédisent mieux les résultats futurs que les buts réellement
 * inscrits. Le moteur, lui, ne connaît aujourd'hui que les buts.
 *
 * Le fournisseur les donne par rencontre. On les récupère, on rebâtit les
 * forces dessus, et on compare — mêmes matchs, même machinerie, seule la
 * matière première change.
 *
 * REPRISE : les xG sont écrits sur le disque au fur et à mesure. Une
 * interruption ne repaie pas ce qui a déjà été payé.
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

const LIGUES = [[39, 'Premier League'], [140, 'La Liga'], [135, 'Serie A'], [78, 'Bundesliga']];
const TERMINE = ['FT', 'AET', 'PEN'];
const borner = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX = 8;
const poisson = (k, l) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const FICHIER = 'scripts/.xg.json';
const xg = fs.existsSync(FICHIER) ? JSON.parse(fs.readFileSync(FICHIER, 'utf8')) : {};
let ecritsDepuis = 0;

async function matchsDe(ligue, an) {
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

/** Les buts attendus des deux équipes d'une rencontre. */
async function lireXg(m) {
  if (xg[m.id] !== undefined) return xg[m.id];
  const d = await apiFootball(`/fixtures/statistics?fixture=${m.id}`, CACHE_TTL.TEAM_INFO);
  await pause(300);
  const par = {};
  for (const e of d?.response ?? []) {
    const v = (e.statistics ?? []).find((s) => s.type === 'expected_goals')?.value;
    if (v != null) par[Number(e.team?.id)] = Number(v);
  }
  const paire = par[m.domicile] != null && par[m.exterieur] != null
    ? [par[m.domicile], par[m.exterieur]]
    : null;
  xg[m.id] = paire;
  if (++ecritsDepuis >= 25) { fs.writeFileSync(FICHIER, JSON.stringify(xg)); ecritsDepuis = 0; }
  return paire;
}

/**
 * Forces ajustées à l'adversaire.
 * @param source 'buts' ou 'xg' — la seule chose qui change entre les variantes.
 */
function forces(matchs, source) {
  const valeurs = matchs
    .map((m) => (source === 'xg' ? m.xg : [m.butsDomicile, m.butsExterieur]))
    .filter(Boolean);
  if (valeurs.length < 20) return null;

  const utilisables = matchs.filter((m) => (source === 'xg' ? m.xg : true));
  const bDom = Math.max(0.4, utilisables.reduce((a, m) => a + (source === 'xg' ? m.xg[0] : m.butsDomicile), 0) / utilisables.length);
  const bExt = Math.max(0.4, utilisables.reduce((a, m) => a + (source === 'xg' ? m.xg[1] : m.butsExterieur), 0) / utilisables.length);

  const h = new Map();
  for (const m of utilisables) {
    const [vd, ve] = source === 'xg' ? m.xg : [m.butsDomicile, m.butsExterieur];
    for (const [id, pour, contre, aDom, adv] of [
      [m.domicile, vd, ve, true, m.exterieur],
      [m.exterieur, ve, vd, false, m.domicile],
    ]) {
      const e = h.get(id) ?? { r: [] };
      e.r.push({ adv, pour, contre, aDom });
      h.set(id, e);
    }
  }

  const f = new Map();
  for (const [id, e] of h) f.set(id, { attaque: 1, defense: 1, matchs: e.r.length });
  for (let tour = 0; tour < 5; tour++) {
    const suiv = new Map();
    for (const [id, e] of h) {
      let pour = 0, attPour = 0, contre = 0, attContre = 0;
      for (const r of e.r) {
        const o = f.get(r.adv) ?? { attaque: 1, defense: 1 };
        pour += r.pour; attPour += (r.aDom ? bDom : bExt) * o.defense;
        contre += r.contre; attContre += (r.aDom ? bExt : bDom) * o.attaque;
      }
      const n = e.r.length, p = n / (n + 6);
      suiv.set(id, {
        attaque: borner(p * (attPour > 0 ? pour / attPour : 1) + (1 - p), 0.35, 2.6),
        defense: borner(p * (attContre > 0 ? contre / attContre : 1) + (1 - p), 0.35, 2.6),
        matchs: n,
      });
    }
    for (const [id, v] of suiv) f.set(id, v);
  }
  return { f, bDom, bExt };
}

function melanger(socle, courant) {
  const out = new Map();
  const ids = new Set([...(socle?.f.keys() ?? []), ...(courant?.f.keys() ?? [])]);
  for (const id of ids) {
    const b = socle?.f.get(id) ?? { attaque: 1, defense: 1, matchs: 0 };
    const c = courant?.f.get(id);
    if (!c || !c.matchs) { out.set(id, b); continue; }
    const w = c.matchs / (c.matchs + 20);
    out.set(id, {
      attaque: borner((1 - w) * b.attaque + w * c.attaque, 0.35, 2.6),
      defense: borner((1 - w) * b.defense + w * c.defense, 0.35, 2.6),
      matchs: b.matchs + c.matchs,
    });
  }
  return out;
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

// ── Collecte ────────────────────────────────────────────────────────────────
const donnees = [];
for (const [id, nom] of LIGUES) {
  const saisons = {};
  for (const an of [2023, 2024, 2025]) saisons[an] = await matchsDe(id, an);
  if (Object.values(saisons).some((s) => s.length < 100)) { console.log(`  ${nom} ignoré`); continue; }

  let manquants = 0;
  for (const an of [2023, 2024, 2025]) {
    for (const m of saisons[an]) {
      m.xg = await lireXg(m);
      if (!m.xg) manquants++;
    }
    console.log(`  ${nom} ${an} : ${saisons[an].length} matchs, ${saisons[an].filter((m) => m.xg).length} avec xG`);
  }
  donnees.push({ nom, ...saisons });
}
fs.writeFileSync(FICHIER, JSON.stringify(xg));

// ── Évaluation ──────────────────────────────────────────────────────────────
const res = {};
const noter = (phase, nom, m, r) => {
  const s = (res[`${phase}|${nom}`] ??= { n: 0, ok: 0, exact: 0 });
  const iR = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
  s.n++;
  if (r.issue === iR) s.ok++;
  if (r.score[0] === m.butsDomicile && r.score[1] === m.butsExterieur) s.exact++;
};

function evaluer(passee, courante, phase) {
  const socles = { buts: forces(passee, 'buts'), xg: forces(passee, 'xg') };
  const ecoulees = [];
  for (const m of courante) {
    for (const source of ['buts', 'xg']) {
      const socle = socles[source];
      if (!socle) continue;
      const courant = ecoulees.length >= 20 ? forces(ecoulees, source) : null;
      const eq = melanger(socle, courant);
      const f1 = eq.get(m.domicile), f2 = eq.get(m.exterieur);
      if (!f1 || !f2) continue;
      noter(phase, source === 'buts' ? 'forces sur les BUTS (actuel)' : 'forces sur les xG', m, issueDe(
        borner(f1.attaque * f2.defense * socle.bDom, 0.25, 4),
        borner(f2.attaque * f1.defense * socle.bExt, 0.25, 4)
      ));
    }

    // Moitié buts, moitié xG : la réussite compte un peu, mais pas tout.
    const sB = socles.buts, sX = socles.xg;
    if (sB && sX) {
      const cB = ecoulees.length >= 20 ? forces(ecoulees, 'buts') : null;
      const cX = ecoulees.length >= 20 ? forces(ecoulees, 'xg') : null;
      const eB = melanger(sB, cB), eX = melanger(sX, cX);
      const b1 = eB.get(m.domicile), b2 = eB.get(m.exterieur);
      const x1 = eX.get(m.domicile), x2 = eX.get(m.exterieur);
      if (b1 && b2 && x1 && x2) {
        for (const part of [0.3, 0.5, 0.7]) {
          const mel = (b, x) => (1 - part) * b + part * x;
          noter(phase, `mélange ${Math.round(100 * part)} % xG`, m, issueDe(
            borner(mel(b1.attaque, x1.attaque) * mel(b2.defense, x2.defense) * sB.bDom, 0.25, 4),
            borner(mel(b2.attaque, x2.attaque) * mel(b1.defense, x1.defense) * sB.bExt, 0.25, 4)
          ));
        }
      }
    }
    ecoulees.push(m);
  }
}

for (const d of donnees) {
  evaluer(d[2023], d[2024], 'RÉGLAGE');
  evaluer(d[2024], d[2025], 'VALIDATION');
}

for (const phase of ['RÉGLAGE', 'VALIDATION']) {
  console.log(`\n================ ${phase} ================`);
  const ref = res[`${phase}|forces sur les BUTS (actuel)`];
  for (const [k, s] of Object.entries(res)) {
    if (!k.startsWith(phase + '|')) continue;
    const ecart = s === ref ? '' : `  (${((100 * s.ok) / s.n - (100 * ref.ok) / ref.n >= 0 ? '+' : '')}${((100 * s.ok) / s.n - (100 * ref.ok) / ref.n).toFixed(2)} pt)`;
    console.log(`  ${k.split('|')[1].padEnd(32)} ${String(s.n).padStart(5)} | issue ${((100 * s.ok) / s.n).toFixed(2).padStart(6)} % | exact ${((100 * s.exact) / s.n).toFixed(2).padStart(5)} %${ecart}`);
  }
}
