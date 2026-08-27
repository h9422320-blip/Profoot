import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;
const cible = (process.argv[2] ?? '').toLowerCase();

const { data: pi } = await sb.from('payment_intents').select('sale_id, created_at, amount, plan').ilike('email', cible);
console.log(`\n  ${pi?.length ?? 0} intention(s) pour ${cible}. État réel chez la boutique :\n`);
for (const i of pi ?? []) {
  const r = await fetch(`https://api.chariow.com/v1/sales/${i.sale_id}`, { headers: { Authorization: `Bearer ${cle}`, Accept: 'application/json' } });
  const v = (await r.json())?.data;
  console.log(`   ${String(i.created_at).slice(0,16).replace('T',' ')}  ${String(i.plan).padEnd(18)} ${String(i.amount).padStart(6)} F`);
  if (!v) { console.log('       (introuvable chez la boutique)'); continue; }
  console.log(`       statut ..... ${v.status}`);
  console.log(`       moyen ...... ${v.payment?.method?.name ?? '—'}`);
  console.log(`       montant .... ${v.amount ?? v.total ?? '—'}`);
  console.log(`       échec ...... ${v.payment?.failure_error?.code ?? '—'}`);
}
console.log('');
