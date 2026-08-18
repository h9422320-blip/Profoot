/**
 * MISE À L'ÉPREUVE DES PROCHAINS LEVIERS.
 *
 * DEUX JEUX SÉPARÉS, ET C'EST LE POINT LE PLUS IMPORTANT
 *
 * Toute constante choisie en regardant un jeu de données finit par lui coller
 * à la peau. On règle donc sur la saison 2024-25 et on VALIDE sur 2025-26, sans
 * jamais toucher au réglage après avoir vu le second. Un levier qui gagne sur
 * le premier et perd sur le second est un mirage, pas une amélioration.
 *
 * Aucun appel supplémentaire au fournisseur : une requête par championnat et
 * par saison, mise en réserve.
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

const LIGUES = [
  [39, 'Premier League'], [140, 'La Liga'], [135, 'Serie A'], [78, 'Bundesliga'],
  [61, 'Ligue 1'], [94, 'Primeira Liga'], [88, 'Eredivisie'], [144, 'Jupiler Pro League'],
  [203, 'Süper Lig'], [179, 'Premiership'], [218, 'Bundesliga Autriche'], [207, 'Super League Suisse'],
  [119, 'Superliga Danemark'], [103, 'Eliteserien'], [106, 'Ekstraklasa'], [197, 'Super League Grèce'],
];
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
  return { score: best[iss].s, issue: iss, probas: [v1, n, v2] };
}

// ── LEVIER 1 : forces séparées domicile / extérieur ─────────────────────────
//
// Une équipe n'a pas la même force selon le terrain. On calcule donc quatre
// nombres par équipe au lieu de deux, chacun ajusté à l'adversaire.
const AMORTI = 6;
function forcesParTerrain(matchs) {
  if (!matchs.length) return null;
  const bDom = Math.max(0.4, matchs.reduce((a, m) => a + m.butsDomicile, 0) / matchs.length);
  const bExt = Math.max(0.4, matchs.reduce((a, m) => a + m.butsExterieur, 0) / matchs.length);

  const h = new Map();
  for (const m of matchs) {
    for (const [id, pour, contre, aDom, adv] of [
      [m.domicile, m.butsDomicile, m.butsExterieur, true, m.exterieur],
      [m.exterieur, m.butsExterieur, m.butsDomicile, false, m.domicile],
    ]) {
      const e = h.get(id) ?? { dom: [], ext: [] };
      (aDom ? e.dom : e.ext).push({ adv, pour, contre });
      h.set(id, e);
    }
  }

  const f = new Map();
  for (const [id] of h) f.set(id, { attDom: 1, defDom: 1, attExt: 1, defExt: 1, matchs: (h.get(id).dom.length + h.get(id).ext.length) });

  for (let tour = 0; tour < 5; tour++) {
    const suiv = new Map();
    for (const [id, e] of h) {
      const calc = (liste, aDom) => {
        let pour = 0, attendusPour = 0, contre = 0, attendusContre = 0;
        for (const r of liste) {
          const o = f.get(r.adv) ?? { attDom: 1, defDom: 1, attExt: 1, defExt: 1 };
          // Chez soi, on affronte la défense d'une équipe EN DÉPLACEMENT.
          pour += r.pour; attendusPour += (aDom ? bDom : bExt) * (aDom ? o.defExt : o.defDom);
          contre += r.contre; attendusContre += (aDom ? bExt : bDom) * (aDom ? o.attExt : o.attDom);
        }
        const n = liste.length, p = n / (n + AMORTI);
        return {
          att: borner(p * (attendusPour > 0 ? pour / attendusPour : 1) + (1 - p), 0.35, 2.6),
          def: borner(p * (attendusContre > 0 ? contre / attendusContre : 1) + (1 - p), 0.35, 2.6),
        };
      };
      const d = calc(e.dom, true), x = calc(e.ext, false);
      suiv.set(id, { attDom: d.att, defDom: d.def, attExt: x.att, defExt: x.def, matchs: e.dom.length + e.ext.length });
    }
    for (const [id, v] of suiv) f.set(id, v);
  }
  return { f, bDom, bExt };
}

// ── LEVIER 3 : les promus ───────────────────────────────────────────────────
//
// Un promu n'a pas de saison passée DANS ce championnat. Plutôt que de le
// renvoyer à l'ancien calcul, on lui donne l'a priori mesuré sur les promus
// des saisons précédentes : ce qu'ils valent RÉELLEMENT en moyenne, une fois
// montés. La valeur est mesurée sur le jeu de réglage, jamais devinée.
function mesurerPromus(socleAvant, saisonSuivante) {
  const connus = new Set(socleAvant.equipes.keys());
  const nouveaux = new Set();
  for (const m of saisonSuivante) {
    if (!connus.has(m.domicile)) nouveaux.add(m.domicile);
    if (!connus.has(m.exterieur)) nouveaux.add(m.exterieur);
  }
  if (nouveaux.size === 0) return null;
  const apres = calculerForces(saisonSuivante, []);
  let att = 0, def = 0, n = 0;
  for (const id of nouveaux) {
    const f = apres.equipes.get(id);
    if (f) { att += f.attaque; def += f.defense; n++; }
  }
  return n ? { attaque: att / n, defense: def / n, echantillon: n } : null;
}

// ── Chargement ──────────────────────────────────────────────────────────────
const donnees = [];
for (const [id, nom] of LIGUES) {
  const [s2023, s2024, s2025] = await Promise.all([matchsDe(id, 2023), matchsDe(id, 2024), matchsDe(id, 2025)]);
  if (s2023.length < 100 || s2024.length < 100 || s2025.length < 100) { console.log(`  ${nom} — ignoré`); continue; }
  donnees.push({ id, nom, s2023, s2024, s2025 });
}
console.log(`\n${donnees.length} championnats chargés\n`);

// A priori « promu », mesuré sur le jeu de RÉGLAGE uniquement.
let sommeAtt = 0, sommeDef = 0, nbPromus = 0;
for (const d of donnees) {
  const socle = calculerForces(d.s2023, []);
  const p = mesurerPromus(socle, d.s2024);
  if (p) { sommeAtt += p.attaque * p.echantillon; sommeDef += p.defense * p.echantillon; nbPromus += p.echantillon; }
}
const APRIORI_PROMU = nbPromus
  ? { attaque: sommeAtt / nbPromus, defense: sommeDef / nbPromus }
  : { attaque: 0.9, defense: 1.1 };
console.log(`A priori « promu » mesuré sur ${nbPromus} équipes du jeu de réglage : attaque ${APRIORI_PROMU.attaque.toFixed(3)}, défense ${APRIORI_PROMU.defense.toFixed(3)}\n`);

// ── Évaluation ──────────────────────────────────────────────────────────────
function evaluerSaison(passee, courante, res, phase) {
  const socleGlobal = calculerForces(passee, []);
  const parTerrain = forcesParTerrain(passee);
  const joues = new Map();
  const ecoulees = [];

  for (const m of courante) {
    const jD = joues.get(m.domicile) ?? 0, jE = joues.get(m.exterieur) ?? 0;
    const debut = Math.min(jD, jE) <= 4;
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile), f2 = forces.equipes.get(m.exterieur);

    const noter = (nom, r) => {
      for (const p of [phase, debut ? `${phase} / début de saison` : `${phase} / reste`]) {
        const s = (res[`${p}|${nom}`] ??= { n: 0, ok: 0, exact: 0, errButs: 0 });
        const iR = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
        s.n++;
        if (r.issue === iR) s.ok++;
        if (r.score[0] === m.butsDomicile && r.score[1] === m.butsExterieur) s.exact++;
        s.errButs += Math.abs(r.score[0] - m.butsDomicile) + Math.abs(r.score[1] - m.butsExterieur);
      }
    };

    // ── Référence : le moteur en ligne ────────────────────────────────────
    if (f1 && f2) {
      noter('EN LIGNE (forces globales)', issueEtScore(
        borner(f1.attaque * f2.defense * forces.butsDomicile, 0.25, 4),
        borner(f2.attaque * f1.defense * forces.butsExterieur, 0.25, 4)
      ));
    }

    // ── Levier 1 : forces séparées domicile / extérieur ───────────────────
    if (parTerrain) {
      const a = parTerrain.f.get(m.domicile), b = parTerrain.f.get(m.exterieur);
      if (a && b) {
        noter('L1 domicile/extérieur séparés', issueEtScore(
          borner(a.attDom * b.defExt * parTerrain.bDom, 0.25, 4),
          borner(b.attExt * a.defDom * parTerrain.bExt, 0.25, 4)
        ));
      }
    }

    // ── Levier 3 : a priori pour les promus ───────────────────────────────
    const g1 = f1 ?? { attaque: APRIORI_PROMU.attaque, defense: APRIORI_PROMU.defense, matchs: 0 };
    const g2 = f2 ?? { attaque: APRIORI_PROMU.attaque, defense: APRIORI_PROMU.defense, matchs: 0 };
    noter('L3 a priori promu', issueEtScore(
      borner(g1.attaque * g2.defense * forces.butsDomicile, 0.25, 4),
      borner(g2.attaque * g1.defense * forces.butsExterieur, 0.25, 4)
    ));

    // ── Levier 4 : avantage du terrain UNIQUE, pour vérifier qu'il est déjà
    //    par championnat dans le moteur en ligne ────────────────────────────
    if (f1 && f2) {
      noter('L4 avantage du terrain unique', issueEtScore(
        borner(f1.attaque * f2.defense * 1.53, 0.25, 4),
        borner(f2.attaque * f1.defense * 1.20, 0.25, 4)
      ));
    }

    // ── Combinaison des leviers qui tiennent ──────────────────────────────
    if (parTerrain) {
      const a = parTerrain.f.get(m.domicile) ?? { attDom: APRIORI_PROMU.attaque, defDom: APRIORI_PROMU.defense, attExt: APRIORI_PROMU.attaque, defExt: APRIORI_PROMU.defense };
      const b = parTerrain.f.get(m.exterieur) ?? { attDom: APRIORI_PROMU.attaque, defDom: APRIORI_PROMU.defense, attExt: APRIORI_PROMU.attaque, defExt: APRIORI_PROMU.defense };
      noter('L1+L3 combinés', issueEtScore(
        borner(a.attDom * b.defExt * parTerrain.bDom, 0.25, 4),
        borner(b.attExt * a.defDom * parTerrain.bExt, 0.25, 4)
      ));
    }

    joues.set(m.domicile, jD + 1); joues.set(m.exterieur, jE + 1);
    ecoulees.push(m);
  }
}

const res = {};
for (const d of donnees) {
  evaluerSaison(d.s2023, d.s2024, res, 'RÉGLAGE 2024-25');
  evaluerSaison(d.s2024, d.s2025, res, 'VALIDATION 2025-26');
}

for (const phase of ['RÉGLAGE 2024-25', 'VALIDATION 2025-26', 'RÉGLAGE 2024-25 / début de saison', 'VALIDATION 2025-26 / début de saison', 'RÉGLAGE 2024-25 / reste', 'VALIDATION 2025-26 / reste']) {
  const lignes = Object.entries(res).filter(([k]) => k.startsWith(phase + '|'));
  if (!lignes.length) continue;
  console.log(`\n================ ${phase} ================`);
  const ref = lignes.find(([k]) => k.includes('EN LIGNE'))?.[1];
  for (const [k, s] of lignes) {
    const nom = k.split('|')[1];
    const ecart = ref && s !== ref ? `  (${((100 * s.ok) / s.n - (100 * ref.ok) / ref.n >= 0 ? '+' : '')}${((100 * s.ok) / s.n - (100 * ref.ok) / ref.n).toFixed(1)} pt)` : '';
    console.log(
      `  ${nom.padEnd(32)} ${String(s.n).padStart(5)} matchs | issue ${((100 * s.ok) / s.n).toFixed(2).padStart(6)} % | exact ${((100 * s.exact) / s.n).toFixed(2).padStart(5)} % | err. buts ${(s.errButs / s.n).toFixed(3)}${ecart}`
    );
  }
}
