import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('\n  ══ LES DEUX LIGNES À 2 000 POUR UN PLAN À 15 000 ══\n');
const { data: abos } = await sb.from('subscriptions').select('*')
  .in('user_id', []).limit(0);
const { data: susp } = await sb.from('subscriptions').select('*')
  .eq('plan', 'vip_yearly').eq('amount', 2000);
for (const a of susp ?? []) {
  console.log(`  abonnement : plan=${a.plan} amount=${a.amount} ${a.currency} statut=${a.status} vente=${a.chariow_sale_id} le ${a.created_at}`);
  const { data: pi } = await sb.from('payment_intents').select('*').eq('sale_id', a.chariow_sale_id);
  for (const p of pi ?? [])
    console.log(`     intention  : plan=${p.plan} montant=${p.amount} statut_boutique=${p.statut_boutique} moyen=${p.moyen_paiement} email=${p.email} pays=${p.pays}`);
  if (!pi?.length) console.log('     intention  : AUCUNE trace dans payment_intents');
  console.log('');
}

// ── Les ventes Chariow relevées, payées, du 16 au 22 ───────────────────────
const DU = '2026-08-16T00:00:00.000Z', AU = '2026-08-23T00:00:00.000Z';
const { data: pi } = await sb.from('payment_intents').select('*')
  .gte('created_at', DU).lt('created_at', AU);

const parStatut = new Map();
for (const p of pi ?? []) {
  const k = String(p.statut_boutique ?? 'non relevé');
  const a = parStatut.get(k) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(p.amount ?? 0);
  parStatut.set(k, a);
}
console.log('  ══ LES INTENTIONS DE PAIEMENT, PAR STATUT BOUTIQUE ══\n');
for (const [k, a] of [...parStatut].sort((x, y) => y[1].n - x[1].n))
  console.log(`  ${k.padEnd(24)} ${String(a.n).padStart(4)} ligne(s)   ${String(a.xof).padStart(9)} FCFA`);

// ── Des ventes payées sans abonnement ? ────────────────────────────────────
const { data: tousAbos } = await sb.from('subscriptions').select('chariow_sale_id')
  .gte('created_at', DU).lt('created_at', AU);
const avecAbo = new Set((tousAbos ?? []).map((a) => a.chariow_sale_id));
const orphelines = (pi ?? []).filter((p) => p.consumed_at && !avecAbo.has(p.sale_id));
console.log(`\n  ${orphelines.length} vente(s) consommée(s) sans abonnement sur la période.`);
for (const o of orphelines.slice(0, 15))
  console.log(`     ${o.created_at?.slice(0,16)}  ${o.email}  ${o.plan}  ${o.amount}  ${o.statut_boutique}`);
console.log('');
