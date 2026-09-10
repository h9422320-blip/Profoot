import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('webhook_events').select('*').order('received_at', { ascending: false }).limit(400);
const m = (data ?? []).filter((e: any) => String(e.provider) === 'maketou' || /maketou/i.test(JSON.stringify(e.payload ?? {})));
console.log(`${m.length} messages maketou parmi les 400 derniers evenements`);
for (const e of m.slice(0, 3)) console.log('\n' + String(e.received_at).slice(0,19) + ' ' + e.event + '\n' + JSON.stringify(e.payload, null, 2).slice(0, 2000));
