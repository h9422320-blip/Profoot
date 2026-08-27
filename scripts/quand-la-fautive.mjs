import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(),'src') } });
const { contientVocabulaireInterdit, motsInterdits } = await jiti.import('./src/lib/filtre-vocabulaire.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const { data } = await sb.from('analysis_history')
  .select('id, created_at, analysis_data')
  .gt('created_at','2026-08-26T11:30:16').order('created_at',{ascending:true});

let derniereFautive=null;
const lignes=[];
for(const a of data??[]){
  const s=JSON.stringify(a.analysis_data??'');
  const sale=contientVocabulaireInterdit(s);
  if(sale){ derniereFautive=a.created_at; lignes.push([a.created_at, motsInterdits(s).join(', ')]); }
}
console.log(`\n  ${data.length} analyse(s) produites depuis 11:30:16 UTC.\n`);
for(const [q,m] of lignes) console.log(`   FAUTIVE  ${String(q).slice(11,19)}   ${m}`);
if(!derniereFautive){ console.log('   aucune fautive.'); process.exit(0); }

const apres = (data??[]).filter(a=>a.created_at > derniereFautive);
const sales = apres.filter(a=>contientVocabulaireInterdit(JSON.stringify(a.analysis_data??'')));
console.log(`\n  Dernière fautive : ${String(derniereFautive).slice(11,19)} UTC`);
console.log(`  Analyses produites APRÈS elle : ${apres.length}, dont fautives : ${sales.length}`);
console.log(`  Première analyse propre suivante : ${apres[0] ? String(apres[0].created_at).slice(11,19) : '—'}`);
console.log(`  Dernière analyse observée : ${String(data[data.length-1].created_at).slice(11,19)}\n`);
