import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('analysis_history')
  .select('fixture_id, team1_name, team2_name, score, created_at')
  .ilike('team1_name','%levante%').ilike('team2_name','%betis%').limit(5);
const id = data?.[0]?.fixture_id;
console.log('\n  fixture_id =', id);
const r = await fetch('https://v3.football.api-sports.io/fixtures?id='+id, { headers:{'x-apisports-key':process.env.API_FOOTBALL_KEY} }).then(r=>r.json());
const f = r?.response?.[0];
if(!f){ console.log('  fiche introuvable'); process.exit(0); }
console.log(`  ${f.league.name}`);
console.log(`  date ..... ${f.fixture.date}`);
console.log(`  statut ... ${f.fixture.status.short} (${f.fixture.status.long})`);
console.log(`  score .... ${f.teams.home.name} ${f.goals.home} - ${f.goals.away} ${f.teams.away.name}`);
