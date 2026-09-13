import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const EMAIL = 'jeanenergienike@gmail.com';

const { data: pi } = await sb.from('payment_intents').select('*').eq('email', EMAIL).order('created_at');
console.log(`── PAIEMENTS SOUS ${EMAIL} : ${pi?.length ?? 0}`);
for (const p of (pi ?? []) as any[])
  console.log(`   ${String(p.created_at).slice(0, 19).replace('T', ' ')}  ${p.amount}F  ${p.plan}  boutique ${p.statut_boutique}  ` +
    `compte ${p.user_id ?? 'AUCUN'}  consommée ${p.consumed_at ? String(p.consumed_at).slice(0, 19).replace('T', ' ') : 'NON'}  vente ${p.sale_id}  ${p.moyen_paiement ?? ''}`);

// Le compte existe-t-il ?
let trouve: any = null;
for (let page = 1; page <= 12 && !trouve; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (!data?.users?.length) break;
  trouve = data.users.find((u: any) => String(u.email ?? '').toLowerCase() === EMAIL) ?? null;
  const proches = data.users.filter((u: any) => /jeanenergi|energienike/i.test(String(u.email ?? '')));
  for (const p of proches) console.log(`   compte proche : ${p.email}  créé ${String(p.created_at).slice(0, 16).replace('T', ' ')}  dernière connexion ${p.last_sign_in_at ? String(p.last_sign_in_at).slice(0, 16).replace('T', ' ') : 'JAMAIS'}`);
  if (data.users.length < 1000) break;
}
console.log(`\n── COMPTE ${EMAIL} : ${trouve ? `EXISTE (${trouve.id}) créé ${String(trouve.created_at).slice(0, 16).replace('T', ' ')}` : 'AUCUN'}`);

if (trouve) {
  const { data: abos } = await sb.from('subscriptions').select('*').eq('user_id', trouve.id);
  console.log(`   abonnements : ${abos?.length ?? 0}`);
  for (const a of (abos ?? []) as any[])
    console.log(`      ${String(a.created_at).slice(0, 16).replace('T', ' ')}  ${a.amount}F  ${a.plan}  ${a.status}  expire ${String(a.expires_at).slice(0, 10)}`);
}
