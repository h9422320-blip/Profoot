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
    .select('team1_name, team2_name, team1_league, team2_league, competition, win_prob, draw_prob, lose_prob, real_winner, confidence, created_at')
    .not('verified_at', 'is', null).not('real_winner', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()].filter((a) => a.team1_league && a.team2_league && a.draw_prob != null);
const croise = M.filter((a) => String(a.team1_league) !== String(a.team2_league));

const norm = (a) => { const t = +a.win_prob, n = +a.draw_prob, e = +a.lose_prob, s = t + n + e || 1; return { v1: t / s, nul: n / s, v2: e / s }; };
/** Aplatir : on tire les trois probabilités vers un tiers chacune. */
const aplatir = (p, f) => ({ v1: (1 - f) * p.v1 + f / 3, nul: (1 - f) * p.nul + f / 3, v2: (1 - f) * p.v2 + f / 3 });
const issue = (p) => (p.nul >= p.v1 && p.nul >= p.v2 ? 'draw' : p.v1 >= p.v2 ? 'team1' : 'team2');
const ev = (l, f) => {
  let j = 0, n = 0;
  for (const a of l) { const p = aplatir(norm(a), f); const i = issue(p); if (i === 'draw') n++; if (i === a.real_winner) j++; }
  return { r: Math.round(j / l.length * 1000) / 10, n: Math.round(n / l.length * 100) };
};

console.log(`\n  ══ APLATISSEMENT — ${croise.length} matchs croisés ══\n`);
console.log(`  aplatissement   nuls annoncés   réussite`);
for (const f of [0, 0.3, 0.5, 0.65, 0.8, 0.9, 0.95]) {
  const r = ev(croise, f);
  console.log(`  ${String(Math.round(f * 100)).padStart(11)} %   ${String(r.n).padStart(12)} %  ${String(r.r).padStart(8)} %${f === 0 ? '   <- aujourd hui' : ''}`);
}

console.log(`\n  ══ ÉPREUVE DE SOLIDITÉ — deux moitiés séparées ══\n`);
const m = Math.floor(croise.length / 2);
for (const f of [0.65, 0.8, 0.9]) {
  const A = ev(croise.slice(0, m), f), B = ev(croise.slice(m), f);
  const A0 = ev(croise.slice(0, m), 0), B0 = ev(croise.slice(m), 0);
  const dA = Math.round((A.r - A0.r) * 10) / 10, dB = Math.round((B.r - B0.r) * 10) / 10;
  const verdict = dA > 0 && dB > 0 ? 'TIENT SUR LES DEUX' : 'ne tient pas';
  console.log(`  aplatissement ${String(Math.round(f * 100)).padStart(2)} % · récente ${dA > 0 ? '+' : ''}${dA} pt · ancienne ${dB > 0 ? '+' : ''}${dB} pt   → ${verdict}`);
}
console.log('');
