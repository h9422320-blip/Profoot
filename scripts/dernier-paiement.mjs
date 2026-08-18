/**
 * LE DERNIER ACHETEUR A-T-IL REÇU SON ACCÈS ?
 *
 * On croise trois sources, dans cet ordre :
 *
 *   1. La boutique Chariow — la vente a-t-elle été encaissée ?
 *   2. `payment_intents` — notre propre trace, qui relie la vente à un compte.
 *   3. L'abonnement du compte — l'accès est-il réellement ouvert ?
 *
 * Lecture seule. Rien n'est modifié.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const quand = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

// ── 1. Nos traces de paiement, les plus récentes ────────────────────────────
const { data: intents, error: e1 } = await sb
  .from('payment_intents')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(12);

if (e1) { console.error('payment_intents illisible :', e1.message); process.exit(1); }

console.log('=============== DERNIÈRES TRACES DE PAIEMENT ===============');
if (!intents?.length) console.log('  aucune trace');
for (const i of intents ?? []) {
  const champs = Object.entries(i)
    .filter(([k]) => !['id'].includes(k))
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('  ');
  console.log(`\n  ${quand(i.created_at)}\n    ${champs}`);
}

// ── 2. Les ventes chez Chariow ──────────────────────────────────────────────
console.log('\n\n=============== VENTES CHEZ CHARIOW ===============');
try {
  const r = await fetch('https://api.chariow.com/v1/sales?limit=15', {
    headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' },
  });
  const j = await r.json();
  const ventes = j?.data ?? j?.sales ?? (Array.isArray(j) ? j : []);
  if (!ventes.length) console.log('  Réponse inattendue :', JSON.stringify(j).slice(0, 400));
  for (const v of ventes.slice(0, 10)) {
    console.log(
      `  ${quand(v.created_at ?? v.date)}  ${String(v.status ?? v.state ?? '?').padEnd(11)} ` +
      `${String(v.amount ?? v.total ?? '?').padStart(8)} ${v.currency ?? ''}  ` +
      `${v.customer?.email ?? v.email ?? v.customer_email ?? '—'}  ` +
      `produit ${v.product?.name ?? v.product_id ?? '—'}`
    );
  }
} catch (err) {
  console.log('  Chariow injoignable :', err.message);
}

// ── 3. Les abonnements ouverts les plus récents ─────────────────────────────
console.log('\n\n=============== ABONNEMENTS LES PLUS RÉCENTS ===============');
for (const table of ['subscriptions', 'abonnements', 'user_subscriptions']) {
  const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false }).limit(8);
  if (error) continue;
  console.log(`\n  table « ${table} » :`);
  for (const s of data ?? []) {
    console.log(`    ${quand(s.created_at)}  ${JSON.stringify(s).slice(0, 260)}`);
  }
  break;
}

// ── 4. Les derniers comptes créés ───────────────────────────────────────────
const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 8 });
console.log('\n\n=============== DERNIERS COMPTES CRÉÉS ===============');
for (const u of users?.users ?? []) {
  console.log(`  ${quand(u.created_at)}  ${u.email}  (dernière connexion ${quand(u.last_sign_in_at)})`);
}
