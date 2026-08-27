import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const pi=[];
for(let de=0;de<20000;de+=1000){
  const { data } = await sb.from('payment_intents').select('pays, plan, user_id, consumed_at, sale_id, releve_le, created_at').order('created_at',{ascending:false}).range(de,de+999);
  if(!data?.length) break; pi.push(...data); if(data.length<1000) break;
}
console.log(`\n  ${pi.length} intentions au total.`);
const parPays=new Map();
for(const p of pi){
  const a=parPays.get(p.pays??'?')??{total:0,consommees:0,avecVente:0};
  a.total++;
  if(p.consumed_at) a.consommees++;
  if(p.sale_id) a.avecVente++;
  parPays.set(p.pays??'?',a);
}
console.log('\n  pays   tentatives   avec identifiant de vente   ABONNEMENT OBTENU   taux');
for(const [k,a] of [...parPays.entries()].sort((x,y)=>y[1].total-x[1].total).slice(0,18)){
  const taux = a.total? Math.round(a.consommees/a.total*1000)/10 : 0;
  console.log(`   ${String(k).padEnd(5)} ${String(a.total).padStart(9)} ${String(a.avecVente).padStart(24)} ${String(a.consommees).padStart(18)} ${String(taux).padStart(7)} %`);
}
const total=pi.length, cons=pi.filter(p=>p.consumed_at).length, vente=pi.filter(p=>p.sale_id).length;
console.log(`\n  ENSEMBLE : ${total} tentatives, ${vente} avec identifiant de vente, ${cons} abonnements obtenus (${Math.round(cons/total*1000)/10} %).`);
