/**
 * LES MATCHS DU JOUR QUE L APPLICATION AVAIT ANALYSES.
 *
 * Pronostic de reference contre resultat reel, et etat sur le mur public.
 * Les grandes affiches d abord. LECTURE SEULE.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});

const JOUR=process.argv[2]||new Date().toISOString().slice(0,10);
const GRANDS=['barcelon','real madrid','paris saint','psg','manchester','liverpool','bayern','arsenal','chelsea','juventus','inter','milan','atletico','atlético','tottenham','dortmund','napoli','marseille','monaco','lyon','benfica','porto','ajax','sevilla','séville','lens','lille','nice','roma','lazio','valencia','betis','villarreal','leipzig','leverkusen','feyenoord','celtic','rangers','galatasaray','fenerbah','ajaccio','newcastle','aston villa','west ham','everton'];
const notoriete=(a,b)=>{const n=`${a} ${b}`.toLowerCase();return GRANDS.filter(g=>n.includes(g)).length;};
const issue=(a,b)=>a>b?'domicile':a===b?'nul':'exterieur';

// 1. Les predictions de reference
const {data:preds}=await sb.from('predictions_match').select('*').limit(3000);
const ids=preds.map(p=>p.fixture_id).filter(Boolean);

// 2. Les fiches reelles
const fiches=new Map();
for(let i=0;i<ids.length;i+=20){
  const r=await fetch(`https://v3.football.api-sports.io/fixtures?ids=${ids.slice(i,i+20).join('-')}`,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY}});
  const j=await r.json();for(const f of j?.response??[])fiches.set(f.fixture.id,f);
}

// 3. Le mur public
const {data:preuves}=await sb.from('preuves').select('*').in('fixture_id',ids);
const surMur=new Map((preuves??[]).map(p=>[p.fixture_id,p]));

// 4. Ceux joues AUJOURD HUI
const TERMINE=['FT','AET','PEN'];
const lignes=[];
for(const p of preds){
  const f=fiches.get(p.fixture_id);
  if(!f) continue;
  if(String(f.fixture?.date).slice(0,10)!==JOUR) continue;
  if(!TERMINE.includes(f.fixture?.status?.short)) continue;
  const rd=Number(f.goals?.home), re=Number(f.goals?.away);
  if(!Number.isFinite(rd)||!Number.isFinite(re)) continue;
  const ip=issue(p.buts_domicile,p.buts_exterieur), ir=issue(rd,re);
  const pr=surMur.get(p.fixture_id);
  lignes.push({
    dom:p.domicile_nom, ext:p.exterieur_nom, ligue:f.league?.name??'—',
    heure:String(f.fixture?.date).slice(11,16),
    prono:`${p.buts_domicile}-${p.buts_exterieur}`, reel:`${rd}-${re}`,
    probas:`${Math.round(p.proba_domicile)}/${Math.round(p.proba_nul)}/${Math.round(p.proba_exterieur)}`,
    conf:Math.round(p.confiance),
    juste:ip===ir, exact:ip===ir&&p.buts_domicile===rd&&p.buts_exterieur===re,
    publiee:!!pr?.publiee, enTable:!!pr, masquee:pr?.masquee_par_admin===true,
    grand:notoriete(p.domicile_nom,p.exterieur_nom),
  });
}

lignes.sort((a,b)=>(b.grand-a.grand)||(a.heure<b.heure?1:-1));

console.log(`\n  ══ MATCHS DU ${JOUR} ANALYSES PAR L APPLICATION ══\n`);
if(!lignes.length){console.log('  Aucun match analyse et termine sur cette date.\n');process.exit(0);}

for(const l of lignes){
  const v=l.juste?(l.exact?'JUSTE + SCORE EXACT':'JUSTE'):'FAUX';
  const pub=l.publiee?'PUBLIE sur le mur':l.enTable?(l.masquee?'retire a la main':'non publie'):'absent du mur';
  console.log(`  ${l.heure}  ${l.dom} — ${l.ext}${l.grand?'  '+'*'.repeat(Math.min(l.grand,2)):''}`);
  console.log(`        ${l.ligue}`);
  console.log(`        pronostic ${l.prono}  (${l.probas}, confiance ${l.conf}%)   ->   resultat ${l.reel}   =   ${v}`);
  console.log(`        ${pub}\n`);
}

const j=lignes.filter(l=>l.juste), e=lignes.filter(l=>l.exact);
console.log(`  ══ BILAN DU JOUR ══\n`);
console.log(`  Matchs joues et analyses : ${lignes.length}`);
console.log(`  Pronostics justes        : ${j.length}  (${((100*j.length)/lignes.length).toFixed(0)} %)`);
console.log(`  Dont scores exacts       : ${e.length}`);
console.log(`  Rates                    : ${lignes.length-j.length}`);
console.log(`  Justes publies sur le mur: ${j.filter(l=>l.publiee).length}/${j.length}`);
const manquants=j.filter(l=>!l.publiee);
if(manquants.length){
  console.log(`\n  ATTENTION — reussites absentes du mur :`);
  for(const l of manquants) console.log(`     ${l.dom} — ${l.ext}  (${l.prono} -> ${l.reel})  ${l.enTable?(l.masquee?'retiree a la main':'en table, non publiee'):'jamais entree en table'}`);
}
const aTort=lignes.filter(l=>!l.juste&&l.publiee);
if(aTort.length){
  console.log(`\n  ATTENTION — rates visibles en public :`);
  for(const l of aTort) console.log(`     ${l.dom} — ${l.ext}  (${l.prono} -> ${l.reel})`);
}
console.log('');
