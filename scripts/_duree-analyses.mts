import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('analysis_failures').select('duree_ms, created_at, servi_quand_meme, modele')
  .gte('created_at', '2026-08-26T00:00:00Z').order('duree_ms', { ascending: false }).limit(500);
const L = ((data ?? []) as any[]).filter((x) => Number(x.duree_ms) > 0);
console.log(`${L.length} échec(s) chronométré(s) depuis le passage au plan Pro (25 août).\n`);
console.log('── LES 15 PLUS LONGS');
for (const x of L.slice(0, 15))
  console.log(`   ${(Number(x.duree_ms) / 1000).toFixed(1)} s   ${String(x.created_at).slice(0, 16).replace('T', ' ')}  ${x.modele}`);
const d = L.map((x) => Number(x.duree_ms)).sort((a, b) => a - b);
const q = (p: number) => (d[Math.floor(d.length * p)] / 1000).toFixed(1);
console.log(`\n── RÉPARTITION : médiane ${q(0.5)} s   90e ${q(0.9)} s   max ${(d[d.length - 1] / 1000).toFixed(1)} s`);
console.log(`   au-delà de 55 s : ${d.filter((x) => x > 55000).length}`);
console.log(`   au-delà de 60 s : ${d.filter((x) => x > 60000).length}`);
console.log(`   au-delà de 90 s : ${d.filter((x) => x > 90000).length}`);
