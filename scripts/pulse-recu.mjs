import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('cache_api').select('contenu, ecrit_le').eq('cle','maketou:pulse:recus').maybeSingle();
if(!data){ console.log('\n  aucun message reçu pour l instant\n'); process.exit(0); }
const recus = typeof data.contenu === 'string' ? JSON.parse(data.contenu) : data.contenu;
console.log(`\n  ${recus.length} message(s) reçu(s). Le plus récent :\n`);
const r = recus[0];
console.log('  reçu le :', r.recuLe);
console.log('  url     :', r.url);
console.log('\n  ── EN-TÊTES ──');
for(const [k,v] of Object.entries(r.entetes ?? {})) console.log(`     ${k}: ${String(v).slice(0,120)}`);
console.log('\n  ── CORPS ──');
console.log(JSON.stringify(r.corps, null, 2));
