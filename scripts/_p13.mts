import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const email = 'p13057177@gmail.com';
const comptes: any[] = [];
for (let page = 1; page <= 30; page++) {
  const { data } = await (sb.auth.admin as any).listUsers({ page, perPage: 1000 });
  const u = data?.users ?? []; comptes.push(...u); if (u.length < 1000) break;
}
const u = comptes.find((x: any) => String(x.email).toLowerCase() === email);
const { data: pi } = await sb.from('payment_intents').select('sale_id,plan,amount,created_at,consumed_at,statut_boutique').eq('email', email).order('created_at');
const { data: abo } = await sb.from('subscriptions').select('id,plan,status,expires_at,created_at,chariow_sale_id,amount').eq('user_id', u.id).order('created_at');
console.log('compte', u.id, 'créé', String(u.created_at).slice(0, 16), '· dernière connexion', String(u.last_sign_in_at ?? '—').slice(0, 16));
for (const p of pi ?? []) console.log('paiement', String(p.created_at).slice(0, 16), p.plan, p.amount, p.statut_boutique, '| consommé', p.consumed_at ? String(p.consumed_at).slice(0, 16) : 'NON', '|', p.sale_id);
for (const a of abo ?? []) console.log('accès   ', a.plan, a.status, 'jusqu’au', String(a.expires_at).slice(0, 10), '| créé', String(a.created_at).slice(0, 16), '| vente', a.chariow_sale_id ?? '—', '|', a.amount);
