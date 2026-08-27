import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data, error } = await sb.from('precision_quotidienne').select('*').order('jour',{ascending:false}).limit(20);
if(error){ console.log('  erreur : '+error.message); process.exit(1); }
console.log(`\n  ${data.length} journée(s) enregistrée(s) — marqueur « la tâche est allée au bout ».\n`);
console.log('  colonnes :', Object.keys(data[0]??{}).join(', '), '\n');
for(const d of data) console.log(`     ${d.jour}   ${JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k])=>k!=='jour'))).slice(0,110)}`);

// Les jours attendus depuis le 15 aout
const vus = new Set(data.map(d=>String(d.jour).slice(0,10)));
const manquants=[];
for(let i=0;i<12;i++){
  const j=new Date(Date.UTC(2026,7,26-i)).toISOString().slice(0,10);
  if(!vus.has(j)) manquants.push(j);
}
console.log(`\n  Jours SANS enregistrement sur les 12 derniers : ${manquants.join(', ') || 'aucun'}`);
