import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('subscriptions').select('*').eq('plan', 'vip_yearly').eq('amount', 2000);
for (const a of data ?? []) {
  const debut = new Date(a.created_at), fin = new Date(a.expires_at);
  const jours = Math.round((fin - debut) / 86400000);
  const { data: pi } = await sb.from('payment_intents').select('email, plan, amount').eq('sale_id', a.chariow_sale_id);
  console.log(`\n  ${pi?.[0]?.email ?? a.user_id}`);
  console.log(`     payé          : ${pi?.[0]?.amount} FCFA pour ${pi?.[0]?.plan}`);
  console.log(`     enregistré    : ${a.plan}`);
  console.log(`     ouvert le     : ${a.created_at.slice(0, 10)}`);
  console.log(`     expire le     : ${a.expires_at.slice(0, 10)}   → ${jours} jours (${(jours / 30).toFixed(1)} mois)`);
}
console.log('');
