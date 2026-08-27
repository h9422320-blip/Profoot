/** POURQUOI LES PAIEMENTS ÉCHOUENT — le Mali d'abord. Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;
const PAYS = (process.argv[2] ?? 'ML').toUpperCase();

const lireTout = async (t,c,f) => { const o=[]; for(let de=0;de<200000;de+=1000){ let q=sb.from(t).select(c); if(f) q=f(q); const {data,error}=await q.range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };

const intentions = await lireTout('payment_intents','sale_id, user_id, email, plan, pays, created_at, consumed_at', q=>q.eq('pays',PAYS).order('created_at',{ascending:false}));
console.log(`\n══ ${PAYS} — ${intentions.length} tentatives de paiement ══\n`);

const statuts=new Map(), causes=new Map(), moyens=new Map(), messages=new Map();
const parPersonne=new Map();
let interroges=0, introuvables=0;

for(const i of intentions){
  let v=null;
  try{
    const r = await fetch(`https://api.chariow.com/v1/sales/${i.sale_id}`, { headers:{ Authorization:`Bearer ${cle}`, Accept:'application/json' } });
    v = (await r.json())?.data;
  }catch{}
  if(!v){ introuvables++; continue; }
  interroges++;
  const st = v.status ?? '?';
  statuts.set(st,(statuts.get(st)??0)+1);
  const moyen = v.payment?.method?.name ?? (st==='abandoned' ? '(aucun choisi)' : '—');
  moyens.set(moyen,(moyens.get(moyen)??0)+1);
  const err = v.payment?.failure_error;
  if(err?.code){ causes.set(err.code,(causes.get(err.code)??0)+1);
    const m = err.customer_message ?? err.message ?? '';
    if(m) messages.set(m,(messages.get(m)??0)+1); }
  const a = parPersonne.get(i.email) ?? { n:0, statuts:new Set(), moyens:new Set(), causes:new Set() };
  a.n++; a.statuts.add(st); if(moyen!=='—') a.moyens.add(moyen); if(err?.code) a.causes.add(err.code);
  parPersonne.set(i.email,a);
  process.stdout.write(`\r  interrogées : ${interroges}/${intentions.length}`);
}
console.log('\n');

const tot = interroges || 1;
console.log('  STATUT CHEZ LA BOUTIQUE :');
for(const [k,n] of [...statuts.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(20)} ${String(n).padStart(4)}   ${Math.round(n/tot*1000)/10} %`);

console.log('\n  MOYEN DE PAIEMENT CHOISI :');
for(const [k,n] of [...moyens.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(24)} ${String(n).padStart(4)}   ${Math.round(n/tot*1000)/10} %`);

console.log('\n  CAUSE DE L ÉCHEC (uniquement les paiements RÉELLEMENT tentés) :');
const totCauses=[...causes.values()].reduce((a,b)=>a+b,0);
if(!totCauses) console.log('     aucune — personne n a été refusé');
for(const [k,n] of [...causes.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(36)} ${String(n).padStart(4)}   ${Math.round(n/totCauses*1000)/10} % des refus`);

if(messages.size){
  console.log('\n  MESSAGE VU PAR LE CLIENT :');
  for(const [k,n] of [...messages.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5))
    console.log(`     ${String(n).padStart(3)}×  ${String(k).slice(0,100)}`);
}

console.log(`\n  ${parPersonne.size} personnes distinctes.`);
console.log('  Les plus acharnées :');
for(const [e,a] of [...parPersonne.entries()].sort((x,y)=>y[1].n-x[1].n).slice(0,8))
  console.log(`     ${String(a.n).padStart(3)} tentatives  ${String(e).padEnd(34)} statuts: ${[...a.statuts].join(',')}  moyens: ${[...a.moyens].join(',')||'aucun'}  ${[...a.causes].join(',')}`);
if(introuvables) console.log(`\n  (${introuvables} vente(s) introuvable(s) chez la boutique)`);
console.log('');
