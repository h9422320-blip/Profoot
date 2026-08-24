/**
 * La correction Dixon-Coles doit-elle servir à CHOISIR le score affiché ?
 *
 * Elle a été validée pour une seule chose : la probabilité de nul, juste sur
 * 9 200 rencontres. Elle abaisse le 1-0 et relève le 1-1. Or dans la réalité
 * le 1-0 arrive deux fois plus souvent que le 2-1. On essaie donc de la
 * garder pour les probabilités et de l'écarter du choix du score.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUTS_MAX = 8, CORRECTION = -0.1;
const poisson = (k, l) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; };
const petits = (i, j, l1, l2) => {
  if (i === 0 && j === 0) return 1 - l1 * l2 * CORRECTION;
  if (i === 0 && j === 1) return 1 + l1 * CORRECTION;
  if (i === 1 && j === 0) return 1 + l2 * CORRECTION;
  if (i === 1 && j === 1) return 1 - CORRECTION;
  return 1;
};

/** `dcPourLeScore` : la correction entre-t-elle dans le choix du score ? */
function analyser(l1, l2, seuil, dcPourLeScore) {
  const p1 = Array.from({ length: BUTS_MAX + 1 }, (_, i) => poisson(i, l1));
  const p2 = Array.from({ length: BUTS_MAX + 1 }, (_, j) => poisson(j, l2));
  const parIssue = { victoire1: { b1: 1, b2: 0, p: -1 }, nul: { b1: 0, b2: 0, p: -1 }, victoire2: { b1: 0, b2: 1, p: -1 } };
  let global = { b1: 1, b2: 1, p: -1 };
  let v1 = 0, n = 0, v2 = 0;
  for (let i = 0; i <= BUTS_MAX; i++) {
    for (let j = 0; j <= BUTS_MAX; j++) {
      const brut = p1[i] * p2[j];
      const corrige = brut * petits(i, j, l1, l2);
      // Les probabilités gardent TOUJOURS la correction : elle y est validée.
      const issue = i > j ? 'victoire1' : i === j ? 'nul' : 'victoire2';
      if (issue === 'victoire1') v1 += corrige; else if (issue === 'nul') n += corrige; else v2 += corrige;
      // Le choix du score, lui, se fait avec ou sans.
      const pourLeScore = dcPourLeScore ? corrige : brut;
      if (pourLeScore > parIssue[issue].p) parIssue[issue] = { b1: i, b2: j, p: pourLeScore };
      if (pourLeScore > global.p) global = { b1: i, b2: j, p: pourLeScore };
    }
  }
  const s = v1 + n + v2;
  const pv1 = (v1 / s) * 100, pn = (n / s) * 100, pv2 = (v2 / s) * 100;
  const issueRetenue = pn >= pv1 && pn >= pv2 ? 'nul' : pv1 >= pv2 ? 'victoire1' : 'victoire2';
  const issueNaturelle = global.b1 > global.b2 ? 'victoire1' : global.b1 === global.b2 ? 'nul' : 'victoire2';
  const aff = { victoire1: pv1, nul: pn, victoire2: pv2 };
  const m = issueNaturelle === issueRetenue || aff[issueRetenue] - aff[issueNaturelle] < seuil ? global : parIssue[issueRetenue];
  return { b1: m.b1, b2: m.b2, issueRetenue };
}

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
const M = [...parMatch.values()].map((a) => {
  const xg = a.analysis_data?.predictions?.expectedGoals;
  const r = String(a.real_score ?? '').replace(/\s/g, '').match(/^(\d+)-(\d+)$/);
  if (!xg || !Number.isFinite(Number(xg.team1)) || !Number.isFinite(Number(xg.team2)) || !r) return null;
  return { l1: Number(xg.team1), l2: Number(xg.team2), r1: Number(r[1]), r2: Number(r[2]) };
}).filter(Boolean);

const evaluer = (liste, seuil, dc) => {
  let exact = 0, incoh = 0;
  const c = new Map();
  for (const m of liste) {
    const ch = analyser(m.l1, m.l2, seuil, dc);
    if (ch.b1 === m.r1 && ch.b2 === m.r2) exact++;
    const isc = ch.b1 > ch.b2 ? 'victoire1' : ch.b1 === ch.b2 ? 'nul' : 'victoire2';
    if (isc !== ch.issueRetenue) incoh++;
    const k = `${ch.b1}-${ch.b2}`; c.set(k, (c.get(k) ?? 0) + 1);
  }
  const top = [...c].sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
  return {
    exact: Math.round((exact / liste.length) * 1000) / 10,
    incoh: Math.round((incoh / liste.length) * 100),
    nb: c.size,
    top: `${top[0]} ${Math.round((top[1] / liste.length) * 100)} %`,
  };
};

console.log(`\n  ${M.length} matchs rejoués.\n`);
console.log('  ══ LA CORRECTION DIXON-COLES DOIT-ELLE CHOISIR LE SCORE ? ══\n');
console.log('  seuil │ Dixon-Coles │ score exact │ scores diff. │ le plus servi │ incohérents');
console.log('  ' + '─'.repeat(82));
for (const dc of [true, false]) {
  for (const s of [8, 4, 0]) {
    const r = evaluer(M, s, dc);
    const nom = dc && s === 8 ? '  <- aujourd hui' : '';
    console.log(
      `  ${String(s).padStart(5)} │ ${(dc ? 'oui' : 'non').padStart(11)} │ ${String(r.exact).padStart(10)} % │` +
      ` ${String(r.nb).padStart(12)} │ ${r.top.padStart(13)} │ ${String(r.incoh).padStart(10)} %${nom}`
    );
  }
}

console.log('\n  ══ ÉPREUVE DES DEUX MOITIÉS (référence : seuil 8 avec correction) ══\n');
const mi = Math.floor(M.length / 2), A = M.slice(0, mi), B = M.slice(mi);
const bA = evaluer(A, 8, true).exact, bB = evaluer(B, 8, true).exact;
console.log(`  Référence : récente ${bA} %  ·  ancienne ${bB} %\n`);
for (const dc of [true, false]) {
  for (const s of [4, 0]) {
    if (dc && s === 8) continue;
    const a = evaluer(A, s, dc).exact, b = evaluer(B, s, dc).exact;
    const da = Math.round((a - bA) * 10) / 10, db = Math.round((b - bB) * 10) / 10;
    const v = da > 0 && db > 0 ? 'TIENT SUR LES DEUX' : da < 0 && db < 0 ? 'pire sur les deux' : 'ne tient pas';
    console.log(`  seuil ${String(s).padStart(2)} · Dixon-Coles ${(dc ? 'oui' : 'non').padEnd(4)} · récente ${da > 0 ? '+' : ''}${String(da).padStart(4)} pt · ancienne ${db > 0 ? '+' : ''}${String(db).padStart(4)} pt  → ${v}`);
  }
}
console.log('');
