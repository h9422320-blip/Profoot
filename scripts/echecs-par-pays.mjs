import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;

async function toutes(statut){
  const vues=new Set(); const out=[]; let cursor=null;
  for(let t=0;t<80;t++){
    const u=new URL('https://api.chariow.com/v1/sales');
    u.searchParams.set('status',statut); u.searchParams.set('per_page','100');
    if(cursor) u.searchParams.set('cursor',cursor);
    const r=await fetch(u,{headers:{Authorization:`Bearer ${cle}`,Accept:'application/json'}});
    const j=await r.json().catch(()=>({}));
    const d=Array.isArray(j?.data)?j.data:[];
    let nv=0; for(const v of d) if(!vues.has(v.id)){ vues.add(v.id); out.push(v); nv++; }
    if(!j?.pagination?.has_more_pages||!j?.pagination?.next_cursor||nv===0) break;
    cursor=j.pagination.next_cursor;
  }
  return out;
}

const echecs = await toutes('failed');
const completes = await toutes('completed');
const settled = await toutes('settled');
const reussis = [...completes, ...settled];

const lireTout = async (t,c) => { const o=[]; for(let de=0;de<200000;de+=1000){ const {data,error}=await sb.from(t).select(c).range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };
const intentions = await lireTout('payment_intents','sale_id, pays');
const pays = new Map(intentions.filter(i=>i.sale_id).map(i=>[i.sale_id, i.pays]));

console.log(`\n══ ${echecs.length} refusés · ${reussis.length} réussis (completed ${completes.length} + settled ${settled.length}) ══\n`);

const parPays=new Map();
for(const v of echecs){
  const p=pays.get(v.id) ?? '?';
  const a=parPays.get(p) ?? { ko:0, ok:0, causes:new Map() };
  a.ko++;
  const c=v.payment?.failure_error?.code ?? '(sans code)';
  a.causes.set(c,(a.causes.get(c)??0)+1);
  parPays.set(p,a);
}
for(const v of reussis){
  const p=pays.get(v.id) ?? '?';
  const a=parPays.get(p) ?? { ko:0, ok:0, causes:new Map() };
  a.ok++; parPays.set(p,a);
}

console.log('  pays   réussis  refusés   taux    1re cause de refus');
for(const [p,a] of [...parPays.entries()].filter(([p,a])=>p!=='?' && a.ko+a.ok>=8).sort((x,y)=>y[1].ko-x[1].ko)){
  const taux = Math.round(a.ok/(a.ok+a.ko)*1000)/10;
  const top = [...a.causes.entries()].sort((x,y)=>y[1]-x[1])[0];
  const part = top ? Math.round(top[1]/a.ko*100) : 0;
  console.log(`   ${String(p).padEnd(5)} ${String(a.ok).padStart(7)} ${String(a.ko).padStart(8)} ${String(taux+' %').padStart(7)}    ${top? top[0]+' ('+part+' %)' : '—'}`);
}

// Focus : le solde insuffisant est-il partout la 1re cause ?
console.log('\n  PART DU « SOLDE INSUFFISANT » DANS LES REFUS, PAR PAYS :');
for(const [p,a] of [...parPays.entries()].filter(([p,a])=>p!=='?'&&a.ko>=8).sort((x,y)=>y[1].ko-x[1].ko)){
  const si=a.causes.get('INSUFFICIENT_BALANCE')??0;
  const pc=Math.round(si/a.ko*1000)/10;
  console.log(`   ${String(p).padEnd(5)} ${String(si).padStart(4)} / ${String(a.ko).padStart(4)} refus   ${String(pc+' %').padStart(7)}  ${'█'.repeat(Math.round(pc/2))}`);
}
