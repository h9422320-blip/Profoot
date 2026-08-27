import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cibles = ['h9422320@gmail.com','m09997818@gmail.com'];
const ids = new Map();
for (let p=1;p<=30;p++){
  const { data } = await sb.auth.admin.listUsers({ page:p, perPage:1000 });
  if(!data?.users?.length) break;
  for(const u of data.users) if(cibles.includes(String(u.email).toLowerCase())) ids.set(u.id,u.email);
  if(data.users.length<1000) break;
}
console.log('\n  comptes trouves :', [...ids.values()].join(', ') || 'aucun');
const { data } = await sb.from('analysis_history')
  .select('user_id, team1_name, team2_name, score, predicted_winner, real_score, winner_correct, confidence, created_at')
  .in('user_id',[...ids.keys()])
  .or('team1_name.ilike.%betis%,team2_name.ilike.%betis%')
  .order('created_at',{ascending:true});
console.log(`\n  ${data?.length ?? 0} analyse(s) de Real Betis faite(s) depuis TES comptes :\n`);
for(const a of data ?? [])
  console.log(`   ${String(a.created_at).slice(0,16).replace('T',' ')}  ${String(a.team1_name).padEnd(18)} ${String(a.score??'—').padEnd(8)} ${String(a.team2_name).padEnd(18)} reel=${String(a.real_score??'—').padEnd(7)} juste=${a.winner_correct===null?'?':a.winner_correct?'OUI':'non'}  (${ids.get(a.user_id)})`);
