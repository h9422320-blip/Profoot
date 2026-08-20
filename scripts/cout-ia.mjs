/** DIAGNOSTIC — combien d analyses pour combien de matchs distincts. LECTURE SEULE. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const depuis=new Date(Date.now()-7*86400000).toISOString();
const {data}=await sb.from('analysis_history').select('fixture_id, team1_name, team2_name, created_at').gte('created_at',depuis).limit(20000);
console.log(`\n  SUR 7 JOURS\n`);
console.log(`  Analyses lancees        : ${data.length}`);
const parJour=new Map();
for(const a of data){const j=String(a.created_at).slice(0,10);parJour.set(j,(parJour.get(j)??0)+1);}
const matchs=new Set(data.map(a=>a.fixture_id?`f${a.fixture_id}`:`${a.team1_name}|${a.team2_name}`.toLowerCase()));
console.log(`  Rencontres distinctes   : ${matchs.size}`);
console.log(`  Analyses par rencontre  : ${(data.length/matchs.size).toFixed(1)}`);
console.log(`\n  Par jour :`);
for(const [j,n] of [...parJour].sort().reverse()) console.log(`     ${j} : ${n}`);
// Les rencontres les plus analysees
const compte=new Map();
for(const a of data){const c=a.fixture_id?`${a.team1_name} - ${a.team2_name}`:'(sans id)';compte.set(c,(compte.get(c)??0)+1);}
console.log(`\n  Rencontres les plus analysees :`);
for(const [m,n] of [...compte].sort((x,y)=>y[1]-x[1]).slice(0,12)) console.log(`     ${String(n).padStart(4)} x  ${m}`);
console.log('');
