import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('preuves').select('*');
const pin = (data ?? []).filter((p) => p.mise_en_avant);
console.log(`\n  ${data.length} preuve(s) — ${pin.length} mise(s) en avant à la main :`);
for (const p of pin) console.log(`     ${String(p.date_match).slice(0,10)}  ${p.equipe1 ?? p.team1_name} — ${p.equipe2 ?? p.team2_name}`);
const parJour = new Map();
for (const p of data ?? []) {
  const j = String(p.date_match).slice(0, 10);
  parJour.set(j, (parJour.get(j) ?? 0) + 1);
}
console.log(`\n  Répartition par jour (10 plus récents) :`);
for (const [j, n] of [...parJour].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10))
  console.log(`     ${j}  ${n} preuve(s)`);
console.log('');
