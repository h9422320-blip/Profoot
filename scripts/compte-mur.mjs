import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('preuves').select('id, publiee, date_match, issue_correcte, score_exact');
const pub = (data??[]).filter(p=>p.publiee);
console.log(`  cartes : ${data.length}   publiées : ${pub.length}   scores exacts publiés : ${pub.filter(p=>p.score_exact).length}`);
const du26 = (data??[]).filter(p=>String(p.date_match??'').slice(0,10)==='2026-08-26');
console.log(`  cartes du 26 août : ${du26.length}   dont publiées : ${du26.filter(p=>p.publiee).length}`);
fs.writeFileSync('.avant-publication.json', JSON.stringify((data??[]).map(p=>p.id).sort()), 'utf8');
