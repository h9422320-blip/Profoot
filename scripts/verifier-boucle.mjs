/** La boucle a-t-elle bien ecrit en base ? LECTURE SEULE. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});

const {count:nj}=await sb.from('jugements_moteur').select('*',{count:'exact',head:true});
const {count:nc}=await sb.from('calibrage_ligue').select('*',{count:'exact',head:true});
console.log(`\n  jugements_moteur : ${nj} rencontre(s) jugee(s)`);
console.log(`  calibrage_ligue  : ${nc} championnat(s) suivi(s)\n`);

const {data:top}=await sb.from('calibrage_ligue').select('*').order('matchs_observes',{ascending:false}).limit(6);
console.log(`  ${'championnat'.padEnd(32)} ${'n'.padStart(4)}  ${'facteur'.padStart(8)}  ${'justesse'.padStart(9)}  ${'Brier'.padStart(6)}  applique`);
console.log('  '+'-'.repeat(82));
for(const c of top??[])
  console.log(`  ${String(c.ligue).slice(0,31).padEnd(32)} ${String(c.matchs_observes).padStart(4)}  ${Number(c.facteur_buts).toFixed(3).padStart(8)}  ${(c.justesse+' %').padStart(9)}  ${Number(c.brier).toFixed(3).padStart(6)}  ${c.matchs_observes>=30?'OUI':'pas encore'}`);

const {data:ex}=await sb.from('jugements_moteur').select('*').eq('score_exact',true).limit(4);
console.log(`\n  Scores exacts enregistres :`);
for(const j of ex??[])
  console.log(`     ${j.equipe_domicile} ${j.buts_prevus_domicile}-${j.buts_prevus_exterieur} ${j.equipe_exterieur}  =  reel ${j.buts_reels_domicile}-${j.buts_reels_exterieur}   (${j.ligue})`);
console.log('');
