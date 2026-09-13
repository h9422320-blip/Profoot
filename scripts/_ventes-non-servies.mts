import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data } = await sb.from('payment_intents').select('*').eq('sale_id', '98c85527-b1d3-400c-9c72-ce17cbea18f3');
console.log('── LE CAS DU JOUR, EN ENTIER');
console.log(JSON.stringify((data ?? [])[0], null, 2));

// Combien de ventes portent le marqueur « acces_non_ouvert » ?
const { data: marquees } = await sb.from('payment_intents')
  .select('sale_id, email, plan, amount, created_at, cause_echec, statut_boutique, user_id, consumed_at')
  .eq('cause_echec', 'acces_non_ouvert').order('created_at', { ascending: false }).limit(40);
console.log(`\n── VENTES MARQUÉES « acces_non_ouvert » : ${marquees?.length ?? 0}`);
for (const m of (marquees ?? []) as any[])
  console.log(`   ${String(m.created_at).slice(0, 16).replace('T', ' ')}  ${String(m.amount).padStart(6)}F  ${String(m.plan ?? '?').padEnd(18)} ${m.email}  compte ${m.user_id ?? 'AUCUN'}  consommée ${m.consumed_at ? 'oui' : 'non'}`);

// Et toutes les ventes payées sans abonnement correspondant, tous marqueurs confondus.
const intentions: any[] = [];
for (let de = 0; de < 6000; de += 1000) {
  const { data: p } = await sb.from('payment_intents').select('sale_id, email, plan, amount, created_at, cause_echec, statut_boutique, user_id').range(de, de + 999);
  if (!p?.length) break; intentions.push(...p); if (p.length < 1000) break;
}
const abos: any[] = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data: a } = await sb.from('subscriptions').select('chariow_sale_id').range(de, de + 999);
  if (!a?.length) break; abos.push(...a); if (a.length < 1000) break;
}
const { data: m2 } = await sb.from('matchs_debloques').select('sale_id');
const servies = new Set([...abos.map((a) => String(a.chariow_sale_id)), ...((m2 ?? []) as any[]).map((x) => String(x.sale_id))]);
const orphelines = intentions.filter((i) => Number(i.amount) > 0 && !servies.has(String(i.sale_id)));
console.log(`\n── TOUTES LES VENTES PAYÉES SANS ACCÈS, DEPUIS L'ORIGINE : ${orphelines.length} sur ${intentions.length}`);
for (const o of orphelines.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 25))
  console.log(`   ${String(o.created_at).slice(0, 16).replace('T', ' ')}  ${String(o.amount).padStart(6)}F  ${String(o.plan ?? '?').padEnd(18)} ${String(o.email).padEnd(36)} boutique ${o.statut_boutique ?? '—'}  cause ${o.cause_echec ?? '—'}`);
