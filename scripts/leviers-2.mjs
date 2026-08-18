/**
 * DEUXIÈME SÉRIE DE LEVIERS.
 *
 * Trois pistes qui ne coûtent aucun appel supplémentaire au fournisseur — tout
 * est déjà dans les rencontres qu'on lit déjà.
 *
 *  A. LA FRAÎCHEUR DES DONNÉES. Aujourd'hui, un match d'il y a dix mois pèse
 *     autant que celui de la semaine dernière. Une équipe qui s'est effondrée
 *     en janvier traîne encore son mois d'août. On fait donc décroître le poids
 *     d'une rencontre avec son âge.
 *
 *  B. LE REPOS. Une équipe qui a joué trois jours plus tôt n'est pas la même.
 *     La date de chaque rencontre est connue : le nombre de jours de repos se
 *     déduit sans rien demander.
 *
 *  C. LE NIVEAU DES CHAMPIONNATS. En coupe d'Europe, deux clubs viennent de
 *     championnats différents. Leurs forces sont pourtant mesurées chacune par
 *     rapport à SA propre ligue : une attaque de 1,4 au Danemark et une attaque
 *     de 1,4 en Angleterre sont traitées à égalité. Elles ne le sont pas.
 *
 * Réglage sur 2024-25, validation sur 2025-26. Jamais de retouche après avoir
 * vu le second jeu.
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

const LIGUES = [39, 140, 135, 78, 61, 94, 88, 144, 203, 179, 218, 207, 119, 103, 106, 197];
const TERMINE = ['FT', 'AET', 'PEN'];
const borner = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX = 8;
const JOUR = 24 * 3600 * 1000;
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

/**
 * Forces ajustées à l'adversaire, avec vieillissement optionnel.
 *
 * @param demiVie Nombre de JOURS au bout duquel une rencontre ne pèse plus que
 *                la moitié. `null` = aucun vieillissement, le comportement
 *                actuel.
 */
function forces(matchs, instant, demiVie = null) {
  if (!matchs.length) return null;
  const poidsDe = (m) =>
    demiVie === null ? 1 : Math.pow(0.5, (instant - m.date) / JOUR / demiVie);

  let sD = 0, sE = 0, sP = 0;
  for (const m of matchs) { const w = poidsDe(m); sD += w * m.butsDomicile; sE += w * m.butsExterieur; sP += w; }
  const bDom = Math.max(0.4, sD / sP), bExt = Math.max(0.4, sE / sP);

  const h = new Map();
  for (const m of matchs) {
    const w = poidsDe(m);
    for (const [id, pour, contre, aDom, adv] of [
      [m.domicile, m.butsDomicile, m.butsExterieur, true, m.exterieur],
      [m.exterieur, m.butsExterieur, m.butsDomicile, false, m.domicile],
    ]) {
      const e = h.get(id) ?? { poids: 0, r: [] };
      e.poids += w;
      e.r.push({ adv, pour, contre, aDom, w });
      h.set(id, e);
    }
  }

  const f = new Map();
  for (const [id, e] of h) f.set(id, { attaque: 1, defense: 1, matchs: e.r.length, poids: e.poids });
  for (let tour = 0; tour < 5; tour++) {
    const suiv = new Map();
    for (const [id, e] of h) {
      let pour = 0, attPour = 0, contre = 0, attContre = 0;
      for (const r of e.r) {
        const o = f.get(r.adv) ?? { attaque: 1, defense: 1 };
        pour += r.w * r.pour; attPour += r.w * (r.aDom ? bDom : bExt) * o.defense;
        contre += r.w * r.contre; attContre += r.w * (r.aDom ? bExt : bDom) * o.attaque;
      }
      const K = 6, p = e.poids / (e.poids + K);
      suiv.set(id, {
        attaque: borner(p * (attPour > 0 ? pour / attPour : 1) + (1 - p), 0.35, 2.6),
        defense: borner(p * (attContre > 0 ? contre / attContre : 1) + (1 - p), 0.35, 2.6),
        matchs: e.r.length, poids: e.poids,
      });
    }
    for (const [id, v] of suiv) f.set(id, v);
  }
  return { f, bDom, bExt };
}

