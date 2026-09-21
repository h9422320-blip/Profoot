// LECTURE SEULE : l'état d'un compte client, pour l'aider à se reconnecter.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const cible = String(process.argv[2] ?? '').toLowerCase();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const proches: any[] = [];
const racine = cible.split('@')[0].slice(0, 7);
for (let page = 1; page <= 40; page++) {
  let data: any = null;
  for (let essai = 1; essai <= 5 && !data; essai++) {
    try { const r = await sb.auth.admin.listUsers({ page, perPage: 1000 }); if (!r.error) data = r.data; } catch {}
    if (!data) await new Promise((t) => setTimeout(t, 2500 * essai));
  }
  if (!data) { console.log('lecture des comptes interrompue page', page); break; }
  for (const u of data.users) {
    const e = String(u.email ?? '').toLowerCase();
    if (e === cible || e.includes(racine)) proches.push(u);
  }
  if (data.users.length < 1000) break;
}
for (const u of proches) {
  const { data: abo } = await sb.from('subscriptions').select('plan, status, expires_at, provider').eq('user_id', u.id);
  console.log(`${u.email === cible ? '★' : ' '} ${u.email} · créé ${String(u.created_at).slice(0, 16)} · confirmé ${u.email_confirmed_at ? 'oui' : 'NON'} · dernière connexion ${String(u.last_sign_in_at ?? '—').slice(0, 16)} · fournisseur ${u.app_metadata?.provider} · bloqué ${u.banned_until ?? 'non'} · abonnements ${JSON.stringify(abo)}`);
}
const { data: v } = await sb.from('payment_intents').select('created_at, email, amount, plan, statut_boutique, sale_id').ilike('email', `%${racine}%`).order('created_at', { ascending: false }).limit(10);
for (const x of v ?? []) console.log('  paiement', String(x.created_at).slice(0, 16), x.email, x.amount, x.plan, x.statut_boutique, String(x.sale_id).slice(0, 8));
console.log(proches.length, 'compte(s) trouvé(s)');
