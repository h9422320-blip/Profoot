/** QUEL MOYEN DE PAIEMENT ÉCHOUE, PAYS PAR PAYS. Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;
const CIBLES = (process.argv[2] ?? 'GN,BF,TG').split(',');

const lireTout = async (t,c,f) => { const o=[]; for(let de=0;de<200000;de+=1000){ let q=sb.from(t).select(c); if(f) q=f(q); const {data,error}=await q.range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };

for(const PAYS of CIBLES){
  const intentions = await lireTout('payment_intents','sale_id, email, plan, created_at', q=>q.eq('pays',PAYS));
  const moyensKo=new Map(), moyensOk=new Map(), causesParMoyen=new Map();
  let n=0;
  for(const i of intentions){
    let v=null;
    try{ const r=await fetch(`https://api.chariow.com/v1/sales/${i.sale_id}`,{headers:{Authorization:`Bearer ${cle}`,Accept:'application/json'}}); v=(await r.json())?.data; }catch{}
    if(!v) continue;
    n++;
    const m=v.payment?.method?.name;
    if(!m) continue;
    if(v.status==='completed'||v.status==='settled') moyensOk.set(m,(moyensOk.get(m)??0)+1);
    else if(v.status==='failed'){
      moyensKo.set(m,(moyensKo.get(m)??0)+1);
      const c=v.payment?.failure_error?.code ?? '?';
      const k=`${m} → ${c}`; causesParMoyen.set(k,(causesParMoyen.get(k)??0)+1);
    }
    process.stdout.write(`\r  ${PAYS} : ${n}/${intentions.length}`);
  }
  console.log('');
  console.log(`\n══ ${PAYS} — ${intentions.length} tentatives, ${n} lues ══\n`);
  const tous=new Set([...moyensKo.keys(),...moyensOk.keys()]);
  if(!tous.size){ console.log('   aucun moyen de paiement renseigné\n'); continue; }
  console.log('   moyen                     réussis  refusés   taux');
  for(const m of [...tous].sort()){
    const r=moyensOk.get(m)??0, e=moyensKo.get(m)??0;
    console.log(`   ${String(m).padEnd(24)} ${String(r).padStart(7)} ${String(e).padStart(8)}   ${r+e? Math.round(r/(r+e)*1000)/10 : 0} %`);
  }
  if(causesParMoyen.size){
    console.log('\n   causes précises :');
    for(const [k,v] of [...causesParMoyen.entries()].sort((a,b)=>b[1]-a[1])) console.log(`     ${String(v).padStart(3)}×  ${k}`);
  }
  console.log('');
}
