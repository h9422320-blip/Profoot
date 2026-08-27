/** L ENGAGEMENT AVANT LA DÉCISION, sans inversion de cause. Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const lireTout = async (t,c) => { const o=[]; for(let de=0;de<200000;de+=1000){ const {data,error}=await sb.from(t).select(c).range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };

const comptes=[];
for(let p=1;p<=40;p++){ const {data}=await sb.auth.admin.listUsers({page:p,perPage:1000}); if(!data?.users?.length) break; comptes.push(...data.users.map(u=>({id:u.id,cree:Date.parse(u.created_at)}))); if(data.users.length<1000) break; }

const analyses = await lireTout('analysis_history','user_id, created_at');
const abos = await lireTout('subscriptions','user_id, created_at');
const intentions = await lireTout('payment_intents','user_id, created_at');

const premierAbo=new Map();
for(const a of abos){ const t=Date.parse(a.created_at); if(!premierAbo.has(a.user_id)||t<premierAbo.get(a.user_id)) premierAbo.set(a.user_id,t); }
const premierClic=new Map();
for(const i of intentions){ if(!i.user_id) continue; const t=Date.parse(i.created_at); if(!premierClic.has(i.user_id)||t<premierClic.get(i.user_id)) premierClic.set(i.user_id,t); }

// Analyses AVANT la décision : avant le 1er abo pour les acheteurs, toutes pour les autres.
const avantDecision=new Map();
for(const a of analyses){
  const limite = premierAbo.get(a.user_id);
  if(limite && Date.parse(a.created_at) >= limite) continue;
  avantDecision.set(a.user_id,(avantDecision.get(a.user_id)??0)+1);
}

const tranches=[[0,0],[1,1],[2,2],[3,4],[5,7],[8,12],[13,999]];
const nom=([a,b])=>a===b?String(a):`${a}–${b===999?'+':b}`;

console.log(`\n══ APERÇUS CONSULTÉS AVANT LA DÉCISION → TAUX D ACHAT ══`);
console.log(`   (le quota gratuit est de 0 analyse complète : ce sont des aperçus)\n`);
for(const t of tranches){
  const g = comptes.filter(c=>{ const v=avantDecision.get(c.id)??0; return v>=t[0]&&v<=t[1]; });
  if(!g.length) continue;
  const ach = g.filter(c=>premierAbo.has(c.id)).length;
  const taux = Math.round(ach/g.length*1000)/10;
  console.log(`   ${nom(t).padStart(6)} aperçu(s) : ${String(g.length).padStart(5)} comptes → ${String(ach).padStart(4)} acheteurs  ${String(taux+' %').padStart(7)}  ${'█'.repeat(Math.round(taux))}`);
}

console.log(`\n══ CEUX QUI ONT CLIQUÉ SUR PAYER : ONT-ILS ACHETÉ ? ══\n`);
for(const t of tranches){
  const g = comptes.filter(c=>premierClic.has(c.id) && (()=>{ const v=avantDecision.get(c.id)??0; return v>=t[0]&&v<=t[1]; })());
  if(!g.length) continue;
  const ach = g.filter(c=>premierAbo.has(c.id)).length;
  console.log(`   ${nom(t).padStart(6)} aperçu(s) : ${String(g.length).padStart(5)} ont cliqué → ${String(ach).padStart(4)} ont payé  (${Math.round(ach/g.length*1000)/10} %)`);
}

// Délai inscription → achat
const delais=[];
for(const c of comptes){ const t=premierAbo.get(c.id); if(t) delais.push(Math.round((t-c.cree)/36e5*10)/10); }
delais.sort((a,b)=>a-b);
console.log(`\n══ DÉLAI ENTRE L INSCRIPTION ET L ACHAT (${delais.length} acheteurs) ══`);
console.log(`   médiane : ${delais[Math.floor(delais.length/2)]} h`);
for(const [min,max,lib] of [[0,1,'moins d 1 h'],[1,6,'1 à 6 h'],[6,24,'6 à 24 h'],[24,72,'1 à 3 jours'],[72,1e9,'plus de 3 jours']]){
  const n=delais.filter(d=>d>=min&&d<max).length;
  console.log(`     ${lib.padEnd(16)} ${String(n).padStart(4)}  (${Math.round(n/delais.length*1000)/10} %)  ${'█'.repeat(Math.round(n/delais.length*40))}`);
}
