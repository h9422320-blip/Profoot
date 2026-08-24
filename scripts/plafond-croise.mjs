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
    .select('team1_name, team2_name, team1_league, team2_league, competition, win_prob, draw_prob, lose_prob, real_winner, confidence')
    .not('verified_at', 'is', null).not('real_winner', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()].filter((a) => a.team1_league && a.team2_league && a.confidence);
const croise = M.filter((a) => String(a.team1_league) !== String(a.team2_league));

console.log(`\n  ══ CONFIANCE AFFICHÉE SUR LES ${croise.length} MATCHS CROISÉS ══\n`);
const paliers = [[70, 74], [75, 79], [80, 84], [85, 89], [90, 95]];
for (const [a, b] of paliers) {
  const l = croise.filter((x) => +x.confidence >= a && +x.confidence <= b);
  if (!l.length) continue;
  const justes = l.filter((x) => {
    const t = +x.win_prob, n = +x.draw_prob, e = +x.lose_prob;
    const i = n >= t && n >= e ? 'draw' : t >= e ? 'team1' : 'team2';
    return i === x.real_winner;
  }).length;
  const barre = '█'.repeat(Math.round(l.length / croise.length * 40));
  console.log(`  ${a}-${b} % : ${String(l.length).padStart(3)} matchs  ${barre.padEnd(40)} tenu ${Math.round(justes / l.length * 100)} %`);
}
const moy = croise.reduce((s, a) => s + +a.confidence, 0) / croise.length;
console.log(`\n  Moyenne actuelle : ${Math.round(moy)} %`);
for (const p of [70, 72, 75, 78, 80]) {
  const m = croise.reduce((s, a) => s + Math.min(+a.confidence, p), 0) / croise.length;
  const touches = croise.filter((a) => +a.confidence > p).length;
  console.log(`  Plafond à ${p} %  →  moyenne ${Math.round(m)} % · ${touches} matchs sur ${croise.length} rabaissés`);
}
console.log('');
