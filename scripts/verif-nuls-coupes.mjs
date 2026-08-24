import fs from 'fs';
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
    .select('team1_name, team2_name, competition, win_prob, draw_prob, lose_prob, real_winner, real_score, verified_at')
    .not('verified_at', 'is', null).not('real_winner', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
console.log(`\n  Lignes vérifiées lues : ${tout.length}\n`);

const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()];
console.log(`  Matchs distincts      : ${M.length}\n`);

// ── Quelles compétitions, et combien de nuls dans chacune ? ────────────
const parCompet = new Map();
for (const a of M) {
  const c = String(a.competition || '(sans nom)');
  if (!parCompet.has(c)) parCompet.set(c, { n: 0, nuls: 0 });
  const e = parCompet.get(c); e.n++; if (a.real_winner === 'draw') e.nuls++;
}
console.log('  ══ COMPÉTITIONS EUROPÉENNES PRÉSENTES ══\n');
console.log('  matchs   nuls   part      compétition');
for (const [c, e] of [...parCompet].sort((x, y) => y[1].n - x[1].n)) {
  if (!/UEFA|Champions|Europa|Conference/i.test(c)) continue;
  console.log(`  ${String(e.n).padStart(6)}   ${String(e.nuls).padStart(4)}   ${String(Math.round(e.nuls / e.n * 100)).padStart(3)} %     ${c}`);
}

// ── La moyenne annoncée par le moteur en coupe ─────────────────────────
const coupes = M.filter((a) => /UEFA|Champions|Europa|Conference/i.test(String(a.competition)) && a.draw_prob != null);
const moyNul = coupes.reduce((s, a) => {
  const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
  return s + n / (t + n + e || 1);
}, 0) / Math.max(1, coupes.length);
const reelNul = coupes.filter((a) => a.real_winner === 'draw').length / Math.max(1, coupes.length);
console.log(`\n  ══ CALIBRAGE DU NUL EN COUPE ══\n`);
console.log(`  Le moteur annonce en moyenne : ${Math.round(moyNul * 100)} % de chances de nul`);
console.log(`  Il en survient réellement    : ${Math.round(reelNul * 100)} %`);
console.log(`  Facteur de rattrapage        : x${(reelNul / moyNul).toFixed(2)}`);

// ── Le même calibrage en championnat, pour comparer ────────────────────
const champ = M.filter((a) => !/UEFA|Champions|Europa|Conference/i.test(String(a.competition)) && a.draw_prob != null);
const moyNulC = champ.reduce((s, a) => {
  const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
  return s + n / (t + n + e || 1);
}, 0) / Math.max(1, champ.length);
const reelNulC = champ.filter((a) => a.real_winner === 'draw').length / Math.max(1, champ.length);
console.log(`\n  En championnat : annoncé ${Math.round(moyNulC * 100)} % · réel ${Math.round(reelNulC * 100)} % · facteur x${(reelNulC / moyNulC).toFixed(2)}`);
console.log('');
