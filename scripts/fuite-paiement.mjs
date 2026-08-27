/** OÙ SE PERDENT LES 79 % QUI CLIQUENT SUR PAYER. Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const lireTout = async (t,c) => { const o=[]; for(let de=0;de<200000;de+=1000){ const {data,error}=await sb.from(t).select(c).range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };

const intentions = await lireTout('payment_intents','user_id, plan, pays, created_at, consumed_at, statut_boutique, cause_echec, moyen_paiement');
const abos = await lireTout('subscriptions','user_id, plan, chariow_sale_id');
const ontPaye = new Set(abos.map(a=>a.user_id).filter(Boolean));

console.log(`\n══ ${intentions.length} clics sur « payer » ══\n`);

// Par offre
const parPlan=new Map();
for(const i of intentions){
  const a=parPlan.get(i.plan)??{clics:0,acheteurs:new Set()};
  a.clics++; if(ontPaye.has(i.user_id)) a.acheteurs.add(i.user_id);
  parPlan.set(i.plan,a);
}
console.log('  PAR OFFRE :');
for(const [p,a] of [...parPlan.entries()].sort((x,y)=>y[1].clics-x[1].clics))
  console.log(`     ${String(p).padEnd(20)} ${String(a.clics).padStart(5)} clics → ${String(a.acheteurs.size).padStart(4)} acheteurs  (${Math.round(a.acheteurs.size/a.clics*1000)/10} %)`);

// Nombre de tentatives par personne
const parPersonne=new Map();
for(const i of intentions){ if(!i.user_id) continue; parPersonne.set(i.user_id,(parPersonne.get(i.user_id)??0)+1); }
console.log('\n  NOMBRE DE TENTATIVES PAR PERSONNE :');
for(const [min,max] of [[1,1],[2,2],[3,4],[5,9],[10,999]]){
  const g=[...parPersonne.entries()].filter(([,n])=>n>=min&&n<=max);
  if(!g.length) continue;
  const ach=g.filter(([u])=>ontPaye.has(u)).length;
  console.log(`     ${String(min===max?min:min+'–'+(max===999?'+':max)).padStart(5)} tentative(s) : ${String(g.length).padStart(5)} personnes → ${String(ach).padStart(4)} ont payé  (${Math.round(ach/g.length*1000)/10} %)`);
}

// Par pays
console.log('\n  PAR PAYS (min. 25 clics) :');
const parPays=new Map();
for(const i of intentions){
  const a=parPays.get(i.pays??'?')??{clics:0,acheteurs:new Set()};
  a.clics++; if(ontPaye.has(i.user_id)) a.acheteurs.add(i.user_id);
  parPays.set(i.pays??'?',a);
}
for(const [p,a] of [...parPays.entries()].filter(([,a])=>a.clics>=25).sort((x,y)=>y[1].acheteurs.size/y[1].clics - x[1].acheteurs.size/x[1].clics))
  console.log(`     ${String(p).padEnd(5)} ${String(a.clics).padStart(5)} clics → ${String(a.acheteurs.size).padStart(4)} acheteurs  (${Math.round(a.acheteurs.size/a.clics*1000)/10} %)`);

// Ce que dit la boutique
const releves = intentions.filter(i=>i.statut_boutique);
console.log(`\n  CE QUE DIT LA BOUTIQUE (${releves.length} ventes relevées) :`);
const st=new Map();
for(const i of releves) st.set(i.statut_boutique,(st.get(i.statut_boutique)??0)+1);
for(const [k,n] of [...st.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(18)} ${String(n).padStart(4)}  (${Math.round(n/releves.length*1000)/10} %)`);
