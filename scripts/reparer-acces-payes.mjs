/**
 * OUVRIR L'ACCÈS DE CEUX QUI ONT PAYÉ SANS LE RECEVOIR.
 *
 * On rejoue l'activation exactement comme le webhook l'aurait fait —
 * `activateSubscriptionFromSale`, la fonction de production. Pas une copie :
 * une copie appliquerait des règles de plan et de durée qui divergeraient.
 *
 * SIMULATION PAR DÉFAUT. Écrit seulement avec `--ecrire`.
 */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { activateSubscriptionFromSale } = await jiti.import('../src/lib/subscription-activation.ts');

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ECRIRE = process.argv.includes('--ecrire');

// Les ventes encaissées de la boutique.
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

// Ce qui existe déjà : abonnements ET matchs débloqués.
const abos = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('*').range(de, de + 999);
  if (!data?.length) break; abos.push(...data); if (data.length < 1000) break;
}
const { data: matchs } = await sb.from('matchs_debloques').select('sale_id');
const servies = new Set([
  ...abos.filter((a) => a.chariow_sale_id).map((a) => a.chariow_sale_id),
  ...(matchs ?? []).map((m) => m.sale_id),
]);

const comptes = [];
for (let page = 1; page <= 30; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (!data?.users?.length) break; comptes.push(...data.users);
  if (data.users.length < 1000) break;
}
const parEmail = new Map(comptes.map((u) => [String(u.email ?? '').toLowerCase().trim(), u]));

const intents = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('sale_id, email').range(de, de + 999);
  if (!data?.length) break; intents.push(...data); if (data.length < 1000) break;
}
const intentParVente = new Map(intents.map((i) => [i.sale_id, i]));

console.log(`\n  ${payees.length} vente(s) encaissée(s) — ${servies.size} déjà servie(s).\n`);
console.log(ECRIRE ? '  ══ RÉPARATION ══\n' : '  ══ SIMULATION — rien ne sera écrit ══\n');

let ouverts = 0, sansCompte = 0;
for (const v of payees) {
  if (servies.has(v.id)) continue;
  const email = String(intentParVente.get(v.id)?.email ?? v.customer?.email ?? v.buyer?.email ?? '')
    .toLowerCase().trim();
  const compte = email ? parEmail.get(email) : null;

  if (!compte) {
    sansCompte++;
    console.log(`  ⏳ ${email || '(e-mail inconnu)'} — ${v.amount?.value} FCFA le ${String(v.completed_at ?? v.created_at).slice(0,10)}`);
    console.log(`     Aucun compte à ce nom. L'accès s'ouvrira tout seul à l'inscription.\n`);
    continue;
  }

  if (!ECRIRE) {
    console.log(`  → ${email} : accès à ouvrir (vente ${v.id}, ${v.amount?.value} FCFA)`);
    ouverts++;
    continue;
  }

  const r = await activateSubscriptionFromSale(sb, v, compte.id);
  if (r.activated) {
    ouverts++;
    console.log(`  ✔ ${email} : accès ${r.plan} ouvert.`);
  } else {
    console.log(`  ✘ ${email} : ${r.reason}`);
  }
}

console.log(`\n  ${ouverts} accès ${ECRIRE ? 'ouvert(s)' : 'à ouvrir'} — ${sansCompte} en attente d'inscription.`);
if (!ECRIRE) console.log('  Relancez avec --ecrire pour appliquer.\n'); else console.log('');
