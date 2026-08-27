import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;
const cibles = ['ibrahimecossokho@gmail.com','assiatoubah@gmail.com','alassanedao075@gmail.com','alphaoumardiaby187@gmail.com','kelepe@gmail.com'];
for(const e of cibles){
  const { data } = await sb.from('payment_intents').select('sale_id, amount, pays, plan').ilike('email', e).order('created_at',{ascending:false}).limit(1);
  const s = data?.[0]; if(!s) { console.log(`  ${e} : introuvable`); continue; }
  const r = await fetch(`https://api.chariow.com/v1/sales/${s.sale_id}`,{headers:{Authorization:`Bearer ${cle}`,Accept:'application/json'}});
  const v = (await r.json())?.data;
  console.log(`\n  ${e}  (${s.pays}, ${s.plan})`);
  console.log(`     notre montant attendu ... ${s.amount}`);
  console.log(`     original_amount ......... ${JSON.stringify(v?.original_amount)}`);
  console.log(`     amount .................. ${JSON.stringify(v?.amount)}`);
  console.log(`     payment.amount .......... ${JSON.stringify(v?.payment?.amount)}`);
  console.log(`     rate .................... ${JSON.stringify(v?.rate)}`);
}
console.log('');
