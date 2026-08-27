/** TOUS LES PAIEMENTS REFUSÉS — pagination par curseur. Lecture seule. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const cle = process.env.CHARIOW_API_KEY;

async function toutesLesVentes(statut){
  const vues=new Set(); const out=[]; let cursor=null;
  for(let tour=0; tour<80; tour++){
    const u = new URL('https://api.chariow.com/v1/sales');
    u.searchParams.set('status',statut); u.searchParams.set('per_page','100');
    if(cursor) u.searchParams.set('cursor',cursor);
    const r = await fetch(u,{ headers:{ Authorization:`Bearer ${cle}`, Accept:'application/json' } });
    const j = await r.json().catch(()=>({}));
    const d = Array.isArray(j?.data)?j.data:[];
    let nouveaux=0;
    for(const v of d){ if(!vues.has(v.id)){ vues.add(v.id); out.push(v); nouveaux++; } }
    process.stdout.write(`\r  ${statut} : ${out.length} ventes uniques (tour ${tour+1})`);
    if(!j?.pagination?.has_more_pages || !j?.pagination?.next_cursor || nouveaux===0) break;
    cursor = j.pagination.next_cursor;
  }
  console.log('');
  return out;
}

const echecs = await toutesLesVentes('failed');
const reussis = await toutesLesVentes('completed');

console.log(`\n══ ${echecs.length} REFUSÉS · ${reussis.length} RÉUSSIS ══\n`);

const causes=new Map(), moyensEchec=new Map(), moyensOk=new Map(), croise=new Map(), messages=new Map();
for(const v of echecs){
  const c=v.payment?.failure_error?.code ?? '(sans code)';
  const m=v.payment?.method?.name ?? '(non renseigné)';
  causes.set(c,(causes.get(c)??0)+1);
  moyensEchec.set(m,(moyensEchec.get(m)??0)+1);
  croise.set(`${m} | ${c}`,(croise.get(`${m} | ${c}`)??0)+1);
  const msg=v.payment?.failure_error?.customer_message; if(msg) messages.set(msg,(messages.get(msg)??0)+1);
}
for(const v of reussis){ const m=v.payment?.method?.name ?? '(non renseigné)'; moyensOk.set(m,(moyensOk.get(m)??0)+1); }

const tot=echecs.length||1;
console.log('  CAUSE DU REFUS :');
for(const [k,n] of [...causes.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(36)} ${String(n).padStart(4)}   ${Math.round(n/tot*1000)/10} %`);

console.log('\n  TAUX DE RÉUSSITE PAR MOYEN DE PAIEMENT :');
const tousMoyens=new Set([...moyensEchec.keys(),...moyensOk.keys()]);
const lignes=[];
for(const m of tousMoyens){
  const r=moyensOk.get(m)??0, e=moyensEchec.get(m)??0;
  if(r+e<5) continue;
  lignes.push({m,r,e,taux:Math.round(r/(r+e)*1000)/10});
}
for(const l of lignes.sort((a,b)=>a.taux-b.taux))
  console.log(`     ${String(l.m).padEnd(24)} ${String(l.r).padStart(4)} ok / ${String(l.e).padStart(4)} ko   ${String(l.taux+' %').padStart(7)}  ${'█'.repeat(Math.round(l.taux/3))}`);

console.log('\n  CROISEMENT MOYEN × CAUSE (15 premiers) :');
for(const [k,n] of [...croise.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15))
  console.log(`     ${String(n).padStart(4)}  ${k}`);

console.log('\n  MESSAGE VU PAR LE CLIENT :');
for(const [k,n] of [...messages.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6))
  console.log(`     ${String(n).padStart(4)}×  ${String(k).slice(0,95)}`);
