import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb
  .from('precision_quotidienne')
  .select('*')
  .order('jour', { ascending: false })
  .limit(8);
console.log('── PRECISION_QUOTIDIENNE, les 8 derniers jours (écrite par les crons)');
for (const r of (data ?? []) as any[]) console.log('  ', JSON.stringify(r));
