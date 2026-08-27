import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('cache_api').select('*').ilike('cle','acces:prevenu:%');
console.log('\n  colonnes :', Object.keys(data?.[0]??{}).join(', '), '\n');
for(const d of data??[]){
  const exp = d.expire_le ? Date.parse(d.expire_le) : null;
  const creee = exp ? new Date(exp - 10*365*24*3600*1000).toISOString().slice(0,16).replace('T',' ') : '?';
  console.log(`  ${d.cle}   envoyé vers ${creee} UTC`);
}
console.log('');
