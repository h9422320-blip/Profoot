/** Lecture seule : on interroge la boutique sur des ventes togolaises. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;
const CHARIOW = 'https://api.chariow.com/v1';

const { data } = await sb.from('payment_intents').select('sale_id, pays, plan, consumed_at, created_at')
  .eq('pays','TG').order('created_at',{ascending:false}).limit(6);

console.log(`\n  ${data.length} ventes togolaises récentes interrogées.\n`);
for(const i of data){
  try{
    const r = await fetch(`${CHARIOW}/sales/${i.sale_id}`, { headers:{ Authorization:`Bearer ${cle}`, Accept:'application/json' } });
    const j = await r.json();
    const v = j?.data;
    console.log(`  ${String(i.created_at).slice(0,16).replace('T',' ')}  ${String(i.plan).padEnd(18)} HTTP ${r.status}`);
    if(!v){ console.log('      reponse :', JSON.stringify(j).slice(0,220)); continue; }
    console.log(`      statut ......... ${v.status}`);
    console.log(`      moyen .......... ${JSON.stringify(v.payment?.method ?? null)}`);
    console.log(`      echec .......... ${JSON.stringify(v.payment?.failure_error ?? null)}`);
    console.log(`      abonnement obtenu chez nous : ${i.consumed_at ? 'OUI' : 'non'}`);
  }catch(e){ console.log('   ERREUR : '+e.message); }
  console.log('');
}
