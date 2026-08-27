import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const { data: pi, error } = await sb.from('payment_intents').select('*').order('created_at',{ascending:false}).limit(2000);
if(error){ console.log('erreur : '+error.message); process.exit(1); }
console.log(`\n  ${pi.length} intentions de paiement lues.`);
console.log('  colonnes :', Object.keys(pi[0]??{}).join(', '), '\n');

const champPays = Object.keys(pi[0]??{}).find(k=>/pays|country/i.test(k));
const champEtat  = Object.keys(pi[0]??{}).find(k=>/status|etat/i.test(k));
console.log(`  champ pays = ${champPays ?? 'AUCUN'}   champ etat = ${champEtat ?? 'AUCUN'}\n`);

const parEtat=new Map();
for(const p of pi) parEtat.set(p[champEtat],(parEtat.get(p[champEtat])??0)+1);
console.log('  ETATS :', [...parEtat.entries()].map(([k,v])=>`${k}=${v}`).join('  '));

if(champPays){
  const parPays=new Map();
  for(const p of pi){
    const k=p[champPays]??'?';
    const a=parPays.get(k)??{total:0,payes:0};
    a.total++; if(String(p[champEtat]).toLowerCase().includes('paid')||String(p[champEtat]).toLowerCase().includes('succ')) a.payes++;
    parPays.set(k,a);
  }
  console.log('\n  PAR PAYS (total / payés) :');
  for(const [k,a] of [...parPays.entries()].sort((x,y)=>y[1].total-x[1].total).slice(0,25))
    console.log(`     ${String(k).padEnd(8)} ${String(a.total).padStart(5)} / ${String(a.payes).padStart(4)}`);
}

// Les utilisateurs togolais existent-ils ?
const { data: profils } = await sb.from('profiles').select('*').limit(1);
if(profils?.[0]) console.log('\n  colonnes profiles :', Object.keys(profils[0]).join(', '));
