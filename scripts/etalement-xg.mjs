/**
 * Les buts attendus du moteur ont-ils la même dispersion que les buts
 * réellement marqués ? Un modèle trop prudent écrase tous les matchs sur la
 * même moyenne — et tous les scores sur le même couple d'entiers.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const tout = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history')
    .select('team1_name, team2_name, competition, real_score, analysis_data, verified_at')
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

const stat = (v) => {
  const n = v.length, moy = v.reduce((s, x) => s + x, 0) / n;
  const ec = Math.sqrt(v.reduce((s, x) => s + (x - moy) ** 2, 0) / n);
  const tri = [...v].sort((a, b) => a - b);
  return { moy, ec, min: tri[0], max: tri[n - 1], q1: tri[Math.floor(n * 0.25)], q3: tri[Math.floor(n * 0.75)] };
};

const xgTous = [...M.map((m) => m.l1), ...M.map((m) => m.l2)];
const butsTous = [...M.map((m) => m.r1), ...M.map((m) => m.r2)];
const f = (x) => (Math.round(x * 100) / 100).toString().padStart(5);

console.log(`\n  ${M.length} matchs.\n`);
console.log('  ══ BUTS ATTENDUS PAR ÉQUIPE, CONTRE BUTS MARQUÉS ══\n');
const a = stat(xgTous), b = stat(butsTous);
console.log('               moyenne  ecart-type   mini   quart bas  quart haut   maxi');
console.log(`  attendus    ${f(a.moy)}    ${f(a.ec)}   ${f(a.min)}     ${f(a.q1)}      ${f(a.q3)}    ${f(a.max)}`);
console.log(`  marques     ${f(b.moy)}    ${f(b.ec)}   ${f(b.min)}     ${f(b.q1)}      ${f(b.q3)}    ${f(b.max)}`);

// L'écart ATTENDU entre les deux équipes, contre l'écart RÉEL.
const ecartAttendu = M.map((m) => m.l1 - m.l2);
const ecartReel = M.map((m) => m.r1 - m.r2);
const ea = stat(ecartAttendu), er = stat(ecartReel);
console.log('\n  ══ ÉCART ENTRE LES DEUX ÉQUIPES ══\n');
console.log('               moyenne  ecart-type   mini              maxi');
console.log(`  attendu     ${f(ea.moy)}    ${f(ea.ec)}   ${f(ea.min)}            ${f(ea.max)}`);
console.log(`  reel        ${f(er.moy)}    ${f(er.ec)}   ${f(er.min)}            ${f(er.max)}`);

// Le total de buts attendu contre le total réel.
const totA = M.map((m) => m.l1 + m.l2), totR = M.map((m) => m.r1 + m.r2);
const ta = stat(totA), tr = stat(totR);
console.log('\n  ══ TOTAL DE BUTS DU MATCH ══\n');
console.log(`  attendu     ${f(ta.moy)}    ${f(ta.ec)}   ${f(ta.min)}            ${f(ta.max)}`);
console.log(`  reel        ${f(tr.moy)}    ${f(tr.ec)}   ${f(tr.min)}            ${f(tr.max)}`);

// Poisson impose sa propre dispersion : pour lambda donne, l'ecart-type des
// buts vaut racine de lambda. On compare ce que la grille PEUT produire.
const disperseTheorique = Math.sqrt(a.moy + a.ec ** 2);
console.log(`\n  Dispersion des buts que la grille peut produire : ${f(disperseTheorique)}`);
console.log(`  Dispersion reellement observee ................ : ${f(b.ec)}`);
console.log('');
