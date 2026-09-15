/**
 * POSE OU RETIRE L'ACCÈS DE TEST INTERNE, ET RIEN D'AUTRE.
 *
 * Sert à constater un comportement d'abonné sans jamais emprunter le compte
 * d'un acheteur. La ligne est marquée `provider: 'banc-essai'` et
 * `chariow_sale_id: 'BANC-ESSAI-INTERNE'` : impossible de la confondre avec
 * une vraie vente, et le retrait vérifie qu'il ne reste plus rien.
 *
 *   npx tsx scripts/_acces-de-test.mts poser
 *   npx tsx scripts/_acces-de-test.mts retirer
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

const EMAIL = 'ui.test@profoot-test.com';
const MARQUE = 'BANC-ESSAI-INTERNE';

const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const action = String(process.argv[2] ?? '').toLowerCase();
if (action !== 'poser' && action !== 'retirer') {
  console.log('usage : npx tsx scripts/_acces-de-test.mts poser | retirer');
  process.exit(1);
}

// Retrouver le compte de test, et LUI SEUL.
const { data: liste, error: e1 } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (e1) throw new Error(e1.message);
const compte = (liste?.users ?? []).find((u: any) => String(u.email).toLowerCase() === EMAIL);
if (!compte) throw new Error(`compte de test ${EMAIL} introuvable`);

if (action === 'poser') {
  const expire = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('subscriptions').upsert(
    {
      user_id: compte.id,
      plan: 'pro',
      status: 'active',
      provider: 'banc-essai',
      chariow_sale_id: MARQUE,
      amount: 0,
      currency: 'XOF',
      expires_at: expire,
    },
    { onConflict: 'chariow_sale_id', ignoreDuplicates: false }
  );
  if (error) throw new Error(error.message);
  console.log(`accès de test posé sur ${EMAIL}, il expire de lui-même à ${expire}`);
} else {
  const { error } = await sb.from('subscriptions').delete().eq('chariow_sale_id', MARQUE);
  if (error) throw new Error(error.message);
}

// Dans les DEUX cas, on dit ce qui reste. Un accès de test oublié fausserait
// tous les comptages.
const { data: reste } = await sb
  .from('subscriptions')
  .select('id, plan, status, provider, expires_at')
  .eq('user_id', compte.id);
console.log(`lignes d'abonnement sur le compte de test : ${(reste ?? []).length}`);
for (const r of reste ?? []) console.log('   ', JSON.stringify(r));

const { data: ailleurs } = await sb
  .from('subscriptions')
  .select('id, user_id')
  .eq('provider', 'banc-essai');
console.log(`lignes « banc-essai » restantes dans toute la base : ${(ailleurs ?? []).length}`);
