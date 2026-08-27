import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('cache_api').select('cle, contenu, ecrit_le').eq('cle','pawapay:essai:encours').maybeSingle();
if(!data){ console.log('\n  aucun essai enregistré\n'); process.exit(0); }
const essais = typeof data.contenu === 'string' ? JSON.parse(data.contenu) : data.contenu;
console.log(`\n  ${essais.length} essais lancés le ${String(data.ecrit_le).slice(0,16).replace('T',' ')} UTC\n`);
for(const e of essais) console.log(`   ${String(e.nom).padEnd(20)} attendu ${String(e.attendu).padEnd(10)} ${e.depositId}`);
console.log('');
