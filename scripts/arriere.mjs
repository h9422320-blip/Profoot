import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { count: attente } = await sb.from('analysis_history').select('*',{count:'exact',head:true}).is('verified_at',null).not('fixture_id','is',null);
const { data: derniere } = await sb.from('analysis_history').select('verified_at').not('verified_at','is',null).order('verified_at',{ascending:false}).limit(1);
const { data: mur } = await sb.from('preuves').select('updated_at').order('updated_at',{ascending:false}).limit(1);
const { data: releve } = await sb.from('payment_intents').select('releve_le').not('releve_le','is',null).order('releve_le',{ascending:false}).limit(1);
const il = (d) => d ? Math.round((Date.now()-Date.parse(d))/36e5*10)/10 + ' h' : 'jamais';
console.log('');
console.log(`  analyses en attente de vérification ..... ${attente}`);
console.log(`  dernière vérification ................... il y a ${il(derniere?.[0]?.verified_at)}`);
console.log(`  dernière reconstruction du mur .......... il y a ${il(mur?.[0]?.updated_at)}`);
console.log(`  dernier relevé de paiement .............. il y a ${il(releve?.[0]?.releve_le)}`);
console.log('');
