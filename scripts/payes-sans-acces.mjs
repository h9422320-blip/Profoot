/**
 * QUI A PAYÉ SANS RECEVOIR SON ACCÈS ?
 *
 * On confronte chaque vente encaissée chez Chariow aux abonnements en base.
 * RIEN N'EST ÉCRIT : ce script regarde et rend compte.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── 1. Toutes les ventes encaissées de la boutique ────────────────────────
const ventes = [];
let url = 'https://api.chariow.com/v1/sales?per_page=100';
for (let p = 0; p < 60 && url; p++) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (Array.isArray(d?.data)) ventes.push(...d.data);
  let s = d?.pagination?.next_page_url ?? null;
  if (s) { const u = new URL(s); u.searchParams.set('per_page', '100'); s = u.toString(); }
  url = s;
}
const payees = ventes.filter((v) => ['completed', 'settled'].includes(String(v.status)));
console.log(`\n  ${ventes.length} vente(s) lues — ${payees.length} encaissée(s).\n`);

// ── 2. Les abonnements en base ────────────────────────────────────────────
const abos = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('*').range(de, de + 999);
  if (!data?.length) break; abos.push(...data); if (data.length < 1000) break;
}
const parVente = new Map(abos.filter((a) => a.chariow_sale_id).map((a) => [a.chariow_sale_id, a]));

// ── 3. Les comptes, pour retrouver qui est qui ────────────────────────────
const comptes = [];
for (let page = 1; page <= 30; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error || !data?.users?.length) break;
  comptes.push(...data.users);
  if (data.users.length < 1000) break;
}
const parEmail = new Map(comptes.map((u) => [String(u.email ?? '').toLowerCase().trim(), u]));
console.log(`  ${abos.length} abonnement(s) en base, ${comptes.length} compte(s) inscrits.\n`);

// ── 4. Les intentions de paiement, autre piste pour l'e-mail ──────────────
const intents = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('sale_id, email, user_id, plan').range(de, de + 999);
  if (!data?.length) break; intents.push(...data); if (data.length < 1000) break;
}
const intentParVente = new Map(intents.map((i) => [i.sale_id, i]));

// ── 5. Confrontation ──────────────────────────────────────────────────────
const orphelines = [];
for (const v of payees) {
  if (parVente.has(v.id)) continue;
  const it = intentParVente.get(v.id);
  const email = String(
    it?.email ?? v.customer?.email ?? v.buyer?.email ?? ''
  ).toLowerCase().trim();
  const compte = email ? parEmail.get(email) : null;

  // Un compte peut avoir un abonnement actif venu d'une AUTRE vente.
  const dejaAbonne = compte
    ? abos.some((a) => a.user_id === compte.id && a.status === 'active' &&
        (!a.expires_at || new Date(a.expires_at) > new Date()))
    : false;

  orphelines.push({
    id: v.id,
    date: String(v.completed_at ?? v.created_at).slice(0, 16).replace('T', ' '),
    montant: Number(v.amount?.value ?? 0),
    produit: v.product?.name ?? '—',
    email: email || '(inconnu)',
    userId: compte?.id ?? null,
    dejaAbonne,
  });
}

console.log(`  ══ ${orphelines.length} VENTE(S) ENCAISSÉE(S) SANS ABONNEMENT RATTACHÉ ══\n`);
if (!orphelines.length) console.log('  Aucune. Tout le monde a reçu son accès.\n');
else {
  console.log(`  date              montant  produit                          email                          compte`);
  for (const o of orphelines.sort((a, b) => a.date.localeCompare(b.date)))
    console.log(
      `  ${o.date}  ${String(o.montant).padStart(6)}  ${String(o.produit).slice(0, 30).padEnd(31)} ` +
      `${o.email.slice(0, 30).padEnd(31)}` +
      (o.dejaAbonne ? 'déjà abonné (autre vente)' : o.userId ? 'INSCRIT — accès à ouvrir' : 'PAS DE COMPTE')
    );
  const aOuvrir = orphelines.filter((o) => o.userId && !o.dejaAbonne);
  const sansCompte = orphelines.filter((o) => !o.userId);
  console.log(`\n  À ouvrir tout de suite : ${aOuvrir.length}`);
  console.log(`  Sans compte inscrit    : ${sansCompte.length}`);
  console.log(`  Déjà couverts          : ${orphelines.filter((o) => o.dejaAbonne).length}\n`);
  fs.writeFileSync('scratch-orphelines.json', JSON.stringify(orphelines, null, 1));
}
