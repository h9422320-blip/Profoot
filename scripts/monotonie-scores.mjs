/**
 * LES SCORES ANNONCÉS SE RÉPÈTENT-ILS ?  Diagnostic seul.
 *
 * Le propriétaire a remarqué des « 2 - 1 » partout. Avant de toucher au
 * moteur, on compte : sur toutes les analyses enregistrées, quelle est la
 * distribution réelle des scores annoncés — et à quoi ressemble celle des
 * scores RÉELS du football, qui est la seule référence honnête.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const lignes=[];
for(let de=0; de<80000; de+=1000){
  const { data, error } = await sb.from('analysis_history')
    .select('fixture_id, team1_name, team2_name, score, real_score, created_at')
    .not('score','is',null)
    .order('created_at',{ascending:false})
    .range(de,de+999);
  if(error){ console.log('  erreur : '+error.message); break; }
  if(!data?.length) break;
  lignes.push(...data);
  if(data.length<1000) break;
}
console.log(`\n  ${lignes.length} analyses avec un score annoncé.\n`);

const lire=(s)=>{ const m=String(s??'').match(/(\d+)\s*[-–]\s*(\d+)/); return m?[+m[1],+m[2]]:null; };
// Un score « normalisé » : on ignore qui gagne, on regarde la FORME du score,
// pour que 2-1 et 1-2 soient comptés comme la même monotonie.
const forme=(b)=>`${Math.max(b[0],b[1])}-${Math.min(b[0],b[1])}`;

const parAnalyse=new Map(), parRencontre=new Map(), reels=new Map();
const vus=new Set();
for(const l of lignes){
  const b=lire(l.score); if(!b) continue;
  const f=forme(b);
  parAnalyse.set(f,(parAnalyse.get(f)??0)+1);
  const cle=String(l.fixture_id ?? `${l.team1_name}|${l.team2_name}`);
  if(!vus.has(cle)){ vus.add(cle); parRencontre.set(f,(parRencontre.get(f)??0)+1); }
  const r=lire(l.real_score);
  if(r && !reels.has(cle+'#r')){ reels.set(cle+'#r',1); reels.set(forme(r),(reels.get(forme(r))??0)+1); }
}

const tableau=(m,titre,total)=>{
  console.log(`  ${titre}  (${total})`);
  const top=[...m.entries()].filter(([k])=>/^\d+-\d+$/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,10);
  for(const [k,n] of top){
    const pct=Math.round(n/total*1000)/10;
    console.log(`     ${k.padEnd(6)} ${String(n).padStart(6)}   ${String(pct).padStart(5)} %  ${'█'.repeat(Math.round(pct/2))}`);
  }
  console.log('');
};

const totA=[...parAnalyse.values()].reduce((a,b)=>a+b,0);
const totR=[...parRencontre.values()].reduce((a,b)=>a+b,0);
const totRe=[...reels.entries()].filter(([k])=>/^\d+-\d+$/.test(k)).reduce((a,b)=>a+b[1],0);

tableau(parAnalyse,'SCORES ANNONCÉS — par analyse',totA);
tableau(parRencontre,'SCORES ANNONCÉS — une rencontre = une voix',totR);
tableau(reels,'SCORES RÉELS observés sur ces mêmes rencontres',totRe);

const distinctes=[...parRencontre.keys()].length;
console.log(`  Formes de score distinctes annoncées : ${distinctes}`);
console.log(`  Formes de score distinctes réellement observées : ${[...reels.keys()].filter(k=>/^\d+-\d+$/.test(k)).length}`);
