import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
for (const motif of ['%fixtures/statistics%', '%statistics?fixture%', 'occasions:%', 'tirs:%', 'forces:occasions%']) {
  const { count } = await sb.from('cache_api').select('cle', { count: 'exact', head: true }).ilike('cle', motif);
  const { data } = await sb.from('cache_api').select('cle, ecrit_le').ilike('cle', motif).limit(3);
  console.log(`${motif.padEnd(26)} ${String(count ?? 0).padStart(6)} cle(s)   ${(data ?? []).map((d: any) => d.cle.slice(0, 60)).join(' | ')}`);
}
console.log('tirs.json local :', fs.existsSync('tirs.json') ? `${(fs.statSync('tirs.json').size / 1e6).toFixed(1)} Mo` : 'absent', '|', fs.existsSync('scripts/tirs.json') ? 'scripts/tirs.json present' : '');
