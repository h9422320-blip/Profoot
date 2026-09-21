import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tous: any[] = [];
for (let page = 1; page < 60; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  tous.push(...(data?.users ?? []));
  if (!data || data.users.length < 1000) break;
}
const debut = Date.parse('2026-09-19T09:30:00Z'), fin = Date.now();
const actifs = tous.filter((u) => {
  const t = Math.max(Date.parse(u.last_sign_in_at ?? 0), Date.parse(u.created_at ?? 0));
  return t >= debut && t <= fin;
});
const { data: intents } = await sb.from('payment_intents').select('*').gte('created_at', '2026-09-19T09:30:00Z').order('created_at');
console.log('intentions de paiement :'); for (const p of intents ?? []) console.log(' ', p.created_at.slice(11, 19), p.email, p.user_id, p.plan, p.statut_boutique, p.moyen_paiement, p.pays);
console.log('comptes actifs depuis 9 h 30 :');
for (const u of actifs) {
  const { data: abo } = await sb.from('subscriptions').select('plan,status').eq('user_id', u.id).eq('status', 'active');
  const { data: h } = await sb.from('analysis_history').select('created_at').eq('user_id', u.id).gte('created_at', '2026-09-19T09:00:00Z');
  console.log(`  ${u.email} · créé ${u.created_at.slice(0, 16)} · connecté ${String(u.last_sign_in_at).slice(0, 16)} · fournisseur ${u.app_metadata?.provider} · abonné ${abo?.length ? abo[0].plan : 'non'} · analyses aujourd'hui ${h?.length ?? 0}`);
}
