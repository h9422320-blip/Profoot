import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const DEPUIS = '2026-08-26T18:56:00Z';
const { data: abos } = await sb.from('subscriptions').select('user_id, plan, created_at, chariow_sale_id').gt('created_at',DEPUIS).order('created_at',{ascending:true});
const { count: clics } = await sb.from('payment_intents').select('*',{count:'exact',head:true}).gt('created_at',DEPUIS);
console.log(`\n  depuis ${DEPUIS} :`);
console.log(`     clics sur payer ............ ${clics}`);
console.log(`     ABONNEMENTS OUVERTS ........ ${abos?.length ?? 0}`);
for(const a of abos??[]) console.log(`        ${String(a.created_at).slice(11,16)} UTC   ${String(a.plan).padEnd(20)} vente ${a.chariow_sale_id ?? '—'}`);
console.log('');
