import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: abos } = await sb.from('subscriptions').select('chariow_sale_id, created_at').not('chariow_sale_id','is',null).order('created_at',{ascending:false}).limit(400);
const { data: pi } = await sb.from('payment_intents').select('sale_id, created_at').not('sale_id','is',null);
const debut = new Map((pi??[]).map(p=>[p.sale_id, Date.parse(p.created_at)]));
const delais=[];
for(const a of abos??[]){
  const d = debut.get(a.chariow_sale_id);
  if(!d) continue;
  delais.push(Math.round((Date.parse(a.created_at)-d)/1000));
}
delais.sort((x,y)=>x-y);
const tranche = (max) => delais.filter(d=>d<=max).length;
console.log(`\n  ${delais.length} abonnements rapprochés de leur intention.\n`);
console.log(`     ouverts en moins de 2 min ....... ${tranche(120)}   (${Math.round(tranche(120)/delais.length*100)} %)`);
console.log(`     entre 2 min et 1 h .............. ${tranche(3600)-tranche(120)}`);
console.log(`     entre 1 h et 24 h ............... ${tranche(86400)-tranche(3600)}`);
console.log(`     PLUS DE 24 H .................... ${delais.length-tranche(86400)}`);
console.log(`\n     médiane : ${delais[Math.floor(delais.length/2)]} s`);
