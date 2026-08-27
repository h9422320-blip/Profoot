import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: offres } = await sb.from('offres').select('cle, prix_xof');
const prix = new Map((offres??[]).map(o=>[o.cle, Number(o.prix_xof)]));
console.log('\n  tarifs en base :', [...prix.entries()].map(([k,v])=>`${k}=${v}`).join('  '));
const j30 = new Date(Date.now()-30*864e5).toISOString();
const { data: abos } = await sb.from('subscriptions').select('plan, created_at');
const recents = (abos??[]).filter(a=>a.created_at > j30);
let total=0; const parPlan=new Map();
for(const a of recents){ const p=prix.get(a.plan) ?? 0; total+=p; parPlan.set(a.plan,(parPlan.get(a.plan)??0)+1); }
console.log(`\n  ABONNEMENTS DES 30 DERNIERS JOURS : ${recents.length}`);
for(const [k,n] of [...parPlan.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`     ${String(k).padEnd(20)} ${String(n).padStart(4)} × ${String(prix.get(k) ?? '?').padStart(6)} = ${(n*(prix.get(k)??0)).toLocaleString('fr-FR')} FCFA`);
console.log(`\n  RECETTE 30 JOURS (au tarif actuel) : ${total.toLocaleString('fr-FR')} FCFA`);
console.log(`  Objectif mensuel : 10 000 000 FCFA  →  ${Math.round(total/10000000*1000)/10} % atteint\n`);