/** Mélange socle (saison passée) et saison en cours, comme en production. */
function melanger(socle, courant) {
  const out = new Map();
  const ids = new Set([...(socle?.f.keys() ?? []), ...(courant?.f.keys() ?? [])]);
  for (const id of ids) {
    const b = socle?.f.get(id) ?? { attaque: 1, defense: 1, matchs: 0 };
    const c = courant?.f.get(id);
    if (!c || c.matchs === 0) { out.set(id, b); continue; }
    const w = c.matchs / (c.matchs + 20);
    out.set(id, {
      attaque: borner((1 - w) * b.attaque + w * c.attaque, 0.35, 2.6),
      defense: borner((1 - w) * b.defense + w * c.defense, 0.35, 2.6),
      matchs: b.matchs + c.matchs,
    });
  }
  return out;
}

const res = {};
const noter = (phase, nom, m, r) => {
  const s = (res[`${phase}|${nom}`] ??= { n: 0, ok: 0, exact: 0 });
  const iR = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
  s.n++;
  if (r.issue === iR) s.ok++;
  if (r.score[0] === m.butsDomicile && r.score[1] === m.butsExterieur) s.exact++;
};

const DEMI_VIES = [null, 365, 180, 120, 60];
/** Effet du repos : réduction d'attaque par jour de repos manquant sous 5 jours. */
const EFFETS_REPOS = [0, 0.02, 0.04, 0.07];

function evaluer(passee, courante, phase) {
  const derniereRencontre = new Map();
  const ecoulees = [];

  for (const m of courante) {
    // Socle et saison en cours, pour chaque demi-vie testée.
    for (const dv of DEMI_VIES) {
      const socle = forces(passee, m.date, dv);
      const courant = ecoulees.length ? forces(ecoulees, m.date, dv) : null;
      if (!socle) continue;
      const eq = melanger(socle, courant);
      const f1 = eq.get(m.domicile), f2 = eq.get(m.exterieur);
      if (!f1 || !f2) continue;
      const l1 = borner(f1.attaque * f2.defense * socle.bDom, 0.25, 4);
      const l2 = borner(f2.attaque * f1.defense * socle.bExt, 0.25, 4);
      noter(phase, dv === null ? 'A. aucun vieillissement (actuel)' : `A. demi-vie ${dv} jours`, m, issueDe(l1, l2));

      // ── B. LE REPOS, seulement sur la variante actuelle ──────────────────
      if (dv === null) {
        const reposD = derniereRencontre.has(m.domicile) ? (m.date - derniereRencontre.get(m.domicile)) / JOUR : 7;
        const reposE = derniereRencontre.has(m.exterieur) ? (m.date - derniereRencontre.get(m.exterieur)) / JOUR : 7;
        for (const effet of EFFETS_REPOS) {
          if (effet === 0) continue;
          const penalite = (jours) => 1 - effet * Math.max(0, 5 - Math.min(jours, 5));
          noter(phase, `B. repos, effet ${effet}`, m, issueDe(
            borner(l1 * penalite(reposD), 0.25, 4),
            borner(l2 * penalite(reposE), 0.25, 4)
          ));
        }
      }
    }

    derniereRencontre.set(m.domicile, m.date);
    derniereRencontre.set(m.exterieur, m.date);
    ecoulees.push(m);
  }
}

const donnees = [];
for (const id of LIGUES) {
  const [a, b, c] = await Promise.all([matchsDe(id, 2023), matchsDe(id, 2024), matchsDe(id, 2025)]);
  if (a.length < 100 || b.length < 100 || c.length < 100) continue;
  donnees.push({ id, s2023: a, s2024: b, s2025: c });
}
console.log(`${donnees.length} championnats\n`);

for (const d of donnees) {
  evaluer(d.s2023, d.s2024, 'RÉGLAGE');
  evaluer(d.s2024, d.s2025, 'VALIDATION');
}

for (const phase of ['RÉGLAGE', 'VALIDATION']) {
  console.log(`\n================ ${phase} ================`);
  const ref = res[`${phase}|A. aucun vieillissement (actuel)`];
  for (const [k, s] of Object.entries(res)) {
    if (!k.startsWith(phase + '|')) continue;
    const nom = k.split('|')[1];
    const ecart = s === ref ? '' : `  (${((100 * s.ok) / s.n - (100 * ref.ok) / ref.n >= 0 ? '+' : '')}${((100 * s.ok) / s.n - (100 * ref.ok) / ref.n).toFixed(2)} pt)`;
    console.log(`  ${nom.padEnd(34)} ${String(s.n).padStart(5)} | issue ${((100 * s.ok) / s.n).toFixed(2).padStart(6)} % | exact ${((100 * s.exact) / s.n).toFixed(2).padStart(5)} %${ecart}`);
  }
}
