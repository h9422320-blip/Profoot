import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = new Date(Date.now() - 3 * 3600e3).toISOString();
const { data: f } = await sb.from('analysis_failures').select('*').gte('created_at', depuis).order('created_at', { ascending: false }).limit(5);
console.log('incidents 3 h :', (f ?? []).length);
for (const x of f ?? []) console.log(' ', JSON.stringify(x).slice(0, 400));
