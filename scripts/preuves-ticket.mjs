/** Les identifiants de vente à citer dans le ticket. Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;
const lireTout = async (t,c,f) => { const o=[]; for(let de=0;de<200000;de+=1000){ let q=sb.from(t).select(c); if(f) q=f(q); const {data,error}=await q.range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };

for(const PAYS of ['GN','BF','ML','TG']){
  const intentions = await lireTout('payment_intents','sale_id, created_at', q=>q.eq('pays',PAYS).order('created_at',{ascending:false}));
  const exemples=[];
  for(const i of intentions){
    if(exemples.length>=6) break;
    let v=null;
    try{ const r=await fetch(`https://api.chariow.com/v1/sales/${i.sale_id}`,{headers:{Authorization:`Bearer ${cle}`,Accept:'application/json'}}); v=(await r.json())?.data; }catch{}
    if(!v || v.status!=='failed') continue;
    const m=v.payment?.method?.name; const c=v.payment?.failure_error?.code;
    if(!m||!c) continue;
    exemples.push({ id:v.id, m, c, date:String(v.created_at).slice(0,16).replace('T',' '), montant:v.payment?.amount?.formatted ?? '' });
  }
  console.log(`\n  ${PAYS} :`);
  for(const e of exemples) console.log(`     ${e.id}   ${e.date}   ${String(e.m).padEnd(14)} ${e.c}   ${e.montant}`);
}
console.log('');
