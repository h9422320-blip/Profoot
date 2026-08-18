/**
 * TOUT PAYEUR A-T-IL SON ACCÈS ?
 *
 * POURQUOI ON NE S'APPUIE PLUS SUR LA LISTE DES VENTES CHARIOW
 *
 * L'API de la boutique ne rend que dix ventes quelle que soit la pagination
 * demandée. S'en servir comme référence faisait conclure « zéro paiement
 * aujourd'hui » alors que des abonnements s'ouvraient à la minute. Une mesure
 * fausse est pire qu'une absence de mesure.
 *
 * La source de vérité est donc NOTRE trace : `payment_intents.consumed_at` est
 * horodaté au moment exact où l'accès est ouvert, et `subscriptions` dit ce que
 * le compte possède réellement. Ces deux tables sont écrites par notre code, à
 * partir du webhook de la boutique.
 *
 * Lecture seule.
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

const { data: intents } = await sb
  .from('payment_intents')
  .select('sale_id, user_id, plan, email, amount, created_at, consumed_at')
  .order('created_at', { ascending: false })
  .limit(1000);

const { data: abos } = await sb
  .from('subscriptions')
  .select('user_id, plan, status, amount, created_at, expires_at')
  .order('created_at', { ascending: false });

const actifs = new Map();
for (const a of abos ?? []) {
  if (a.status !== 'active') continue;
  if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) continue;
  if (!actifs.has(a.user_id)) actifs.set(a.user_id, a);
}

// ── 1. Les accès réellement ouverts (notre trace) ───────────────────────────
const ouverts = (intents ?? []).filter((i) => i.consumed_at);
console.log(`=============== ACCÈS OUVERTS : ${ouverts.length} ===============`);
let sansAbonnement = 0;
for (const i of ouverts.slice(0, 20)) {
  const a = actifs.get(i.user_id);
  const delai = Math.round((new Date(i.consumed_at) - new Date(i.created_at)) / 1000);
  if (!a) sansAbonnement++;
  console.log(
    `  ${a ? 'OK  ' : '!!! '} ${quand(i.created_at)}  ${String(i.amount).padStart(6)} F  ${String(i.plan).padEnd(18)} ${String(i.email).padEnd(34)} ` +
    (a ? `accès en ${delai} s, ${a.plan} jusqu'au ${quand(a.expires_at)}` : 'ACCÈS CONSOMMÉ MAIS AUCUN ABONNEMENT ACTIF')
  );
}
for (const i of ouverts.slice(20)) if (!actifs.get(i.user_id)) sansAbonnement++;
console.log(`\n  >>> Accès consommés sans abonnement actif : ${sansAbonnement} sur ${ouverts.length}`);

// ── 2. L'inverse : un abonnement sans trace de paiement ─────────────────────
const avecTrace = new Set(ouverts.map((i) => i.user_id));
const abonnesSansTrace = [...actifs.values()].filter((a) => !avecTrace.has(a.user_id));
console.log(`\n=============== ABONNEMENTS SANS TRACE DE PAIEMENT : ${abonnesSansTrace.length} ===============`);
for (const a of abonnesSansTrace.slice(0, 10)) {
  console.log(`  ${quand(a.created_at)}  ${String(a.amount).padStart(6)} F  ${a.plan}  ${a.user_id}`);
}

// ── 3. Aujourd'hui ──────────────────────────────────────────────────────────
const debut = new Date(); debut.setHours(0, 0, 0, 0);
const duJour = (intents ?? []).filter((i) => new Date(i.created_at) >= debut);
const ouvertsDuJour = duJour.filter((i) => i.consumed_at);
console.log(`\n=============== AUJOURD'HUI ===============`);
console.log(`  Checkouts lancés  : ${duJour.length}`);
console.log(`  Accès ouverts     : ${ouvertsDuJour.length}`);
console.log(`  Conversion        : ${duJour.length ? ((100 * ouvertsDuJour.length) / duJour.length).toFixed(1) : 0} %`);
console.log(`  Encaissé          : ${ouvertsDuJour.reduce((a, i) => a + (i.amount ?? 0), 0)} FCFA`);
const parPlan = new Map();
for (const i of ouvertsDuJour) parPlan.set(i.plan, (parPlan.get(i.plan) ?? 0) + 1);
for (const [p, n] of parPlan) console.log(`     ${String(p).padEnd(20)} ${n}`);

// ── 4. Le dernier acheteur à 2 000 F ────────────────────────────────────────
const dernier2000 = ouverts.find((i) => i.amount === 2000);
console.log(`\n=============== LE DERNIER ACHETEUR À 2 000 F ===============`);
if (!dernier2000) console.log('  aucun');
else {
  const a = actifs.get(dernier2000.user_id);
  console.log(`  ${dernier2000.email}`);
  console.log(`  Paiement lancé  : ${quand(dernier2000.created_at)}`);
  console.log(`  Accès ouvert    : ${quand(dernier2000.consumed_at)} (${Math.round((new Date(dernier2000.consumed_at) - new Date(dernier2000.created_at)) / 1000)} secondes après)`);
  console.log(`  Abonnement      : ${a ? `${a.plan}, ${a.status}, expire le ${quand(a.expires_at)}` : 'AUCUN — DÉFAUT'}`);
  const { count } = await sb.from('analysis_history').select('*', { count: 'exact', head: true }).eq('user_id', dernier2000.user_id);
  console.log(`  Analyses lancées depuis : ${count ?? 0}`);
}
