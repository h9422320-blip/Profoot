import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { data } = await createAdminClient()
  .from('audits').select('created_at, duree_ms, points, anomalies')
  .order('created_at', { ascending: false }).limit(8);
for (const a of data ?? []) {
  console.log(`\n### ${String(a.created_at).slice(0, 19)}  ${a.duree_ms} ms  ${a.anomalies} echec(s)`);
  for (const p of a.points ?? []) console.log('   ' + p);
}
