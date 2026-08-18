/**
 * Diagnostic du moteur : un match compte pour un, et on regarde les buts
 * attendus tels qu'ils ont été calculés à l'époque. Lecture seule.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data } = await sb.from('analysis_history')
  .select('id, created_at, fixture_id, team1_name, team2_name, competition, score, real_score, winner_correct, confidence, analysis_data')
  .not('verified_at', 'is', null);

const lireScore = (s) => { const m = String(s ?? '').match(/(\d+)\s*[-–]\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };

// UN MATCH COMPTE POUR UN : la même rencontre analysée douze fois pesait douze
// fois dans la moyenne, ce qui déforme complètement la mesure.
const parMatch = new Map();
for (const a of data) {
  const cle = a.fixture_id ? `f${a.fixture_id}` : [a.team1_name, a.team2_name].map((n) => String(n).toLowerCase()).sort().join('|');
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const matchs = [...parMatch.values()].map((a) => {
  const p = lireScore(a.score), r = lireScore(a.real_score);
  if (!p || !r) return null;
  const d = a.analysis_data ?? {};
  return {
    ...a, p1: p[0], p2: p[1], r1: r[0], r2: r[1],
    xg1: Number(d.butsAttendus1 ?? d.expectedGoals1 ?? d.xg1 ?? NaN),
    xg2: Number(d.butsAttendus2 ?? d.expectedGoals2 ?? d.xg2 ?? NaN),
    predTotal: p[0] + p[1], reelTotal: r[0] + r[1],
    issueOk: !!a.winner_correct,
    scoreOk: p[0] === r[0] && p[1] === r[1],
  };
}).filter(Boolean);

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) + ' %' : '—');
const moy = (xs) => { const v = xs.filter((x) => Number.isFinite(x)); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '—'; };

console.log(`=========== UN MATCH = UNE LIGNE : ${matchs.length} matchs ===========`);
console.log(`Issue correcte              : ${pct(matchs.filter((m) => m.issueOk).length, matchs.length)}`);
console.log(`Score exact                 : ${pct(matchs.filter((m) => m.scoreOk).length, matchs.length)}`);
console.log(`Total de buts prédit / réel : ${moy(matchs.map((m) => m.predTotal))} / ${moy(matchs.map((m) => m.reelTotal))}`);
console.log(`Buts attendus disponibles   : ${matchs.filter((m) => Number.isFinite(m.xg1)).length} / ${matchs.length}`);
const avecXg = matchs.filter((m) => Number.isFinite(m.xg1) && Number.isFinite(m.xg2));
if (avecXg.length) {
  console.log(`Somme des buts attendus     : ${moy(avecXg.map((m) => m.xg1 + m.xg2))}  (réel ${moy(avecXg.map((m) => m.reelTotal))})`);
  console.log(`Écart attendus → score dit  : ${moy(avecXg.map((m) => m.predTotal - (m.xg1 + m.xg2)))}`);
}

console.log('\n=========== SOUS-ESTIMATION DES BUTS ===========');
const sous = matchs.filter((m) => m.predTotal < m.reelTotal).length;
const sur = matchs.filter((m) => m.predTotal > m.reelTotal).length;
console.log(`  Le moteur annonce MOINS de buts que la réalité : ${sous} fois (${pct(sous, matchs.length)})`);
console.log(`  Il en annonce PLUS                             : ${sur} fois (${pct(sur, matchs.length)})`);
console.log(`  Il tombe juste sur le total                    : ${matchs.length - sous - sur} fois`);

console.log('\n=========== CE QUE DIT LA CONFIANCE ===========');
for (const [min, max] of [[0, 60], [60, 70], [70, 80], [80, 101]]) {
  const s = matchs.filter((m) => (m.confidence ?? 0) >= min && (m.confidence ?? 0) < max);
  if (s.length) console.log(`  ${String(min).padStart(2)}-${max === 101 ? 100 : max - 1} % : ${String(s.length).padStart(3)} matchs — issue juste ${pct(s.filter((m) => m.issueOk).length, s.length)}`);
}

console.log('\n=========== PAR DATE (le championnat vient de reprendre) ===========');
const parJour = {};
for (const m of matchs) (parJour[String(m.created_at).slice(0, 10)] ??= []).push(m);
Object.entries(parJour).sort().forEach(([j, v]) =>
  console.log(`  ${j} : ${String(v.length).padStart(3)} matchs — issue ${pct(v.filter((m) => m.issueOk).length, v.length)} — total prédit ${moy(v.map((m) => m.predTotal))} vs réel ${moy(v.map((m) => m.reelTotal))}`)
);

console.log('\n=========== EXEMPLE DE analysis_data ===========');
const ex = matchs.find((m) => m.analysis_data);
console.log(Object.keys(ex?.analysis_data ?? {}).join(', '));
