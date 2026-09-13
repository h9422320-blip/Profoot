import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

// 1. Qui est le compte qui a reçu la vente « .col » ?
const { data: u } = await sb.auth.admin.getUserById('72c7742e-d5d3-46c0-82b6-665da14ae5f6');
console.log(`── La vente « ametienchristophe@gmail.col » est allée au compte : ${u?.user?.email}`);

// 2. Tous les paiements des trois derniers jours, et leur sort.
const { data: pi } = await sb.from('payment_intents').select('sale_id, email, plan, amount, created_at, consumed_at, user_id, statut_boutique')
  .gte('created_at', '2026-09-11T00:00:00Z').order('created_at');
const abos: any[] = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('chariow_sale_id').range(de, de + 999);
  if (!data?.length) break; abos.push(...data); if (data.length < 1000) break;
}
const servies = new Set(abos.map((a) => String(a.chariow_sale_id)));
const orphelines = ((pi ?? []) as any[]).filter((p) => Number(p.amount) > 0 && p.statut_boutique === 'completed' && !servies.has(String(p.sale_id)));
console.log(`\n── PAIEMENTS ENCAISSÉS ET NON SERVIS depuis le 11 : ${orphelines.length}`);
for (const o of orphelines)
  console.log(`   ${String(o.created_at).slice(0, 19).replace('T', ' ')}  ${o.amount}F  ${o.plan}  ${o.email}  compte ${o.user_id ?? 'AUCUN'}`);

// 3. Les comptes créés aujourd'hui, sans abonnement — combien de « nouveaux bloqués » ?
const { data: liste } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const aujourdhui = (liste?.users ?? []).filter((x: any) => String(x.created_at).slice(0, 10) === '2026-09-13');
console.log(`\n── COMPTES CRÉÉS AUJOURD'HUI : ${aujourdhui.length}`);
const ids = aujourdhui.map((x: any) => x.id);
const { data: leursAbos } = await sb.from('subscriptions').select('user_id').in('user_id', ids.slice(0, 300));
const avec = new Set(((leursAbos ?? []) as any[]).map((a) => a.user_id));
console.log(`   dont ${aujourdhui.filter((x: any) => avec.has(x.id)).length} avec un abonnement, ${aujourdhui.filter((x: any) => !avec.has(x.id)).length} sans.`);
