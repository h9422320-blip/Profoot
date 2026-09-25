import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const paiements: any[] = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('sale_id,email,plan,amount,created_at,statut_boutique').gte('created_at', new Date(Date.now() - 60 * 864e5).toISOString()).range(de, de + 999);
  paiements.push(...(data ?? [])); if (!data || data.length < 1000) break;
}
const abos: any[] = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('chariow_sale_id,user_id,expires_at,status').range(de, de + 999);
  abos.push(...(data ?? [])); if (!data || data.length < 1000) break;
}
const { data: matchs } = await sb.from('matchs_debloques').select('sale_id');
const servies = new Set([...abos.map((a) => a.chariow_sale_id), ...(matchs ?? []).map((m: any) => m.sale_id)].filter(Boolean));
const comptes: any[] = [];
for (let page = 1; page <= 30; page++) {
  const { data } = await (sb.auth.admin as any).listUsers({ page, perPage: 1000 });
  const u = data?.users ?? []; comptes.push(...u); if (u.length < 1000) break;
}
const parEmail = new Map(comptes.map((u: any) => [String(u.email).toLowerCase(), u]));
const { venteReglee } = await import('../src/lib/ventes-reglees.js');
for (const p of paiements) {
  if (!['completed', 'succeeded', 'paid', 'success'].includes(String(p.statut_boutique).toLowerCase())) continue;
  if (servies.has(p.sale_id) || venteReglee(p.sale_id)) continue;
  const u = parEmail.get(String(p.email).toLowerCase());
  if (!u) continue;
  const mesAbos = abos.filter((a) => a.user_id === u.id);
  console.log('À ROUVRIR :', String(p.created_at).slice(0, 16), p.email, p.plan, p.amount, '| vente', p.sale_id,
    '| abonnements du compte :', mesAbos.map((a) => `${a.status} → ${String(a.expires_at).slice(0, 10)}`).join(' · ') || 'aucun');
}
