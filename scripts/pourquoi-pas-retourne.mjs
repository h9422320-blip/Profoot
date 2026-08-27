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
const { lirePredictionBrute } = await jiti.import('./src/lib/prediction-figee.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const { data: cartes } = await sb.from('preuves').select('id, fixture_id, team1_name, team2_name, updated_at').ilike('team1_name','%Bodo%');
console.log(`\n  ${cartes.length} carte(s) « Bodo » sur le mur :`);
for(const c of cartes) console.log(`     #${c.id} fixture=${c.fixture_id}  ${c.team1_name} — ${c.team2_name}   maj=${c.updated_at}`);

for(const c of cartes){
  const { data: lignes } = await sb.from('predictions_match').select('domicile_nom, buts_domicile, buts_exterieur, calculee_le').eq('fixture_id', c.fixture_id);
  console.log(`\n  predictions_match pour ${c.fixture_id} : ${lignes.length} ligne(s)`);
  for(const l of lignes) console.log(`     domicile=${l.domicile_nom}  ${l.buts_domicile}-${l.buts_exterieur}  ${l.calculee_le}`);
  console.log('  lirePredictionBrute rend :', await lirePredictionBrute(c.fixture_id));
}

// Combien de fixtures portent PLUSIEURS predictions figees ?
const { data: toutes } = await sb.from('predictions_match').select('fixture_id');
const compte = new Map();
for(const t of toutes) compte.set(t.fixture_id,(compte.get(t.fixture_id)??0)+1);
const doublons=[...compte.entries()].filter(([,n])=>n>1);
console.log(`\n  Fixtures avec PLUSIEURS predictions figees : ${doublons.length} sur ${compte.size}`);
