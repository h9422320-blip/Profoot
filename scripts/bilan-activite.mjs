import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const h24 = new Date(Date.now()-864e5).toISOString();
const j7  = new Date(Date.now()-7*864e5).toISOString();

const compte = async (table, champ, depuis) => {
  const { count } = await sb.from(table).select('*',{count:'exact',head:true}).gt(champ, depuis);
  return count ?? 0;
};

console.log('\n══ ACTIVITÉ ══');
console.log(`  analyses produites — 24 h : ${await compte('analysis_history','created_at',h24)}`);
console.log(`  analyses produites — 7 j  : ${await compte('analysis_history','created_at',j7)}`);
console.log(`  intentions de paiement — 24 h : ${await compte('payment_intents','created_at',h24)}`);
console.log(`  intentions de paiement — 7 j  : ${await compte('payment_intents','created_at',j7)}`);

const { data: abos } = await sb.from('subscriptions').select('plan, created_at, expires_at');
const actifs = (abos??[]).filter(a=>!a.expires_at || Date.parse(a.expires_at) > Date.now());
const parPlan = new Map();
for(const a of actifs) parPlan.set(a.plan,(parPlan.get(a.plan)??0)+1);
console.log(`\n══ ABONNEMENTS ══`);
console.log(`  total enregistrés : ${abos?.length ?? 0}   ACTIFS aujourd hui : ${actifs.length}`);
for(const [p,n] of [...parPlan.entries()].sort((a,b)=>b[1]-a[1])) console.log(`     ${String(p).padEnd(20)} ${n}`);
const nouveaux7 = (abos??[]).filter(a=>Date.parse(a.created_at) > Date.parse(j7)).length;
console.log(`  nouveaux sur 7 jours : ${nouveaux7}`);

console.log('\n══ DIAGNOSTIC DE PAIEMENT (rempli depuis hier) ══');
const { data: pi } = await sb.from('payment_intents').select('statut_boutique, cause_echec, moyen_paiement').not('statut_boutique','is',null);
const st=new Map(), ca=new Map(), mo=new Map();
for(const p of pi??[]){
  st.set(p.statut_boutique,(st.get(p.statut_boutique)??0)+1);
  if(p.cause_echec) ca.set(p.cause_echec,(ca.get(p.cause_echec)??0)+1);
  if(p.moyen_paiement) mo.set(p.moyen_paiement,(mo.get(p.moyen_paiement)??0)+1);
}
console.log(`  ventes relevées : ${pi?.length ?? 0}`);
for(const [k,n] of [...st.entries()].sort((a,b)=>b[1]-a[1])) console.log(`     ${String(k).padEnd(18)} ${n}`);
console.log('  causes d échec :');
for(const [k,n] of [...ca.entries()].sort((a,b)=>b[1]-a[1])) console.log(`     ${String(k).padEnd(24)} ${n}`);
console.log('  moyens observés :');
for(const [k,n] of [...mo.entries()].sort((a,b)=>b[1]-a[1])) console.log(`     ${String(k).padEnd(24)} ${n}`);
