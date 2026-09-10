import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('subscriptions').select('*').limit(3);
console.log('colonnes subscriptions : ' + Object.keys(data?.[0] ?? {}).join(', '));
for (const d of data ?? []) console.log(JSON.stringify(d));
const { data: o } = await sb.from('offres').select('*');
console.log('\noffres : ' + JSON.stringify(o));
