import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tout = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('pays, consumed_at').range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const m = new Map(), payes = new Map();
for (const p of tout) {
  const k = p.pays ?? '??';
  m.set(k, (m.get(k) ?? 0) + 1);
  if (p.consumed_at) payes.set(k, (payes.get(k) ?? 0) + 1);
}
console.log(`\n  ${tout.length} intention(s) de paiement.\n`);
console.log(`  pays   tentatives   payées`);
for (const [k, n] of [...m].sort((a, b) => b[1] - a[1]).slice(0, 15))
  console.log(`  ${String(k).padEnd(6)} ${String(n).padStart(9)} ${String(payes.get(k) ?? 0).padStart(8)}`);
console.log('');
