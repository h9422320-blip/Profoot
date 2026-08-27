/** QUI RELANCER, ET QUI SURTOUT PAS. Lecture seule, aucun envoi. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const lireTout = async (t,c) => { const o=[]; for(let de=0;de<200000;de+=1000){ const {data,error}=await sb.from(t).select(c).range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };

const intentions = await lireTout('payment_intents','user_id, email, plan, pays, created_at, consumed_at, statut_boutique, cause_echec');
const abos = await lireTout('subscriptions','user_id, expires_at');
const actifs = new Set(abos.filter(a=>!a.expires_at || Date.parse(a.expires_at)>Date.now()).map(a=>a.user_id));

const comptes=new Map();
for(let p=1;p<=40;p++){ const {data}=await sb.auth.admin.listUsers({page:p,perPage:1000}); if(!data?.users?.length) break; for(const u of data.users) comptes.set(u.id,{email:u.email, vu:u.last_sign_in_at}); if(data.users.length<1000) break; }

const maintenant=Date.now();
const jours = (d)=> (maintenant-Date.parse(d))/864e5;

// Une ligne par PERSONNE, pas par clic.
const parPersonne=new Map();
for(const i of intentions){
  if(!i.user_id) continue;
  const a = parPersonne.get(i.user_id) ?? { clics:0, dernier:0, plans:new Set(), pays:i.pays, echec:null };
  a.clics++;
  const t=Date.parse(i.created_at);
  if(t>a.dernier){ a.dernier=t; a.dernierPlan=i.plan; a.pays=i.pays; }
  a.plans.add(i.plan);
  if(i.cause_echec) a.echec = i.cause_echec;
  parPersonne.set(i.user_id, a);
}

const candidats=[];
for(const [uid,a] of parPersonne){
  if(actifs.has(uid)) continue;                 // déjà client : on ne relance pas
  const c = comptes.get(uid); if(!c?.email) continue;
  candidats.push({ uid, email:c.email, ...a, age: (maintenant-a.dernier)/864e5 });
}

console.log(`\n══ ${candidats.length} personnes ont cliqué sur payer et ne sont pas clientes ══\n`);
console.log('  RÉPARTITION PAR ANCIENNETÉ DU DERNIER CLIC :');
for(const [min,max,lib] of [[0,2,'moins de 2 jours'],[2,7,'2 à 7 jours'],[7,14,'7 à 14 jours'],[14,30,'14 à 30 jours'],[30,1e9,'plus de 30 jours']]){
  const g=candidats.filter(c=>c.age>=min&&c.age<max);
  console.log(`     ${lib.padEnd(20)} ${String(g.length).padStart(5)}`);
}

console.log('\n  RÉPARTITION PAR NOMBRE DE TENTATIVES :');
for(const [min,max] of [[1,1],[2,2],[3,999]]){
  const g=candidats.filter(c=>c.clics>=min&&c.clics<=max);
  console.log(`     ${String(min===max?min:min+'+').padStart(3)} tentative(s) : ${String(g.length).padStart(5)}`);
}

// La cible serrée : récent, et donc encore chaud.
const chauds = candidats.filter(c=>c.age<=7);
console.log(`\n══ CIBLE SERRÉE — dernier clic depuis 7 jours : ${chauds.length} personnes ══\n`);
const parPlan=new Map(), parPays=new Map();
for(const c of chauds){
  parPlan.set(c.dernierPlan,(parPlan.get(c.dernierPlan)??0)+1);
  parPays.set(c.pays??'?',(parPays.get(c.pays??'?')??0)+1);
}
console.log('  par offre visée :');
for(const [k,n] of [...parPlan.entries()].sort((a,b)=>b[1]-a[1])) console.log(`     ${String(k).padEnd(20)} ${n}`);
console.log('  par pays :');
for(const [k,n] of [...parPays.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8)) console.log(`     ${String(k).padEnd(6)} ${n}`);
const avecEchec = chauds.filter(c=>c.echec).length;
console.log(`\n  dont un échec de paiement identifié : ${avecEchec}`);
console.log(`  dont solde insuffisant : ${chauds.filter(c=>c.echec==='INSUFFICIENT_BALANCE').length}`);

fs.writeFileSync('.cible-relance.json', JSON.stringify(chauds.map(c=>({email:c.email, clics:c.clics, plan:c.dernierPlan, pays:c.pays, jours:Math.round(c.age*10)/10, echec:c.echec})), null, 1), 'utf8');
console.log(`\n  liste écrite dans .cible-relance.json (${chauds.length} lignes) — rien n a été envoyé.\n`);
