/**
 * POURQUOI CHARIOW ET L'ADMINISTRATION NE COMPTENT PAS PAREIL.
 *
 * On aligne les deux sources sur la MÊME journée et le MÊME fuseau, puis on
 * nomme chaque vente présente d'un côté et absente de l'autre. Une différence
 * de total ne dit rien ; la liste des manquantes dit tout.
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

const JOUR = process.argv[2] || '2026-08-18';
const ENCAISSEES = ['completed', 'settled', 'paid', 'success'];

/** Le jour d'une date, vu sous plusieurs fuseaux — c'est là que ça dérape. */
function jourSous(iso, fuseau) {
  try {
    return new Intl.DateTimeFormat('fr-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(iso));
  } catch { return '?'; }
}
const heure = (iso, fuseau = 'UTC') =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// ── Toutes les ventes de la boutique ────────────────────────────────────────
const ventes = [];
let url = 'https://api.chariow.com/v1/sales?per_page=100';
for (let g = 0; g < 60 && url; g++) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' } });
  if (!r.ok) break;
  const j = await r.json();
  ventes.push(...(j?.data ?? []));
  url = j?.pagination?.next_page_url ?? null;
}

const payeesDuJour = ventes.filter(
  (v) => ENCAISSEES.includes(String(v.status).toLowerCase()) && jourSous(v.created_at, 'UTC') === JOUR
);

console.log(`\n=============== CHARIOW — VENTES ENCAISSÉES LE ${JOUR} ===============`);
console.log(`  ${ventes.length} ventes lues au total, ${payeesDuJour.length} encaissées ce jour-là (fuseau UTC)\n`);

// ── Nos traces et nos abonnements ───────────────────────────────────────────
const { data: intents } = await sb
  .from('payment_intents')
  .select('sale_id, user_id, email, amount, plan, created_at, consumed_at')
  .limit(3000);
const parVente = new Map((intents ?? []).map((i) => [i.sale_id, i]));

const { data: abos } = await sb
  .from('subscriptions')
  .select('user_id, plan, status, amount, created_at, expires_at')
  .order('created_at', { ascending: false });

const abosDuJour = (abos ?? []).filter((a) => jourSous(a.created_at, 'UTC') === JOUR);
const parUtilisateur = new Map();
for (const a of abos ?? []) if (!parUtilisateur.has(a.user_id)) parUtilisateur.set(a.user_id, a);

console.log('  heure UTC | statut     | montant | compte                              | abonnement ouvert ?');
const manquantes = [];
for (const v of payeesDuJour.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
  const cle = v.id ?? v.sale_id;
  const trace = parVente.get(cle);
  const email = v.customer?.email ?? v.email ?? trace?.email ?? '—';
  const montant = v.amount?.value ?? v.amount ?? '?';
  const abo = trace ? parUtilisateur.get(trace.user_id) : null;
  const compteDansAdmin = !!trace?.consumed_at && !!abo && jourSous(abo.created_at, 'UTC') === JOUR;
  if (!compteDansAdmin) manquantes.push({ v, trace, abo, email, montant });
  console.log(
    `  ${heure(v.created_at).padEnd(9)} | ${String(v.status).padEnd(10)} | ${String(montant).padStart(7)} | ${String(email).padEnd(35)} | ${compteDansAdmin ? 'oui' : 'NON'}`
  );
}

console.log(`\n=============== LES ${manquantes.length} QUI N'APPARAISSENT PAS ===============\n`);
for (const m of manquantes) {
  console.log(`  Vente ${m.v.id}`);
  console.log(`     heure Chariow (UTC)     : ${new Date(m.v.created_at).toISOString()}`);
  console.log(`     heure à Conakry (GMT)   : ${heure(m.v.created_at, 'Africa/Conakry')}`);
  console.log(`     statut boutique         : ${m.v.status}`);
  console.log(`     montant                 : ${m.montant} ${m.v.amount?.currency ?? ''}`);
  console.log(`     compte                  : ${m.email}`);
  console.log(`     trace payment_intents   : ${m.trace ? `oui (consommée ${m.trace.consumed_at ?? 'JAMAIS'})` : 'AUCUNE'}`);
  console.log(`     abonnement du compte    : ${m.abo ? `${m.abo.plan}, ${m.abo.status}, créé ${new Date(m.abo.created_at).toISOString()}` : 'AUCUN'}`);
  const estTest = /diagnostic-|devise-|cmp-|@profootai\.com/.test(String(m.email));
  console.log(`     session de test à moi   : ${estTest ? 'OUI — à exclure' : 'non, vraie vente'}`);
  console.log('');
}

// ── Le fuseau change-t-il le compte ? ───────────────────────────────────────
console.log('=============== EFFET DU FUSEAU HORAIRE ===============');
for (const fuseau of ['UTC', 'Africa/Conakry', 'Africa/Abidjan', 'Europe/Paris']) {
  const n = ventes.filter(
    (v) => ENCAISSEES.includes(String(v.status).toLowerCase()) && jourSous(v.created_at, fuseau) === JOUR
  ).length;
  console.log(`  ${fuseau.padEnd(18)} : ${n} ventes encaissées le ${JOUR}`);
}

console.log(`\n=============== CE QUE COMPTE L'ADMINISTRATION ===============`);
console.log(`  Abonnements créés le ${JOUR} (UTC) : ${abosDuJour.length}`);
for (const a of abosDuJour.sort((x, y) => new Date(x.created_at) - new Date(y.created_at))) {
  console.log(`     ${heure(a.created_at)}  ${String(a.amount).padStart(6)} F  ${a.plan.padEnd(18)} ${a.status}`);
}
