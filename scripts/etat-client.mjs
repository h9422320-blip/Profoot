import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cible = (process.argv[2] ?? '').toLowerCase();

let user = null;
for (let p = 1; p <= 30; p++) {
  const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 1000 });
  if (!data?.users?.length) break;
  const t = data.users.find(u => String(u.email).toLowerCase() === cible);
  if (t) { user = t; break; }
  if (data.users.length < 1000) break;
}
if (!user) { console.log(`\n  aucun compte pour ${cible}\n`); process.exit(0); }

console.log(`\n  COMPTE ${user.email}`);
console.log(`     inscrit le ......... ${String(user.created_at).slice(0,16).replace('T',' ')}`);
console.log(`     e-mail confirmé .... ${user.email_confirmed_at ? 'oui' : 'NON'}`);
console.log(`     dernière connexion . ${user.last_sign_in_at ? String(user.last_sign_in_at).slice(0,16).replace('T',' ') : 'jamais'}`);

const { data: abos } = await sb.from('subscriptions').select('*').eq('user_id', user.id).order('created_at',{ascending:false});
console.log(`\n  ABONNEMENTS : ${abos?.length ?? 0}`);
for (const a of abos ?? []) {
  const actif = !a.expires_at || Date.parse(a.expires_at) > Date.now();
  console.log(`     ${String(a.plan).padEnd(20)} créé ${String(a.created_at).slice(0,16).replace('T',' ')}   expire ${String(a.expires_at ?? '—').slice(0,10)}   ${actif ? 'ACTIF' : 'expiré'}`);
  console.log(`        vente : ${a.chariow_sale_id ?? '—'}`);
}

const { data: pi } = await sb.from('payment_intents').select('sale_id, plan, amount, pays, created_at, consumed_at, statut_boutique').eq('user_id', user.id).order('created_at',{ascending:false}).limit(6);
console.log(`\n  PAIEMENTS : ${pi?.length ?? 0}`);
for (const p of pi ?? [])
  console.log(`     ${String(p.created_at).slice(0,16).replace('T',' ')}  ${String(p.plan).padEnd(18)} ${String(p.amount).padStart(6)} ${p.pays}  ${p.consumed_at ? 'honoré' : 'NON honoré'}  ${p.statut_boutique ?? ''}`);

const { count } = await sb.from('analysis_history').select('*',{count:'exact',head:true}).eq('user_id', user.id);
console.log(`\n  analyses produites par ce compte : ${count}\n`);
