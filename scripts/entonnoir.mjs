/** L'ENTONNOIR RÉEL, ÉTAPE PAR ÉTAPE. Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const lireTout = async (table, champs) => {
  const out=[];
  for(let de=0;de<200000;de+=1000){
    const { data, error } = await sb.from(table).select(champs).range(de,de+999);
    if(error){ console.log(' erreur '+table+' : '+error.message); break; }
    if(!data?.length) break; out.push(...data); if(data.length<1000) break;
  }
  return out;
};

// Comptes
const comptes=[];
for(let p=1;p<=40;p++){
  const { data } = await sb.auth.admin.listUsers({ page:p, perPage:1000 });
  if(!data?.users?.length) break;
  comptes.push(...data.users.map(u=>({ id:u.id, email:u.email, cree:u.created_at, vu:u.last_sign_in_at })));
  if(data.users.length<1000) break;
}

const analyses = await lireTout('analysis_history','user_id, created_at');
const intentions = await lireTout('payment_intents','user_id, created_at, consumed_at, plan, pays');
const abos = await lireTout('subscriptions','user_id, plan, created_at');

const aAnalyse = new Map();
for(const a of analyses) aAnalyse.set(a.user_id,(aAnalyse.get(a.user_id)??0)+1);
const aClique = new Set(intentions.map(i=>i.user_id).filter(Boolean));
const aPaye  = new Set(abos.map(a=>a.user_id).filter(Boolean));

const n = comptes.length;
const pct = (x)=> Math.round(x/n*1000)/10;
console.log(`\n══ ENTONNOIR — ${n} comptes ══\n`);
const etapes = [
  ['comptes créés', n],
  ['se sont connectés au moins une fois', comptes.filter(c=>c.vu).length],
  ['ont fait au moins UNE analyse', aAnalyse.size],
  ['ont cliqué sur payer', aClique.size],
  ['ONT PAYÉ', aPaye.size],
];
let prec=null;
for(const [nom,v] of etapes){
  const chute = prec===null ? '' : `   (−${Math.round((1-v/prec)*1000)/10} % depuis l étape précédente)`;
  console.log(`  ${String(v).padStart(6)}  ${String(pct(v)+' %').padStart(7)}  ${nom}${chute}`);
  prec=v;
}

// Combien d analyses avant d acheter ?
const premierAbo = new Map();
for(const a of abos){ const t=Date.parse(a.created_at); if(!premierAbo.has(a.user_id)||t<premierAbo.get(a.user_id)) premierAbo.set(a.user_id,t); }
const avant = [];
for(const [uid,quand] of premierAbo){
  const n = analyses.filter(x=>x.user_id===uid && Date.parse(x.created_at) < quand).length;
  avant.push(n);
}
avant.sort((a,b)=>a-b);
const med = avant[Math.floor(avant.length/2)];
console.log(`\n══ ANALYSES FAITES AVANT D ACHETER (${avant.length} acheteurs) ══`);
console.log(`  médiane : ${med}   moyenne : ${Math.round(avant.reduce((a,b)=>a+b,0)/avant.length*10)/10}`);
const tranches=[[0,0],[1,1],[2,3],[4,6],[7,10],[11,999]];
for(const [min,max] of tranches){
  const c = avant.filter(v=>v>=min&&v<=max).length;
  console.log(`     ${String(min===max?min:min+'–'+(max===999?'+':max)).padStart(5)} analyse(s) : ${String(c).padStart(4)}  ${'█'.repeat(Math.round(c/avant.length*50))}`);
}

// Taux d achat selon le nombre d analyses faites
console.log(`\n══ PROBABILITÉ D ACHETER SELON LE NOMBRE D ANALYSES FAITES ══`);
for(const [min,max] of tranches){
  const groupe = comptes.filter(c=>{ const v=aAnalyse.get(c.id)??0; return v>=min&&v<=max; });
  if(!groupe.length) continue;
  const acheteurs = groupe.filter(c=>aPaye.has(c.id)).length;
  console.log(`     ${String(min===max?min:min+'–'+(max===999?'+':max)).padStart(5)} analyse(s) : ${String(groupe.length).padStart(5)} comptes → ${String(acheteurs).padStart(4)} acheteurs  (${Math.round(acheteurs/groupe.length*1000)/10} %)`);
}
