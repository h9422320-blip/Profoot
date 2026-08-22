import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('preuves').select('*').order('date_match', { ascending: false }).limit(20);
console.log(`\n  Les 20 preuves les plus récentes en base :\n`);
for (const p of data ?? [])
  console.log(`  ${String(p.date_match).slice(0,10)}  ${String(p.equipe1 ?? p.team1_name).slice(0,22).padEnd(23)} ${String(p.equipe2 ?? p.team2_name).slice(0,22).padEnd(23)} exact=${p.score_exact ? 'O' : 'n'} avant=${p.mise_en_avant ? 'OUI' : 'non'}`);
console.log('');
