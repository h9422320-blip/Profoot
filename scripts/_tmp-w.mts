import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data: un } = await sb.from('preuves').select('*').order('date_match', { ascending: false }).limit(1);
console.log(Object.keys(un?.[0] ?? {}).join(', '));
const { data } = await sb.from('preuves').select('*').gte('date_match', '2026-09-18').lt('date_match', '2026-09-19').limit(60);
for (const p of data ?? []) console.log(JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !/logo/.test(k)))).slice(0, 400));
