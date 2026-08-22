import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CATALOGUE = { essential_monthly: 2000, pro_monthly: 5000, vip_yearly: 15000 };
const { data } = await sb.from('subscriptions').select('*')
  .lt('created_at', '2026-08-16T00:00:00Z').order('created_at');
console.log(`\n  ${data.length} abonnement(s) avant le 16 août\n`);
console.log(`  date              plan                  amount   catalogue compté aujourd'hui`);
for (const a of data)
  console.log(`  ${a.created_at.slice(0,16)}  ${String(a.plan).padEnd(20)} ${String(a.amount).padStart(7)}   ${String(CATALOGUE[a.plan] ?? 0).padStart(7)}${CATALOGUE[a.plan] ? '' : '  << plan inconnu du catalogue : compté ZÉRO'}`);
console.log('');
