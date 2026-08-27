import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: pi } = await sb.from('payment_intents').select('*').order('created_at',{ascending:false}).limit(2000);

const compter=(lignes,champ)=>{ const m=new Map(); for(const l of lignes) m.set(l[champ]??'(vide)',(m.get(l[champ]??'(vide)')??0)+1); return [...m.entries()].sort((a,b)=>b[1]-a[1]); };

console.log('\n══ TOUS PAYS — statut_boutique ══');
for(const [k,n] of compter(pi,'statut_boutique')) console.log(`   ${String(n).padStart(5)}  ${k}`);
console.log('\n══ TOUS PAYS — cause_echec ══');
for(const [k,n] of compter(pi,'cause_echec').slice(0,10)) console.log(`   ${String(n).padStart(5)}  ${k}`);

const tg = pi.filter(p=>p.pays==='TG');
console.log(`\n══ TOGO — ${tg.length} tentatives ══`);
console.log('  statut_boutique :'); for(const [k,n] of compter(tg,'statut_boutique')) console.log(`     ${String(n).padStart(4)}  ${k}`);
console.log('  moyen_paiement  :'); for(const [k,n] of compter(tg,'moyen_paiement')) console.log(`     ${String(n).padStart(4)}  ${k}`);
console.log('  cause_echec     :'); for(const [k,n] of compter(tg,'cause_echec')) console.log(`     ${String(n).padStart(4)}  ${k}`);
console.log('  message_echec   :'); for(const [k,n] of compter(tg,'message_echec').slice(0,6)) console.log(`     ${String(n).padStart(4)}  ${String(k).slice(0,110)}`);
console.log('  rattachés à un compte :', tg.filter(p=>p.user_id).length, '/', tg.length);
console.log('\n  Les 8 dernières tentatives togolaises :');
for(const p of tg.slice(0,8))
  console.log(`     ${String(p.created_at).slice(0,16).replace('T',' ')}  ${String(p.plan).padEnd(10)} ${String(p.moyen_paiement??'—').padEnd(14)} ${String(p.statut_boutique??'—').padEnd(12)} ${String(p.cause_echec??'').slice(0,40)}`);

// Comparaison : un pays qui marche
const ci = pi.filter(p=>p.pays==='CI');
console.log(`\n══ CÔTE D IVOIRE — ${ci.length} tentatives, pour comparer ══`);
console.log('  statut_boutique :'); for(const [k,n] of compter(ci,'statut_boutique')) console.log(`     ${String(n).padStart(4)}  ${k}`);
console.log('  moyen_paiement  :'); for(const [k,n] of compter(ci,'moyen_paiement').slice(0,6)) console.log(`     ${String(n).padStart(4)}  ${k}`);
