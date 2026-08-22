/**
 * DIAGNOSTIC — l'écart entre la recette affichée à l'administration et
 * l'argent réellement encaissé chez Chariow, du 16 au 22 août 2026.
 *
 * Rien n'est écrit. On regarde, on compte, on montre.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DU = '2026-08-16T00:00:00.000Z';
const AU = '2026-08-23T00:00:00.000Z';
const REEL_CHARIOW = 323000;

// Le prix catalogue, exactement comme `montantAbonnement()` le lit.
const CATALOGUE = { essential_monthly: 2000, pro_monthly: 5000, vip_yearly: 15000 };
const TAUX = { XOF: 1, EUR: 655.957, USD: 600 };

const { data: abos, error: eA } = await sb.from('subscriptions').select('*')
  .gte('created_at', DU).lt('created_at', AU).order('created_at');

if (eA) { console.log('ERREUR subscriptions :', JSON.stringify(eA)); process.exit(1); }
const { data: intents } = await sb.from('payment_intents').select('*')
  .gte('created_at', DU).lt('created_at', AU);

// L'e-mail : d'abord l'intention de paiement, sinon le compte.
const parSale = new Map((intents ?? []).map((i) => [i.sale_id, i]));
const ids = [...new Set(abos.map((a) => a.user_id))];
const emails = new Map();
for (let i = 0; i < ids.length; i += 50) {
  const { data } = await sb.from('user_profiles').select('id, email').in('id', ids.slice(i, i + 50));
  for (const u of data ?? []) emails.set(u.id, u.email);
}

console.log(`\n  ══ LES ${abos.length} ABONNEMENTS DU 16 AU 22 AOÛT 2026 ══\n`);
console.log(`  date       heure  email                          plan       statut    fourn.   CATALOGUE      RÉEL`);
console.log(`  ${'-'.repeat(106)}`);

let sommeCatalogue = 0, sommeReel = 0;
const vus = new Set();
const anomalies = [];

for (const a of abos) {
  const d = new Date(a.created_at);
  const jour = d.toISOString().slice(0, 10);
  const heure = d.toISOString().slice(11, 16);
  const email = parSale.get(a.chariow_sale_id)?.email ?? emails.get(a.user_id) ?? '—';

  const catalogue = CATALOGUE[a.plan] ?? 0;
  const reelBrut = Number(a.amount ?? 0);
  const devise = a.currency ?? 'XOF';
  const reelXof = Math.round(reelBrut * (TAUX[devise] ?? 0));

  // Ce que la page compte aujourd'hui : le catalogue, sans condition.
  sommeCatalogue += catalogue;

  const causes = [];
  if (a.status !== 'active') causes.push(`statut ${a.status}`);
  if (a.provider !== 'chariow') causes.push(`fournisseur ${a.provider ?? 'aucun'}`);
  if (!a.chariow_sale_id) causes.push('sans vente Chariow');
  if (a.chariow_sale_id && vus.has(a.chariow_sale_id)) causes.push('DOUBLON de vente');
  if (devise !== 'XOF') causes.push(`devise ${devise}`);
  if (reelXof !== catalogue) causes.push(`montant ${reelXof} ≠ catalogue ${catalogue}`);
  if (a.chariow_sale_id) vus.add(a.chariow_sale_id);

  // Le réel : encaissé seulement si la vente existe et que l'abonnement tient.
  const encaisse = a.provider === 'chariow' && a.chariow_sale_id && a.status === 'active'
    && !causes.includes('DOUBLON de vente') ? reelXof : 0;
  sommeReel += encaisse;

  if (causes.length) anomalies.push({ jour, heure, email, plan: a.plan, catalogue, encaisse, causes });

  console.log(
    `  ${jour} ${heure}  ${String(email).slice(0, 28).padEnd(29)} ${String(a.plan).slice(0,10).padEnd(10)} ` +
    `${String(a.status).padEnd(9)} ${String(a.provider ?? '—').padEnd(8)} ` +
    `${String(catalogue).padStart(8)}  ${String(encaisse).padStart(8)}` +
    (causes.length ? `   << ${causes.join(', ')}` : '')
  );
}

console.log(`  ${'-'.repeat(106)}`);
console.log(`  ${'TOTAL'.padEnd(68)} ${String(sommeCatalogue).padStart(8)}  ${String(sommeReel).padStart(8)}\n`);

console.log(`  ══ CONFRONTATION ══\n`);
console.log(`  Ce que la page admin affiche (prix catalogue, sans filtre) ..... ${sommeCatalogue.toLocaleString('fr-FR')} FCFA`);
console.log(`  Ce que la base dit avoir encaissé (montant réel, payés seuls) .. ${sommeReel.toLocaleString('fr-FR')} FCFA`);
console.log(`  Ce que Chariow a réellement fait (source de vérité) ............ ${REEL_CHARIOW.toLocaleString('fr-FR')} FCFA`);
console.log(`\n  Écart affiché vs Chariow ....................................... ${(sommeCatalogue - REEL_CHARIOW).toLocaleString('fr-FR')} FCFA`);
console.log(`  Écart base vs Chariow .......................................... ${(sommeReel - REEL_CHARIOW).toLocaleString('fr-FR')} FCFA`);

console.log(`\n  ══ PART DE KADER (35 %) ══\n`);
console.log(`  Sur le chiffre affiché aujourd'hui ..... ${Math.round(sommeCatalogue * 0.35).toLocaleString('fr-FR')} FCFA`);
console.log(`  Sur l'encaissé réel .................... ${Math.round(sommeReel * 0.35).toLocaleString('fr-FR')} FCFA`);
console.log(`  Sur le chiffre Chariow ................. ${Math.round(REEL_CHARIOW * 0.35).toLocaleString('fr-FR')} FCFA`);
console.log(`  TROP-PAYÉ si on garde l'affichage actuel : ${Math.round((sommeCatalogue - REEL_CHARIOW) * 0.35).toLocaleString('fr-FR')} FCFA\n`);

if (anomalies.length) {
  console.log(`  ══ LES ${anomalies.length} LIGNES QUI EXPLIQUENT L'ÉCART ══\n`);
  const parCause = new Map();
  for (const a of anomalies)
    for (const c of a.causes) {
      const k = c.replace(/\d+/g, 'N');
      const p = parCause.get(k) ?? { n: 0, xof: 0 };
      p.n++; p.xof += a.catalogue - a.encaisse;
      parCause.set(k, p);
    }
  for (const [c, p] of [...parCause].sort((x, y) => y[1].xof - x[1].xof))
    console.log(`  ${c.padEnd(46)} ${String(p.n).padStart(3)} ligne(s)   ${String(p.xof).padStart(8)} FCFA de trop`);
  console.log('');
}
