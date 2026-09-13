import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const JOURS = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];
console.log('   jour          analyses   analystes distincts');
for (const j of JOURS) {
  const lignes: any[] = [];
  for (let de = 0; de < 6000; de += 1000) {
    const { data } = await sb.from('analysis_history').select('user_id')
      .gte('created_at', `${j}T00:00:00Z`).lt('created_at', `${j}T23:59:59.999Z`).range(de, de + 999);
    if (!data?.length) break;
    lignes.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`   ${j}   ${String(lignes.length).padStart(8)}   ${String(new Set(lignes.map((l) => l.user_id)).size).padStart(10)}`);
}
