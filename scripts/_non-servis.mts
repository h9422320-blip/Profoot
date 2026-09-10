/** Les acheteurs sans compte : ce qui a ete tente pour eux, et quand. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const cibles = [
  'mohamedabdoulrayanecherky@gmail.com',
  'babaoulare@4gmail.com',
  'abdoulayemeite44@gmail.com',
  'djevessojules634@gmail.com',
];

const evenements: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('webhook_events').select('*').range(de, de + 999);
  evenements.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

for (const c of cibles) {
  console.log(`\n=== ${c} ===`);
  const siens = evenements.filter((e) => JSON.stringify(e).toLowerCase().includes(c.toLowerCase()));
  for (const e of siens.sort((a, b) => String(a.received_at).localeCompare(String(b.received_at))))
    console.log(`  ${String(e.received_at).slice(0, 19)}  ${e.provider.padEnd(12)} ${e.event}`);
  if (!siens.length) console.log('  aucune trace');
}
