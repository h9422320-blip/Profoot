import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('payment_intents').select('moyen_paiement, statut_boutique, cause_echec, pays').not('moyen_paiement','is',null);
console.log(`\n  ${data.length} intention(s) portent désormais un moyen de paiement.\n`);
const m=new Map(); for(const d of data) m.set(d.moyen_paiement,(m.get(d.moyen_paiement)??0)+1);
for(const [k,n] of [...m.entries()].sort((a,b)=>b[1]-a[1])) console.log(`     ${String(n).padStart(4)}  ${k}`);
