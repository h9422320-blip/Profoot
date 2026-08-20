/** DIAGNOSTIC — reconstitution exacte du calcul partenaire. LECTURE SEULE. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim())
    .filter(l=>l&&!l.startsWith('#'))
    .map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const PRIX = { essential_monthly:2000, pro_monthly:5000, vip_yearly:15000 };
const ALIAS = { monthly:'pro_monthly', yearly:'vip_yearly', lifetime:'vip_yearly' };
const prixDe = p => PRIX[ALIAS[p] ?? p] ?? 0;

const { data } = await sb.from('subscriptions').select('plan, created_at').order('created_at');
const DEPART = new Date('2026-08-16T00:00:00.000Z');

let totalMois = 0, totalDepuisDepart = 0, inconnus = 0;
for (const s of data ?? []) {
  const prix = prixDe(s.plan);
  if (!prix) { inconnus++; continue; }
  if (String(s.created_at).slice(0,7) === '2026-08') totalMois += prix;
  if (new Date(s.created_at) >= DEPART) totalDepuisDepart += prix;
}
console.log(`\n  RECONSTITUTION DU CALCUL PARTENAIRE (source : subscriptions, prix catalogue)\n`);
console.log(`  Tout le mois d aout (1er au 20)      : ${totalMois.toLocaleString('fr-FR')} FCFA`);
console.log(`  Seulement a partir du 16 aout        : ${totalDepuisDepart.toLocaleString('fr-FR')} FCFA`);
console.log(`  Ecart (ventes du 1er au 15 aout)     : ${(totalMois-totalDepuisDepart).toLocaleString('fr-FR')} FCFA`);
console.log(`  Plans non reconnus (comptes 0)       : ${inconnus}`);
console.log(``);
console.log(`  35 % de ${totalMois.toLocaleString('fr-FR')} = ${Math.round(totalMois*0.35).toLocaleString('fr-FR')} FCFA`);
console.log(`  35 % de ${totalDepuisDepart.toLocaleString('fr-FR')} = ${Math.round(totalDepuisDepart*0.35).toLocaleString('fr-FR')} FCFA`);
console.log(``);
