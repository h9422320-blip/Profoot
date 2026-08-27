import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const lignes=[];
for(let de=0; de<40000; de+=1000){
  const { data } = await sb.from('analysis_history').select('verified_at').not('verified_at','is','null').order('verified_at',{ascending:false}).range(de,de+999);
  if(!data?.length) break; lignes.push(...data); if(data.length<1000) break;
}
const parHeure=new Map();
for(const l of lignes){
  const k=String(l.verified_at).slice(0,13).replace('T',' ')+'h';
  parHeure.set(k,(parHeure.get(k)??0)+1);
}
console.log('\n  Vérifications par heure (UTC), les 20 dernières tranches :\n');
for(const [h,n] of [...parHeure.entries()].sort().reverse().slice(0,20))
  console.log(`     ${h}   ${String(n).padStart(5)}  ${'█'.repeat(Math.min(60,Math.round(n/20)))}`);
console.log(`\n  Total vérifiées : ${lignes.length}`);
const { count } = await sb.from('analysis_history').select('*',{count:'exact',head:true}).is('verified_at',null).not('fixture_id','is','null');
console.log(`  Encore en attente de vérification : ${count}\n`);
