/** CEUX QUI ONT CLIQUÉ SANS PAYER REVIENNENT-ILS ? Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const lireTout = async (t,c) => { const o=[]; for(let de=0;de<200000;de+=1000){ const {data,error}=await sb.from(t).select(c).range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };

const intentions = await lireTout('payment_intents','user_id, created_at');
const abos = await lireTout('subscriptions','user_id, expires_at');
const analyses = await lireTout('analysis_history','user_id, created_at');
const actifs = new Set(abos.filter(a=>!a.expires_at||Date.parse(a.expires_at)>Date.now()).map(a=>a.user_id));

const comptes=new Map();
for(let p=1;p<=40;p++){ const {data}=await sb.auth.admin.listUsers({page:p,perPage:1000}); if(!data?.users?.length) break; for(const u of data.users) comptes.set(u.id,u.last_sign_in_at); if(data.users.length<1000) break; }

const dernierClic=new Map();
for(const i of intentions){ if(!i.user_id) continue; const t=Date.parse(i.created_at); if(t>(dernierClic.get(i.user_id)??0)) dernierClic.set(i.user_id,t); }
const derniereAnalyse=new Map();
for(const a of analyses){ const t=Date.parse(a.created_at); if(t>(derniereAnalyse.get(a.user_id)??0)) derniereAnalyse.set(a.user_id,t); }

const maintenant=Date.now();
const cible=[...dernierClic.entries()].filter(([u,t])=>!actifs.has(u) && (maintenant-t)/864e5 <= 7);

let revenus=0, revenusAnalyse=0;
const delaisRetour=[];
for(const [u,clic] of cible){
  const vu = Date.parse(comptes.get(u) ?? 0);
  if(vu > clic){ revenus++; delaisRetour.push((vu-clic)/36e5); }
  const an = derniereAnalyse.get(u) ?? 0;
  if(an > clic) revenusAnalyse++;
}
const n=cible.length;
console.log(`\n══ ${n} personnes ont cliqué sur payer ces 7 jours sans devenir clientes ══\n`);
console.log(`  se sont RECONNECTÉES après leur clic ..... ${revenus}   (${Math.round(revenus/n*1000)/10} %)`);
console.log(`  ont refait une analyse après leur clic .... ${revenusAnalyse}   (${Math.round(revenusAnalyse/n*1000)/10} %)`);
delaisRetour.sort((a,b)=>a-b);
if(delaisRetour.length) console.log(`  délai médian du retour ................... ${Math.round(delaisRetour[Math.floor(delaisRetour.length/2)]*10)/10} h`);

// Et ceux qui ont cliqué il y a moins de 48 h : sont-ils encore actifs aujourd hui ?
const recents = cible.filter(([,t])=>(maintenant-t)/864e5 <= 2);
const recentsRevenus = recents.filter(([u,t])=>Date.parse(comptes.get(u) ?? 0) > t).length;
console.log(`\n  parmi les ${recents.length} du dernier 48 h : ${recentsRevenus} sont revenus (${Math.round(recentsRevenus/Math.max(1,recents.length)*1000)/10} %)`);
