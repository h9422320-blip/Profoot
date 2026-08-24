/**
 * À quel point le moteur répète-t-il le même score ?
 * On compare ce qu'il annonce à ce qui arrive vraiment.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Les 100 dernières analyses, comme demandé ────────────────────────────
const { data: cent } = await sb.from('analysis_history')
  .select('team1_name, team2_name, score, competition, created_at')
  .not('score', 'is', null)
  .order('created_at', { ascending: false }).limit(100);

const compte = new Map();
for (const a of cent ?? []) {
  const s = String(a.score).trim();
  compte.set(s, (compte.get(s) ?? 0) + 1);
}
console.log(`\n  ══ LES ${cent?.length ?? 0} DERNIÈRES ANALYSES ══\n`);
console.log(`  part    nombre   score annoncé`);
for (const [s, n] of [...compte].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  const barre = '█'.repeat(Math.round(n / (cent?.length || 1) * 50));
  console.log(`  ${String(Math.round(n / (cent?.length || 1) * 100)).padStart(3)} %   ${String(n).padStart(4)}     ${s.padEnd(6)} ${barre}`);
}
console.log(`\n  Scores différents utilisés : ${compte.size}`);
const deuxUn = compte.get('2-1') ?? 0;
console.log(`  Part du « 2-1 » : ${Math.round(deuxUn / (cent?.length || 1) * 100)} %`);

// ── Sur tout l'historique vérifié : annoncé contre survenu ───────────────
const tout = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history')
    .select('team1_name, team2_name, competition, score, real_score, win_prob, draw_prob, lose_prob')
    .not('verified_at', 'is', null).not('real_score', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()];

const tally = (liste, champ) => {
  const c = new Map();
  for (const a of liste) {
    const s = String(a[champ] ?? '').trim().replace(/\s/g, '');
    if (!/^\d+-\d+$/.test(s)) continue;
    c.set(s, (c.get(s) ?? 0) + 1);
  }
  return c;
};
const annonces = tally(M, 'score');
const reels = tally(M, 'real_score');
const totA = [...annonces.values()].reduce((s, n) => s + n, 0);
const totR = [...reels.values()].reduce((s, n) => s + n, 0);

console.log(`\n  ══ SUR ${M.length} MATCHS VÉRIFIÉS — ANNONCÉ vs SURVENU ══\n`);
console.log(`  score    annoncé      survenu`);
const tousScores = [...new Set([...annonces.keys(), ...reels.keys()])]
  .sort((a, b) => (annonces.get(b) ?? 0) - (annonces.get(a) ?? 0)).slice(0, 14);
for (const s of tousScores) {
  const a = annonces.get(s) ?? 0, r = reels.get(s) ?? 0;
  const pa = Math.round(a / totA * 100), pr = Math.round(r / totR * 100);
  console.log(`  ${s.padEnd(7)}  ${String(pa).padStart(3)} % ${'█'.repeat(pa).padEnd(42)} ${String(pr).padStart(3)} % ${'▒'.repeat(pr)}`);
}
console.log(`\n  Scores différents annoncés : ${annonces.size}   ·   réellement survenus : ${reels.size}`);
console.log('');
