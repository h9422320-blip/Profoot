import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const JOUR = process.argv[2];
const { data: j } = await sb.from('precision_quotidienne').select('jour, releve_le').eq('jour', JOUR).maybeSingle();
const { data: v } = await sb.from('analysis_history').select('verified_at').gt('verified_at', JOUR+'T00:00:00Z').order('verified_at',{ascending:false}).limit(1);
const { count } = await sb.from('analysis_history').select('*',{count:'exact',head:true}).gt('verified_at', JOUR+'T00:00:00Z');
console.log(`journal ${JOUR} : ${j? 'PRESENT (releve '+String(j.releve_le).slice(11,19)+')' : 'absent'} | verifications depuis minuit : ${count ?? 0}`);
process.exit(j ? 0 : 3);
