import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const PRIX={essential_monthly:2000,pro_monthly:5000,vip_yearly:15000};
const ALIAS={monthly:'pro_monthly',yearly:'vip_yearly',lifetime:'vip_yearly'};
const prixDe=p=>PRIX[ALIAS[p]??p]??0;
const {data}=await sb.from('subscriptions').select('plan, created_at').gte('created_at','2026-08-16').lt('created_at','2026-08-17').order('created_at');
const COMMIT=new Date('2026-08-16T12:34:42Z');
let avant=0,apres=0,nAvant=0,nApres=0;
for(const s of data??[]){const p=prixDe(s.plan);if(new Date(s.created_at)<COMMIT){avant+=p;nAvant++;}else{apres+=p;nApres++;}}
console.log(`\n  JOURNEE DU 16 AOUT — de part et d autre du commit de 12h34\n`);
console.log(`  Avant 12h34 : ${nAvant} vente(s) = ${avant.toLocaleString('fr-FR')} FCFA  (35 % = ${Math.round(avant*0.35).toLocaleString('fr-FR')})`);
console.log(`  Apres 12h34 : ${nApres} vente(s) = ${apres.toLocaleString('fr-FR')} FCFA`);
console.log(`  Total du 16 : ${(data??[]).length} vente(s) = ${(avant+apres).toLocaleString('fr-FR')} FCFA\n`);
