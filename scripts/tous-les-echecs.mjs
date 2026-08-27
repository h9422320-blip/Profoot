/** TOUS LES PAIEMENTS REFUSÉS, TOUS PAYS. Lecture seule. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const cle = process.env.CHARIOW_API_KEY;
const page = async (statut, p) => {
  const u = new URL('https://api.chariow.com/v1/sales');
  u.searchParams.set('status', statut);
  u.searchParams.set('per_page','100');
  u.searchParams.set('page', String(p));
  const r = await fetch(u, { headers:{ Authorization:`Bearer ${cle}`, Accept:'application/json' } });
  const j = await r.json().catch(()=>({}));
  return Array.isArray(j?.data) ? j.data : [];
};
const toutes = async (statut) => {
  const o=[];
  for(let p=1;p<=25;p++){ const d=await page(statut,p); if(!d.length) break; o.push(...d); if(d.length<100) break; }
  return o;
};

const echecs = await toutes('failed');
console.log(`\n══ ${echecs.length} PAIEMENTS REFUSÉS chez la boutique ══\n`);

const causes=new Map(), moyens=new Map(), parMoyenCause=new Map(), messages=new Map();
for(const v of echecs){
  const c = v.payment?.failure_error?.code ?? '(sans code)';
  const m = v.payment?.method?.name ?? '(inconnu)';
  causes.set(c,(causes.get(c)??0)+1);
  moyens.set(m,(moyens.get(m)??0)+1);
  const k=`${m} | ${c}`; parMoyenCause.set(k,(parMoyenCause.get(k)??0)+1);
  const msg = v.payment?.failure_error?.customer_message ?? '';
  if(msg) messages.set(msg,(messages.get(msg)??0)+1);
}
const tot=echecs.length||1;
console.log('  CAUSE :');
for(const [k,n] of [...causes.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(36)} ${String(n).padStart(4)}   ${Math.round(n/tot*1000)/10} %`);

console.log('\n  MOYEN DE PAIEMENT UTILISÉ LORS DU REFUS :');
for(const [k,n] of [...moyens.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(26)} ${String(n).padStart(4)}   ${Math.round(n/tot*1000)/10} %`);

console.log('\n  CROISEMENT MOYEN × CAUSE (les 15 premiers) :');
for(const [k,n] of [...parMoyenCause.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15))
  console.log(`     ${String(n).padStart(4)}  ${k}`);

// Comparaison : les réussites, par moyen.
const ok = await toutes('completed');
console.log(`\n══ ${ok.length} PAIEMENTS RÉUSSIS — pour comparer ══\n`);
const moyensOk=new Map();
for(const v of ok){ const m=v.payment?.method?.name ?? '(inconnu)'; moyensOk.set(m,(moyensOk.get(m)??0)+1); }
console.log('  TAUX DE RÉUSSITE PAR MOYEN (réussis / [réussis + refusés]) :');
const tousMoyens=new Set([...moyens.keys(),...moyensOk.keys()]);
const lignes=[];
for(const m of tousMoyens){
  const r=moyensOk.get(m)??0, e=moyens.get(m)??0;
  if(r+e < 3) continue;
  lignes.push({ m, r, e, taux: Math.round(r/(r+e)*1000)/10 });
}
for(const l of lignes.sort((a,b)=>a.taux-b.taux))
  console.log(`     ${String(l.m).padEnd(26)} ${String(l.r).padStart(4)} réussis / ${String(l.e).padStart(3)} refusés   ${String(l.taux+' %').padStart(7)}  ${'█'.repeat(Math.round(l.taux/3))}`);
