/**
 * ASSAINIT LE VOCABULAIRE DES ANALYSES DÉJÀ ENREGISTRÉES.
 *
 *     node scripts/nettoyer-analyses.mjs             → blanc, n'écrit rien
 *     node scripts/nettoyer-analyses.mjs --appliquer → écrit
 *
 * Le correctif de code protège les analyses À VENIR. Celles déjà en base
 * restent affichées dans l'historique de chaque abonné : un correctif seul les
 * laisserait fautives pour toujours. Même leçon que le mur de preuves.
 */
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
const { assainirAnalyse, contientVocabulaireInterdit } = await jiti.import('./src/lib/filtre-vocabulaire.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const APPLIQUER = process.argv.includes('--appliquer');
const PLAFOND = Number(process.argv.find(a=>/^--max=/.test(a))?.split('=')[1] ?? 100000);

const lignes=[];
for(let de=0; de<PLAFOND; de+=1000){
  const { data, error } = await sb.from('analysis_history')
    .select('id, analysis_data').order('created_at',{ascending:false}).range(de, de+Math.min(999, PLAFOND-de-1));
  if(error){ console.log('  erreur : '+error.message); break; }
  if(!data?.length) break;
  lignes.push(...data);
  if(data.length<1000) break;
}
console.log(`\n  ${lignes.length} analyses lues.\n`);

let touchees=0, champs=0, restantes=0;
const mots=new Map(); const exemples=[];
for(const l of lignes){
  const avant = JSON.stringify(l.analysis_data);
  const copie = JSON.parse(avant);
  const r = assainirAnalyse(copie);
  if(!r.champsNettoyes) continue;
  touchees++; champs += r.champsNettoyes;
  for(const m of r.motsRetires) mots.set(m,(mots.get(m)??0)+1);

  // Garde-fou : plus aucun mot fautif ne doit subsister dans la prose.
  if (contientVocabulaireInterdit(String(copie.quickSummary ?? ''))) restantes++;

  if(exemples.length<4){
    const a = JSON.parse(avant);
    const champ = ['quickSummary'].find(c=>a[c]!==copie[c])
      ?? (a.sections?.findIndex((s,i)=>s?.content!==copie.sections?.[i]?.content) >= 0 ? 'sections' : null);
    if(champ==='quickSummary') exemples.push([a.quickSummary, copie.quickSummary]);
    else if(champ==='sections'){
      const i=a.sections.findIndex((s,i)=>s?.content!==copie.sections?.[i]?.content);
      exemples.push([a.sections[i].content, copie.sections[i].content]);
    }
  }

  if(APPLIQUER){
    const { error } = await sb.from('analysis_history').update({ analysis_data: copie }).eq('id', l.id);
    if(error) console.log('   ERREUR sur '+l.id+' : '+error.message);
  }
}

console.log(`  ${touchees} analyse(s) à nettoyer, ${champs} champ(s) au total.`);
console.log(`  Mots concernés : ${[...mots.entries()].sort((a,b)=>b[1]-a[1]).map(([m,n])=>`${m} (${n})`).join(', ')}`);
console.log(`  Fautives APRÈS nettoyage : ${restantes}\n`);
for(const [a,b] of exemples){
  console.log(`   AVANT : …${String(a).slice(0,150)}…`);
  console.log(`   APRÈS : …${String(b).slice(0,150)}…\n`);
}
console.log(APPLIQUER ? '  ÉCRIT EN BASE.\n' : "  BLANC — rien n'a été écrit. Relancer avec --appliquer.\n");
