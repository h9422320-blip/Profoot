/** Le mur est-il oriente correctement, carte par carte ? Diagnostic seul. */
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
const { memeEquipe } = await jiti.import('./src/lib/preuves.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const { data: preuves } = await sb.from('preuves').select('*');
const { data: figees } = await sb.from('predictions_match').select('fixture_id, domicile_nom');
const dom = new Map((figees??[]).map(f=>[String(f.fixture_id), f.domicile_nom]));

let bonnes=0, envers=0, inconnues=0;
const listeEnvers=[];
for(const p of preuves??[]){
  const d = dom.get(String(p.fixture_id));
  if(!d){ inconnues++; continue; }
  if(memeEquipe(p.team1_name, d)) bonnes++;
  else { envers++; listeEnvers.push(`${p.team1_name} — ${p.team2_name}   (recevait : ${d})`); }
}
console.log(`\n  ${preuves.length} cartes sur le mur.`);
console.log(`     dans le bon sens ......... ${bonnes}`);
console.log(`     A L ENVERS ............... ${envers}`);
console.log(`     sens inconnu (pas de prediction figee) ... ${inconnues}`);
if(listeEnvers.length){
  console.log('\n  Les cartes encore a l envers :\n');
  for(const x of listeEnvers.slice(0,40)) console.log('    ' + x);
  if(listeEnvers.length>40) console.log(`    ... et ${listeEnvers.length-40} autres`);
}

const du25 = (preuves??[]).filter(p=>String(p.date_match??'').slice(0,10)==='2026-08-25');
console.log(`\n  ── LE 25 AOUT SUR LE MUR : ${du25.length} carte(s), ${du25.filter(p=>p.publiee).length} publiee(s) ──\n`);
for(const p of du25.sort((a,b)=>Number(b.issue_correcte)-Number(a.issue_correcte)))
  console.log(`    ${p.issue_correcte?'REUSSI':'rate  '} ${p.publiee?'[publiee]':'[cachee] '} ${(p.team1_name+' — '+p.team2_name).padEnd(40)} annonce ${String(p.prono_score).padEnd(8)} reel ${p.score_reel}`);
