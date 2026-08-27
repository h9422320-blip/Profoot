/** Un courriel a-t-il DÉJÀ été envoyé par la production ? Lecture seule. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data, error } = await sb.from('cache_api').select('cle, expire_le').ilike('cle','acces:prevenu:%').limit(50);
if(error){ console.log('  erreur : '+error.message); process.exit(1); }
console.log(`\n  traces « client prévenu » trouvées : ${data.length}`);
for(const d of (data??[]).slice(0,10)) console.log(`     ${d.cle}`);
console.log('');
