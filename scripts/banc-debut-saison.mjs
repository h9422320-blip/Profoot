/**
 * LE DÉBUT DE SAISON — là où le moteur souffre le plus, et c'est maintenant.
 *
 * En août, une équipe a joué une, deux, trois rencontres. Le moteur calcule ses
 * moyennes sur cette poignée de matchs : une équipe battue 0-1 à l'ouverture est
 * réputée ne jamais marquer. Pendant ce temps, la saison PRÉCÉDENTE contient
 * trente-huit journées sur cette même équipe, et le moteur ne s'en sert pas pour
 * établir sa force.
 *
 * On mesure ici ce que vaut chaque approche sur les cinq premières journées.
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

const LIGUES = [39, 140, 135, 78, 61, 94, 88, 144, 203, 179];
const TERMINE = ['FT', 'AET', 'PEN'];
const poisson = (k, l) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; };
const borner = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX = 8;

async function saison(ligue, an) {
  const d = await apiFootball(`/fixtures?league=${ligue}&season=${an}`, CACHE_TTL.TEAM_INFO);
  return (d?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      date: new Date(f.fixture.date).getTime(),
      dom: f.teams.home.id, ext: f.teams.away.id,
      bd: Number(f.goals.home ?? 0), be: Number(f.goals.away ?? 0),
    }))
    .sort((a, b) => a.date - b.date);
}

/** Forces d'attaque et de défense ajustées aux adversaires rencontrés. */
function forces(matchs) {
  if (!matchs.length) return { f: new Map(), dom: 1.5, ext: 1.2 };
  const dom = matchs.reduce((a, m) => a + m.bd, 0) / matchs.length;
  const ext = matchs.reduce((a, m) => a + m.be, 0) / matchs.length;
  const par = new Map();
  for (const m of matchs) {
    for (const [id, pour, contre, aDom, adv] of [
      [m.dom, m.bd, m.be, true, m.ext],
      [m.ext, m.be, m.bd, false, m.dom],
    ]) {
      const e = par.get(id) ?? { j: 0, adv: [] };
      e.j++; e.adv.push({ adv, pour, contre, aDom });
      par.set(id, e);
    }
  }
  const f = new Map();
  for (const [id] of par) f.set(id, { att: 1, def: 1 });
  for (let tour = 0; tour < 5; tour++) {
    const next = new Map();
    for (const [id, e] of par) {
      let an = 0, ad = 0, dn = 0, dd = 0;
      for (const a of e.adv) {
        const o = f.get(a.adv) ?? { att: 1, def: 1 };
        an += a.pour; ad += (a.aDom ? dom : ext) * o.def;
        dn += a.contre; dd += (a.aDom ? ext : dom) * o.att;
      }
      const K = 6, p = e.j / (e.j + K);
      next.set(id, {
        att: borner(p * (ad > 0 ? an / ad : 1) + (1 - p), 0.35, 2.6),
        def: borner(p * (dd > 0 ? dn / dd : 1) + (1 - p), 0.35, 2.6),
      });
    }
    for (const [id, v] of next) f.set(id, v);
  }
  return { f, dom, ext };
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

const res = {};
const noter = (nom, m, r) => {
  const s = (res[nom] ??= { n: 0, ok: 0, exact: 0, buts: 0 });
  const iR = m.bd > m.be ? 1 : m.bd === m.be ? 0 : 2;
  s.n++; if (r.issue === iR) s.ok++;
  if (r.score[0] === m.bd && r.score[1] === m.be) s.exact++;
  s.buts += r.score[0] + r.score[1];
};

let evalues = 0;
for (const ligue of LIGUES) {
  const passee = await saison(ligue, 2024);
  const courante = await saison(ligue, 2025);
  if (!passee.length || !courante.length) continue;

  const { f: fPassee, dom: dPassee, ext: ePassee } = forces(passee);

  // Les CINQ PREMIÈRES journées : chaque équipe a joué de 0 à 4 matchs.
  const parEquipe = new Map();
  for (const m of courante) {
    const jD = parEquipe.get(m.dom) ?? [], jE = parEquipe.get(m.ext) ?? [];
    const joues = Math.min(jD.length, jE.length);

    if (joues <= 4) {
      // ── Ce que fait le moteur aujourd'hui : les moyennes de la saison en
      //    cours, c'est-à-dire presque rien.
      const st = (h) => {
        const pour = h.reduce((a, x) => a + x.pour, 0), contre = h.reduce((a, x) => a + x.contre, 0);
        const j = Math.max(1, h.length);
        return { a: pour / j, d: contre / j };
      };
      const A = st(jD), B = st(jE);
      const moy = Math.max(0.4, (A.a + A.d + B.a + B.d) / 4) || 1.35;
      const l1 = borner((A.a / moy) * (B.d / moy) * moy * 1.15, 0.25, 4);
      const l2 = borner((B.a / moy) * (A.d / moy) * moy * 0.92, 0.25, 4);
      noter('actuel (saison en cours seule)', m, issueEtScore(l1, l2));

      // ── Avec la saison précédente comme socle ────────────────────────────
      const a = fPassee.get(m.dom) ?? { att: 1, def: 1 };
      const b = fPassee.get(m.ext) ?? { att: 1, def: 1 };
      noter('socle : saison précédente', m, issueEtScore(
        borner(a.att * b.def * dPassee, 0.25, 4),
        borner(b.att * a.def * ePassee, 0.25, 4)
      ));

      // ── Socle + ce qu'on apprend de la saison en cours ────────────────────
      // Le poids de la saison en cours grandit journée après journée : à quatre
      // matchs joués elle pèse déjà autant que le socle.
      for (const K of [4, 8, 12, 20]) {
        const w = joues / (joues + K);
        const melange = (socle, obs) => (1 - w) * socle + w * obs;
        const attD = melange(a.att, A.a / Math.max(0.4, dPassee));
        const defD = melange(a.def, A.d / Math.max(0.4, ePassee));
        const attE = melange(b.att, B.a / Math.max(0.4, ePassee));
        const defE = melange(b.def, B.d / Math.max(0.4, dPassee));
        noter(`socle + saison en cours (K=${K})`, m, issueEtScore(
          borner(attD * defE * dPassee, 0.25, 4),
          borner(attE * defD * ePassee, 0.25, 4)
        ));
      }

      noter('repère : toujours le domicile', m, { score: [2, 1], issue: 1, probas: [1, 0, 0] });
      evalues++;
    }

    jD.push({ pour: m.bd, contre: m.be }); parEquipe.set(m.dom, jD);
    jE.push({ pour: m.be, contre: m.bd }); parEquipe.set(m.ext, jE);
  }
}

console.log(`\nCINQ PREMIÈRES JOURNÉES — ${evalues} matchs sur ${LIGUES.length} championnats\n`);
for (const [nom, s] of Object.entries(res)) {
  console.log(
    `${nom.padEnd(34)} issue ${((100 * s.ok) / s.n).toFixed(1).padStart(5)} % | score exact ${((100 * s.exact) / s.n).toFixed(1).padStart(5)} % | buts annoncés ${(s.buts / s.n).toFixed(2)}`
  );
}
