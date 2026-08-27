/** D'où vient le 2-1 ? Diagnostic seul. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const { data, error } = await sb.from('predictions_match').select('*').limit(5000);
if(error){ console.log('  erreur : '+error.message); process.exit(1); }
console.log(`\n  ${data.length} predictions figees.\n`);
console.log('  colonnes :', Object.keys(data[0] ?? {}).join(', '), '\n');

const r2 = (v)=> v==null||!Number.isFinite(Number(v)) ? null : Math.round(Number(v)*100)/100;
const scores=new Map(), xg=new Map(); let sansXg=0;
for(const p of data){
  const s=`${p.buts_domicile}-${p.buts_exterieur}`;
  scores.set(s,(scores.get(s)??0)+1);
  const a=r2(p.xg_domicile), b=r2(p.xg_exterieur);
  if(a==null||b==null){ sansXg++; continue; }
  const k=`${a} / ${b}`;
  xg.set(k,(xg.get(k)??0)+1);
}
const top=(m,n)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);
console.log('  SCORES FIGES les plus frequents :');
for(const [k,v] of top(scores,8)) console.log(`     ${k.padEnd(8)} ${String(v).padStart(5)}   ${Math.round(v/data.length*1000)/10} %`);
console.log(`\n  Predictions SANS buts attendus enregistres : ${sansXg} / ${data.length}  (${Math.round(sansXg/data.length*1000)/10} %)`);
console.log('\n  COUPLES DE BUTS ATTENDUS les plus frequents (si un couple revient, le calcul est generique) :');
for(const [k,v] of top(xg,8)) console.log(`     ${k.padEnd(16)} ${String(v).padStart(5)}   ${Math.round(v/Math.max(1,data.length-sansXg)*1000)/10} %`);
console.log(`\n  Couples distincts : ${xg.size} pour ${data.length-sansXg} predictions.`);
