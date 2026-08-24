/**
 * REJEU DE LA RÈGLE DU SCORE SUR LES MATCHS RÉELS.
 *
 * Les buts attendus de chaque analyse sont conservés dans `analysis_data`.
 * On peut donc reconstruire la grille de Poisson exactement comme le moteur
 * l'a fait, et essayer d'autres règles de choix du score sans rien deviner.
 *
 * Le juge est le score exact tombé juste, contrôlé sur DEUX MOITIÉS : un
 * réglage qui ne gagne que sur l'une des deux est du hasard.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Le moteur, à l'identique ─────────────────────────────────────────────
const BUTS_MAX = 8;
const CORRECTION = -0.1;
function poisson(k, l) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; }
function petitsScores(i, j, l1, l2) {
  if (i === 0 && j === 0) return 1 - l1 * l2 * CORRECTION;
  if (i === 0 && j === 1) return 1 + l1 * CORRECTION;
  if (i === 1 && j === 0) return 1 + l2 * CORRECTION;
  if (i === 1 && j === 1) return 1 - CORRECTION;
  return 1;
}

function grille(l1, l2) {
  const p1 = Array.from({ length: BUTS_MAX + 1 }, (_, i) => poisson(i, l1));
  const p2 = Array.from({ length: BUTS_MAX + 1 }, (_, j) => poisson(j, l2));
  const parIssue = {
    victoire1: { b1: 1, b2: 0, p: -1 }, nul: { b1: 0, b2: 0, p: -1 }, victoire2: { b1: 0, b2: 1, p: -1 },
  };
  let global = { b1: 1, b2: 1, p: -1 };
  let v1 = 0, n = 0, v2 = 0;
  for (let i = 0; i <= BUTS_MAX; i++) {
    for (let j = 0; j <= BUTS_MAX; j++) {
      const p = p1[i] * p2[j] * petitsScores(i, j, l1, l2);
      const issue = i > j ? 'victoire1' : i === j ? 'nul' : 'victoire2';
      if (p > parIssue[issue].p) parIssue[issue] = { b1: i, b2: j, p };
      if (p > global.p) global = { b1: i, b2: j, p };
      if (issue === 'victoire1') v1 += p; else if (issue === 'nul') n += p; else v2 += p;
    }
  }
  const s = v1 + n + v2;
  return { parIssue, global, pv1: (v1 / s) * 100, pn: (n / s) * 100, pv2: (v2 / s) * 100 };
}

/** La règle actuelle, paramétrée par son seuil. */
function choisir(g, seuil) {
  const issueRetenue = g.pn >= g.pv1 && g.pn >= g.pv2 ? 'nul' : g.pv1 >= g.pv2 ? 'victoire1' : 'victoire2';
  const issueNaturelle = g.global.b1 > g.global.b2 ? 'victoire1' : g.global.b1 === g.global.b2 ? 'nul' : 'victoire2';
  const aff = { victoire1: g.pv1, nul: g.pn, victoire2: g.pv2 };
  const avance = aff[issueRetenue] - aff[issueNaturelle];
  const m = issueNaturelle === issueRetenue || avance < seuil ? g.global : g.parIssue[issueRetenue];
  return { b1: m.b1, b2: m.b2, issueRetenue };
}

// ── Les données ──────────────────────────────────────────────────────────
const tout = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history')
    .select('team1_name, team2_name, competition, real_score, real_winner, analysis_data, verified_at')
    .not('verified_at', 'is', null).not('real_score', 'is', null).not('analysis_data', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()]
  .map((a) => {
    const xg = a.analysis_data?.predictions?.expectedGoals;
    const reel = String(a.real_score ?? '').replace(/\s/g, '').match(/^(\d+)-(\d+)$/);
    if (!xg || !Number.isFinite(Number(xg.team1)) || !Number.isFinite(Number(xg.team2)) || !reel) return null;
    return { l1: Number(xg.team1), l2: Number(xg.team2), r1: Number(reel[1]), r2: Number(reel[2]), gagnant: a.real_winner };
  })
  .filter(Boolean);

console.log(`\n  ${M.length} matchs rejouables (buts attendus conservés et score réel connu).\n`);

