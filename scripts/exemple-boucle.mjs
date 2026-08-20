/** Un exemple concret de la boucle : pronostic, resultat, ajustement. LECTURE SEULE. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:preds}=await sb.from('predictions_match').select('*').limit(2000);
const ids=preds.map(p=>p.fixture_id).filter(Boolean);
const fiches=new Map();
for(let i=0;i<ids.length;i+=20){
  const r=await fetch(`https://v3.football.api-sports.io/fixtures?ids=${ids.slice(i,i+20).join('-')}`,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY}});
  const j=await r.json();for(const f of j?.response??[])fiches.set(f.fixture.id,f);
}
const issue=(a,b)=>a>b?'domicile':a===b?'nul':'exterieur';
const finis=preds.map(p=>({p,f:fiches.get(p.fixture_id)})).filter(x=>x.f&&['FT','AET','PEN'].includes(x.f.fixture?.status?.short));
// Un championnat national, pour l exemple le plus parlant
const EST_COUPE=l=>/uefa|conmebol|concacaf|cup|coupe|copa|trophy|trophee|friendl/i.test(String(l??''));
const nat=finis.filter(x=>!EST_COUPE(x.f.league?.name));
console.log(`\n  ${nat.length} rencontre(s) de championnat national jugee(s)\n`);
for(const {p,f} of nat.slice(0,6)){
  const rd=f.goals.home, re=f.goals.away;
  const ip=issue(p.buts_domicile,p.buts_exterieur), ir=issue(rd,re);
  const nom={domicile:p.domicile_nom,nul:'nul',exterieur:p.exterieur_nom};
  console.log(`  ${f.league.name}  —  ${String(f.fixture.date).slice(0,10)}`);
  console.log(`     ${p.domicile_nom}  vs  ${p.exterieur_nom}`);
  console.log(`     pronostic : ${p.buts_domicile}-${p.buts_exterieur}  (${Math.round(p.proba_domicile)}/${Math.round(p.proba_nul)}/${Math.round(p.proba_exterieur)})  -> ${nom[ip]}`);
  console.log(`     resultat  : ${rd}-${re}  -> ${nom[ir]}`);
  console.log(`     verdict   : ${ip===ir?(p.buts_domicile===rd&&p.buts_exterieur===re?'JUSTE + SCORE EXACT':'JUSTE'):'FAUX'}`);
  console.log(`     buts annonces ${p.buts_domicile+p.buts_exterieur}, buts reels ${rd+re}\n`);
}
// L apprentissage sur un championnat
const parL=new Map();
for(const {p,f} of nat){const l=f.league.name;const a=parL.get(l)??{n:0,pd:0,pe:0,rd:0,re:0};a.n++;a.pd+=p.buts_domicile;a.pe+=p.buts_exterieur;a.rd+=f.goals.home;a.re+=f.goals.away;parL.set(l,a);}
console.log(`  ══ CE QUE LA BOUCLE RETIENDRAIT ══\n`);
for(const [l,a] of [...parL].sort((x,y)=>y[1].n-x[1].n).slice(0,5)){
  const fb=(a.rd+a.re)/((a.pd+a.pe)||1);
  console.log(`  ${l.padEnd(24)} ${a.n} match(s)  annonces ${a.pd+a.pe} buts, reels ${a.rd+a.re}  ->  facteur ${fb.toFixed(3)}  ${a.n>=30?'APPLIQUE':'en attente de 30 matchs'}`);
}
console.log('');
