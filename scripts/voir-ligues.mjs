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
  const { data } = await sb.from('analysis_history').select('team1_league, team2_league').range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const c = new Map();
for (const a of tout) for (const l of [a.team1_league, a.team2_league]) {
  const v = String(l ?? '(vide)');
  c.set(v, (c.get(v) ?? 0) + 1);
}
console.log(`\n  ══ VALEURS DE team1_league / team2_league — ${tout.length} lignes ══\n`);
for (const [v, n] of [...c].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${String(n).padStart(6)}  ${v}`);
console.log(`\n  ${c.size} valeurs différentes.\n`);
