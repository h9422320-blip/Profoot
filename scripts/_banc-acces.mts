/** Pose ou retire l'accès de test sur le compte interne. Jamais un client. */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const MARQUE = 'BANC-ESSAI-INTERNE';

let id: string | null = null;
for (let page = 1; page <= 12 && !id; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (!data?.users?.length) break;
  id = data.users.find((u: any) => String(u.email).toLowerCase() === 'ui.test@profoot-test.com')?.id ?? null;
  if (data.users.length < 1000) break;
}
if (!id) throw new Error('compte de test introuvable');

if (process.argv[2] === 'poser') {
  const { error } = await sb.from('subscriptions').insert({
    user_id: id, plan: 'monthly', status: 'active', amount: 0, currency: 'XOF',
    provider: 'banc-essai', chariow_sale_id: MARQUE,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  console.log(error ? `ÉCHEC : ${error.message}` : 'accès de test POSÉ');
} else {
  const { error } = await sb.from('subscriptions').delete().eq('chariow_sale_id', MARQUE);
  console.log(error ? `ÉCHEC : ${error.message}` : 'accès de test RETIRÉ');
}
const { data: reste } = await sb.from('subscriptions').select('id, provider, chariow_sale_id').eq('user_id', id);
console.log(`   il reste ${reste?.length ?? 0} abonnement(s) sur ce compte :`, JSON.stringify(reste));
