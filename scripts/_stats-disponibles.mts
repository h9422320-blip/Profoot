import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('cache_api').select('cle, contenu').like('cle', '%statistics%').limit(2);
for (const l of (data ?? []) as any[]) {
  const eq = l.contenu?.response?.[0];
  console.log(`clé : ${l.cle}`);
  console.log(`équipe : ${eq?.team?.name}`);
  for (const s of eq?.statistics ?? []) console.log(`   ${String(s.type).padEnd(28)} ${JSON.stringify(s.value)}`);
  break;
}
const { count } = await sb.from('cache_api').select('cle', { count: 'exact', head: true }).like('cle', '%statistics%');
console.log(`\nfiches de statistiques en réserve : ${count}`);
