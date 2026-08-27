/**
 * LES QUARANTE QUI ONT VOULU ACHETER SANS Y ARRIVER. Lecture seule.
 *
 * On cherche l'intention contrariée par le PROCESSUS, pas par l'argent ni par
 * l'indifférence. Trois familles sont donc écartées :
 *
 *   — solde insuffisant : c'est un problème d'argent, pas de mode d'emploi ;
 *   — une seule tentative : rien ne prouve qu'ils aient buté sur quoi que ce
 *     soit, ils ont pu simplement changer d'avis ;
 *   — moins de deux aperçus : ils n'ont pas regardé le produit, les relancer
 *     serait du démarchage.
 *
 * Reste ceux qui ont ESSAYÉ PLUSIEURS FOIS, en connaissance du produit, sans
 * jamais aboutir. Ceux-là ont voulu payer et n'ont pas su.
 */
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
const abos = await lireTout('subscriptions','user_id, expires_at, created_at');
const analyses = await lireTout('analysis_history','user_id, created_at');
const actifs = new Set(abos.filter(a=>!a.expires_at||Date.parse(a.expires_at)>Date.now()).map(a=>a.user_id));
const aEuUnAbo = new Set(abos.map(a=>a.user_id));

const comptes=new Map();
for(let p=1;p<=40;p++){ const {data}=await sb.auth.admin.listUsers({page:p,perPage:1000}); if(!data?.users?.length) break; for(const u of data.users) comptes.set(u.id,{email:u.email, cree:u.created_at}); if(data.users.length<1000) break; }

const apercus=new Map();
for(const a of analyses) apercus.set(a.user_id,(apercus.get(a.user_id)??0)+1);

const maintenant=Date.now();
const parPersonne=new Map();
for(const i of intentions){
  if(!i.user_id) continue;
  const a = parPersonne.get(i.user_id) ?? { clics:0, dernier:0, dernierPlan:null, pays:null, causes:new Set(), statuts:new Set() };
  a.clics++;
  const t=Date.parse(i.created_at);
  if(t>a.dernier){ a.dernier=t; a.dernierPlan=i.plan; a.pays=i.pays; }
  if(i.cause_echec) a.causes.add(i.cause_echec);
  if(i.statut_boutique) a.statuts.add(i.statut_boutique);
  parPersonne.set(i.user_id,a);
}

const rejets = { deja_client:0, ancien:0, une_seule_tentative:0, solde_insuffisant:0, touriste:0, sans_email:0 };
const retenus=[];

for(const [uid,a] of parPersonne){
  const c = comptes.get(uid);
  if(!c?.email){ rejets.sans_email++; continue; }
  if(actifs.has(uid) || aEuUnAbo.has(uid)){ rejets.deja_client++; continue; }
  const age = (maintenant-a.dernier)/864e5;
  if(age > 7){ rejets.ancien++; continue; }
  if(a.causes.has('INSUFFICIENT_BALANCE')){ rejets.solde_insuffisant++; continue; }
  if(a.clics < 2){ rejets.une_seule_tentative++; continue; }
  const vus = apercus.get(uid) ?? 0;
  if(vus < 2){ rejets.touriste++; continue; }
  retenus.push({ uid, email:c.email, clics:a.clics, apercus:vus, plan:a.dernierPlan, pays:a.pays,
                 jours:Math.round(age*10)/10, causes:[...a.causes], statuts:[...a.statuts] });
}

console.log('\n══ CE QUI A ÉTÉ ÉCARTÉ, ET POURQUOI ══\n');
for(const [k,v] of Object.entries(rejets)) console.log(`   ${String(v).padStart(5)}  ${k.replace(/_/g,' ')}`);
console.log(`\n   ${retenus.length}  RETENUS : ont essayé plusieurs fois, connaissent le produit, pas un problème d argent`);

// Classement : la persistance d'abord, puis l'intérêt, puis la fraîcheur.
retenus.sort((x,y)=> y.clics-x.clics || y.apercus-x.apercus || x.jours-y.jours);
const quarante = retenus.slice(0,40);

console.log(`\n══ LES ${quarante.length} PREMIERS ══\n`);
console.log('   tentatives  aperçus  offre visée         pays  il y a   adresse');
for(const r of quarante)
  console.log(`   ${String(r.clics).padStart(10)}  ${String(r.apercus).padStart(7)}  ${String(r.plan).padEnd(19)} ${String(r.pays).padEnd(4)}  ${String(r.jours+'j').padStart(6)}   ${r.email}`);

const parPlan=new Map(), parPays=new Map();
for(const r of quarante){ parPlan.set(r.plan,(parPlan.get(r.plan)??0)+1); parPays.set(r.pays,(parPays.get(r.pays)??0)+1); }
console.log('\n   offres :', [...parPlan.entries()].map(([k,v])=>`${k}=${v}`).join('  '));
console.log('   pays   :', [...parPays.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join('  '));
console.log(`   tentatives : de ${Math.min(...quarante.map(r=>r.clics))} à ${Math.max(...quarante.map(r=>r.clics))}`);

fs.writeFileSync('.selection-40.json', JSON.stringify(quarante,null,1),'utf8');
console.log('\n   liste écrite dans .selection-40.json — AUCUN envoi.\n');
