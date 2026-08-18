/**
 * QUELQU'UN A-T-IL PAYÉ SANS RECEVOIR SON ACCÈS ?
 *
 * LA SEULE FAÇON HONNÊTE DE RÉPONDRE
 *
 * Il faut partir des ventes ENCAISSÉES chez la boutique, et vérifier pour
 * chacune que l'accès s'est ouvert de notre côté. L'inverse — partir de nos
 * accès ouverts — ne peut pas répondre : quelqu'un dont l'accès n'a jamais été
 * ouvert ressemble en tout point à quelqu'un qui n'a jamais payé.
 *
 * L'API DE LA BOUTIQUE, TELLE QU'ELLE EST VRAIMENT
 *
 * Elle ne se pagine pas par numéro de page : `?page=2` est ignoré et renvoie
 * les dix mêmes ventes. Elle se pagine par CURSEUR, et la taille de page se
 * règle avec `per_page`, pas `limit`. S'être trompé là-dessus faisait conclure
 * « aucun paiement aujourd'hui » un jour où seize mille francs sont entrés.
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
const entete = { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' };

// ── Toutes les ventes, en suivant le curseur ────────────────────────────────
const ventes = [];
let url = 'https://api.chariow.com/v1/sales?per_page=100';
for (let garde = 0; garde < 60 && url; garde++) {
  const r = await fetch(url, { headers: entete });
  if (!r.ok) { console.log(`  arrêt : HTTP ${r.status}`); break; }
  const j = await r.json();
  ventes.push(...(j?.data ?? []));
  url = j?.pagination?.next_page_url ?? null;
}
console.log(`Ventes lues chez Chariow : ${ventes.length}`);

const parStatut = new Map();
for (const v of ventes) parStatut.set(v.status, (parStatut.get(v.status) ?? 0) + 1);
console.log('Répartition :');
for (const [s, n] of [...parStatut].sort((a, b) => b[1] - a[1])) console.log(`   ${String(s).padEnd(20)} ${n}`);

// ── Nos traces ──────────────────────────────────────────────────────────────
const { data: intents } = await sb
  .from('payment_intents')
  .select('sale_id, user_id, plan, email, amount, created_at, consumed_at')
  .limit(2000);
const parVente = new Map((intents ?? []).map((i) => [i.sale_id, i]));

const { data: abos } = await sb.from('subscriptions').select('user_id, plan, status, expires_at');
const actifs = new Map();
for (const a of abos ?? []) {
  if (a.status !== 'active') continue;
  if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) continue;
  actifs.set(a.user_id, a);
}

// ── LA question ─────────────────────────────────────────────────────────────
const ENCAISSEES = ['completed', 'settled', 'paid', 'success'];
const payees = ventes.filter((v) => ENCAISSEES.includes(String(v.status).toLowerCase()));

console.log(`\n=============== VENTES ENCAISSÉES : ${payees.length} ===============\n`);
const sansAcces = [];
const sansTrace = [];

for (const v of payees) {
  const cle = v.id ?? v.sale_id ?? v.reference;
  const trace = parVente.get(cle);
  const email = v.customer?.email ?? v.email ?? trace?.email ?? '—';
  const montant = v.amount?.value ?? v.amount ?? v.total ?? '?';

  if (!trace) { sansTrace.push({ v, email, montant }); continue; }
  const abo = actifs.get(trace.user_id);
  const ok = !!trace.consumed_at && !!abo;
  if (!ok) sansAcces.push({ v, trace, abo, email, montant });

  console.log(
    `  ${ok ? 'OK  ' : '!!! '} ${quand(v.created_at)}  ${String(montant).padStart(7)}  ${String(email).padEnd(34)} ` +
    (trace.consumed_at
      ? `accès ${quand(trace.consumed_at)}${abo ? '' : ' — MAIS AUCUN ABONNEMENT ACTIF'}`
      : 'ACCÈS JAMAIS OUVERT')
  );
}

console.log(`\n############################################################`);
console.log(`  VENTES ENCAISSÉES SANS ACCÈS      : ${sansAcces.length}`);
console.log(`  VENTES ENCAISSÉES SANS TRACE      : ${sansTrace.length}`);
console.log(`############################################################`);

for (const s of sansAcces) console.log(`   à réparer : ${s.email}  ${s.montant}  vente ${s.v.id}  ${quand(s.v.created_at)}`);
for (const s of sansTrace) console.log(`   sans trace : ${s.email}  ${s.montant}  vente ${s.v.id}  ${quand(s.v.created_at)}`);

if (!sansAcces.length && !sansTrace.length) {
  console.log('\n   => AUCUN PAYEUR N\'EST RESTÉ SANS ACCÈS.');
}
