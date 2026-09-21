import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data: un } = await sb.from('audits').select('*').order('created_at', { ascending: false }).limit(1);
console.log(Object.keys(un?.[0] ?? {}).join(', '));
const { data } = await sb.from('audits').select('*').order('created_at', { ascending: false }).limit(40);
for (const a of data ?? []) { const s = JSON.stringify(a); if (/entretien|cotes|Préparer/i.test(s)) console.log(s.slice(0, 1500)); }
