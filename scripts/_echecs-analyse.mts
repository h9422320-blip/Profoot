import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data, error } = await sb.from('analysis_failures').select('*')
  .gte('created_at', '2026-09-10T00:00:00Z').order('created_at', { ascending: false }).limit(400);
if (error) throw new Error(error.message);
const L = (data ?? []) as any[];
console.log(`${L.length} échec(s) d'analyse depuis le 10 septembre.`);
if (L[0]) console.log('\ncolonnes :', Object.keys(L[0]).join(', '));

const parCause = new Map<string, number>();
const parJour = new Map<string, number>();
for (const x of L) {
  parCause.set(String(x.cause ?? '?'), (parCause.get(String(x.cause ?? '?')) ?? 0) + 1);
  const j = String(x.created_at).slice(0, 10);
  parJour.set(j, (parJour.get(j) ?? 0) + 1);
}
console.log('\n── PAR JOUR');
for (const [j, n] of [...parJour].sort()) console.log(`   ${j}  ${n}`);
console.log('\n── PAR CAUSE');
for (const [c, n] of [...parCause].sort((a, b) => b[1] - a[1])) console.log(`   ${String(c).padEnd(34)} ${n}`);
console.log('\n── LES 25 PLUS RÉCENTS');
for (const x of L.slice(0, 25))
  console.log(`   ${String(x.created_at).slice(0, 16).replace('T', ' ')}  ${String(x.cause ?? '?').padEnd(28)} ` +
    `servi ${x.servi_quand_meme}  ${String(x.detail ?? x.message ?? '').slice(0, 110)}`);
