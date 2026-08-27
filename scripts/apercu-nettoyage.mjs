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
const { assainirAnalyse } = await jiti.import('./src/lib/filtre-vocabulaire.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('analysis_history').select('id, analysis_data').order('created_at',{ascending:false}).limit(600);

const phrases = (s) => String(s??'').split(/(?<=[.!?…])\s+/);
let n=0;
for(const l of data??[]){
  const avant = JSON.parse(JSON.stringify(l.analysis_data));
  const apres = JSON.parse(JSON.stringify(l.analysis_data));
  if(!assainirAnalyse(apres).champsNettoyes) continue;
  const paires = [
    [avant.quickSummary, apres.quickSummary],
    ...(avant.sections??[]).map((s,i)=>[s?.content, apres.sections?.[i]?.content]),
    ...(avant.scenarios??[]).map((s,i)=>[s?.content, apres.scenarios?.[i]?.content]),
    [avant.predictedScore?.reasoning, apres.predictedScore?.reasoning],
  ];
  for(const [a,b] of paires){
    if(!a || a===b) continue;
    const pa=phrases(a), pb=phrases(b);
    for(let i=0;i<pa.length;i++){
      if(pa[i]===pb[i]) continue;
      console.log(`   AVANT : ${pa[i].trim()}`);
      console.log(`   APRÈS : ${pb[i].trim()}\n`);
      if(++n>=8) process.exit(0);
    }
  }
}
