/** Les accès rouverts aujourd'hui, avec de quoi écrire à chacun. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;

// Les abonnements créés aujourd'hui après 15h00 UTC = mes réparations.
const { data: abos } = await sb.from('subscriptions')
  .select('user_id, plan, expires_at, created_at, chariow_sale_id')
  .gt('created_at','2026-08-26T15:00:00Z')
  .order('created_at',{ascending:true});

const comptes = new Map();
for (let p=1;p<=30;p++){
  const { data } = await sb.auth.admin.listUsers({ page:p, perPage:1000 });
  if(!data?.users?.length) break;
  for(const u of data.users) comptes.set(u.id, u.email);
  if(data.users.length<1000) break;
}

console.log(`\n  ${abos?.length ?? 0} accès rouverts aujourd'hui après 15h00 UTC\n`);
for (const a of abos ?? []) {
  const email = comptes.get(a.user_id) ?? '(inconnu)';
  let vente = null;
  try {
    const r = await fetch(`https://api.chariow.com/v1/sales/${a.chariow_sale_id}`, { headers:{ Authorization:`Bearer ${cle}`, Accept:'application/json' } });
    vente = (await r.json())?.data;
  } catch {}
  const montant = vente?.amount?.value ?? vente?.amount ?? '?';
  const paye = String(vente?.completed_at ?? vente?.created_at ?? '').slice(0,16).replace('T',' ');
  const moyen = vente?.payment?.method?.name ?? '—';
  console.log(`  ${email}`);
  console.log(`     plan ....... ${a.plan}   expire ${String(a.expires_at).slice(0,10)}`);
  console.log(`     payé ....... ${paye} UTC   ${montant} FCFA   ${moyen}`);
  console.log(`     vente ...... ${a.chariow_sale_id}`);
  console.log('');
}
