// LECTURE SEULE : combien de messages de chaque campagne sont partis.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data: un } = await sb.from('webhook_events').select('*').eq('provider', 'campagne').limit(1);
console.log('colonnes :', Object.keys(un?.[0] ?? {}).join(', '));
const out: any[] = [];
for (let de = 0; de < 200_000; de += 1000) {
  const { data, error } = await sb.from('webhook_events').select('event').eq('provider', 'campagne').range(de, de + 999);
  if (error) throw new Error(error.message);
  out.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const t = new Map<string, number>();
for (const e of out) t.set(String(e.event), (t.get(String(e.event)) ?? 0) + 1);
for (const [k, n] of [...t].sort()) if (/matin|soir|reveil/.test(k)) console.log(k.padEnd(34), n);