const evaluer = (liste, seuil) => {
  let exact = 0, issueJuste = 0, incoherent = 0;
  const scores = new Map();
  for (const m of liste) {
    const g = grille(m.l1, m.l2);
    const c = choisir(g, seuil);
    if (c.b1 === m.r1 && c.b2 === m.r2) exact++;
    const issueDuScore = c.b1 > c.b2 ? 'team1' : c.b1 === c.b2 ? 'draw' : 'team2';
    const issueAnnoncee = c.issueRetenue === 'victoire1' ? 'team1' : c.issueRetenue === 'nul' ? 'draw' : 'team2';
    if (issueAnnoncee === m.gagnant) issueJuste++;
    if (issueDuScore !== issueAnnoncee) incoherent++;
    const cle = `${c.b1}-${c.b2}`;
    scores.set(cle, (scores.get(cle) ?? 0) + 1);
  }
  const top = [...scores].sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
  return {
    exact: Math.round((exact / liste.length) * 1000) / 10,
    issue: Math.round((issueJuste / liste.length) * 1000) / 10,
    incoherent: Math.round((incoherent / liste.length) * 100),
    varietes: scores.size,
    dominant: `${top[0]} ${Math.round((top[1] / liste.length) * 100)} %`,
  };
};

console.log('  ══ LA RÈGLE ACTUELLE ET SES VARIANTES ══\n');
console.log('  seuil │ score exact │ issue juste │ scores diff. │ le plus servi │ incohérents');
console.log('  ' + '─'.repeat(80));
for (const s of [0, 4, 8, 12, 20, 40, 999]) {
  const r = evaluer(M, s);
  const nom = s === 8 ? ' <- aujourd hui' : s === 999 ? ' (toujours le plus probable)' : s === 0 ? ' (toujours l issue)' : '';
  console.log(
    `  ${String(s).padStart(5)} │ ${String(r.exact).padStart(10)} % │ ${String(r.issue).padStart(10)} % │` +
    ` ${String(r.varietes).padStart(12)} │ ${r.dominant.padStart(13)} │ ${String(r.incoherent).padStart(10)} %${nom}`
  );
}

console.log('\n  ══ ÉPREUVE DES DEUX MOITIÉS ══\n');
const m = Math.floor(M.length / 2);
const A = M.slice(0, m), B = M.slice(m);
const base = { A: evaluer(A, 8).exact, B: evaluer(B, 8).exact };
console.log(`  Règle actuelle (seuil 8) : récente ${base.A} %  ·  ancienne ${base.B} %\n`);
for (const s of [0, 4, 12, 20, 40, 999]) {
  const a = evaluer(A, s).exact, b = evaluer(B, s).exact;
  const da = Math.round((a - base.A) * 10) / 10, db = Math.round((b - base.B) * 10) / 10;
  const verdict = da > 0 && db > 0 ? 'TIENT SUR LES DEUX' : da < 0 && db < 0 ? 'pire sur les deux' : 'ne tient pas';
  console.log(`  seuil ${String(s).padStart(3)} · récente ${da > 0 ? '+' : ''}${da} pt · ancienne ${db > 0 ? '+' : ''}${db} pt   → ${verdict}`);
}
console.log('');

// ── Le détail des deux règles, côte à côte ───────────────────────────────
const detail = (seuil) => {
  const c = new Map();
  for (const m of M) {
    const ch = choisir(grille(m.l1, m.l2), seuil);
    const k = `${ch.b1}-${ch.b2}`;
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return c;
};
const reels = new Map();
for (const m of M) { const k = `${m.r1}-${m.r2}`; reels.set(k, (reels.get(k) ?? 0) + 1); }

const a8 = detail(8), a0 = detail(0);
const cles = [...new Set([...a8.keys(), ...a0.keys(), ...reels.keys()])]
  .sort((x, y) => (reels.get(y) ?? 0) - (reels.get(x) ?? 0)).slice(0, 14);

console.log('  ══ CE QUI SERAIT ANNONCÉ, ET CE QUI ARRIVE VRAIMENT ══\n');
console.log('  score │ aujourd hui │ apres correctif │ survenu');
console.log('  ' + '─'.repeat(52));
for (const k of cles) {
  const p = (n) => String(Math.round(((n ?? 0) / M.length) * 100)).padStart(3) + ' %';
  console.log(`  ${k.padEnd(5)} │ ${p(a8.get(k)).padStart(11)} │ ${p(a0.get(k)).padStart(15)} │ ${p(reels.get(k)).padStart(7)}`);
}
console.log(`\n  Scores differents : ${a8.size} aujourd hui, ${a0.size} apres, ${reels.size} dans la realite\n`);
