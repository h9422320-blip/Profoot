import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const avant = new Set(JSON.parse(fs.readFileSync('.avant-publication.json','utf8')));
const { data } = await sb.from('preuves').select('id, publiee, date_match, team1_name, team2_name, prono_score, score_reel, score_exact, issue_correcte');
const apres = new Set(data.map(p=>p.id));
const disparues = [...avant].filter(id=>!apres.has(id));
console.log(`\n  GARDE-FOU — cartes présentes avant et disparues après : ${disparues.length}`);
if(disparues.length) for(const d of disparues.slice(0,10)) console.log('     '+d);
console.log(`  cartes ajoutées : ${[...apres].filter(id=>!avant.has(id)).length}`);
const du26 = data.filter(p=>String(p.date_match??'').slice(0,10)==='2026-08-26');
console.log(`\n  LE 26 AOÛT SUR LE MUR — ${du26.length} cartes, ${du26.filter(p=>p.publiee).length} publiées :\n`);
for(const p of du26.sort((a,b)=>Number(b.issue_correcte)-Number(a.issue_correcte)))
  console.log(`    ${p.issue_correcte?'REUSSI':'rate  '} ${p.publiee?'[publiee]':'[cachee] '} ${(p.team1_name+' — '+p.team2_name).padEnd(40)} annonce ${String(p.prono_score).padEnd(8)} reel ${String(p.score_reel).padEnd(8)} ${p.score_exact?'SCORE EXACT':''}`);
console.log('');
