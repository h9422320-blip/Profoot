/**
 * LE CHIFFRE D'AFFAIRES, DU 8 AU 12 SEPTEMBRE 2026.
 *
 * Deux sources, recoupées l'une par l'autre :
 *
 *   - `subscriptions` : un abonnement accordé. La ligne n'existe QUE si le
 *     paiement a été confirmé par la boutique. C'est l'argent encaissé.
 *   - `payment_intents` : quelqu'un a cliqué pour payer. Une intention n'est
 *     pas une vente ; l'écart entre les deux dit combien d'acheteurs se sont
 *     arrêtés en route.
 *
 * Le Togo est à UTC+0 : la journée civile et la journée UTC coïncident, aucun
 * décalage à appliquer.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const JOURS = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];
const DEBUT = '2026-09-08T00:00:00Z';
const FIN = '2026-09-13T00:00:00Z';

const { data: abos, error: e1 } = await sb
  .from('subscriptions')
  .select('id, user_id, plan, status, amount, currency, created_at, expires_at, provider, chariow_sale_id')
  .gte('created_at', DEBUT)
  .lt('created_at', FIN)
  .order('created_at', { ascending: true });
if (e1) throw new Error(`subscriptions : ${e1.message}`);

const { data: intentions, error: e2 } = await sb
  .from('payment_intents')
  .select('sale_id, user_id, plan, email, amount, created_at, consumed_at, pays, statut_boutique, cause_echec, moyen_paiement')
  .gte('created_at', DEBUT)
  .lt('created_at', FIN)
  .order('created_at', { ascending: true });
if (e2) throw new Error(`payment_intents : ${e2.message}`);

const jourDe = (x: any) => String(x).slice(0, 10);

console.log('════════════════════════════════════════════════════════════════');
console.log('  CHIFFRE D\'AFFAIRES — 8 au 12 SEPTEMBRE 2026');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Les devises en présence : additionner des monnaies différentes serait faux.
const devises = new Map<string, number>();
for (const a of (abos ?? []) as any[]) devises.set(a.currency ?? '?', (devises.get(a.currency ?? '?') ?? 0) + 1);
console.log('Devises rencontrées :', [...devises].map(([d, n]) => `${d} × ${n}`).join(', ') || 'aucune');
console.log('');

let cumul = 0;
let cumulVentes = 0;
for (const j of JOURS) {
  const duJour = ((abos ?? []) as any[]).filter((a) => jourDe(a.created_at) === j);
  const intentionsDuJour = ((intentions ?? []) as any[]).filter((i) => jourDe(i.created_at) === j);
  const total = duJour.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  cumul += total;
  cumulVentes += duJour.length;

  const parPlan = new Map<string, { n: number; somme: number }>();
  for (const a of duJour) {
    const v = parPlan.get(a.plan ?? '?') ?? { n: 0, somme: 0 };
    v.n++; v.somme += Number(a.amount ?? 0);
    parPlan.set(a.plan ?? '?', v);
  }

  console.log(`── ${j} ────────────────────────────────────────────`);
  console.log(`   ${duJour.length} abonnement(s) accordé(s)   ${total.toLocaleString('fr-FR')} F CFA`);
  for (const [plan, v] of [...parPlan].sort((a, b) => b[1].somme - a[1].somme))
    console.log(`      ${plan.padEnd(22)} ${String(v.n).padStart(2)} × — ${v.somme.toLocaleString('fr-FR')} F`);
  const statuts = new Map<string, number>();
  for (const a of duJour) statuts.set(a.status ?? '?', (statuts.get(a.status ?? '?') ?? 0) + 1);
  if (duJour.length) console.log(`      statuts : ${[...statuts].map(([s, n]) => `${s} × ${n}`).join(', ')}`);
  console.log(`      intentions de paiement ce jour-là : ${intentionsDuJour.length}` +
    (intentionsDuJour.length ? ` (dont ${intentionsDuJour.filter((i) => i.consumed_at).length} menée(s) à terme)` : ''));
  console.log('');
}

console.log('════════════════════════════════════════════════════════════════');
console.log(`  TOTAL DES CINQ JOURS : ${cumulVentes} vente(s) — ${cumul.toLocaleString('fr-FR')} F CFA`);
console.log(`  Moyenne : ${Math.round(cumul / 5).toLocaleString('fr-FR')} F par jour, ` +
  `${cumulVentes ? Math.round(cumul / cumulVentes).toLocaleString('fr-FR') : 0} F par vente`);
console.log('════════════════════════════════════════════════════════════════\n');

// ── LE DÉTAIL, VENTE PAR VENTE ─────────────────────────────────────────────
console.log('── LE DÉTAIL, VENTE PAR VENTE');
for (const a of (abos ?? []) as any[])
  console.log(`   ${String(a.created_at).slice(0, 16).replace('T', ' ')}  ${String(a.amount).padStart(6)} ${a.currency}  ` +
    `${String(a.plan).padEnd(20)} ${String(a.status).padEnd(9)} ${a.provider ?? '?'}  ${a.chariow_sale_id ?? '—'}`);

// ── LES INTENTIONS QUI N'ONT PAS ABOUTI ────────────────────────────────────
const perdues = ((intentions ?? []) as any[]).filter((i) => !i.consumed_at);
console.log(`\n── INTENTIONS DE PAIEMENT SANS SUITE : ${perdues.length} sur ${intentions?.length ?? 0}`);
for (const i of perdues.slice(0, 40))
  console.log(`   ${String(i.created_at).slice(0, 16).replace('T', ' ')}  ${String(i.amount).padStart(6)}  ${String(i.plan).padEnd(20)} ` +
    `${String(i.email ?? '—').padEnd(32)} ${i.pays ?? '—'}  boutique ${i.statut_boutique ?? '—'}  ${i.cause_echec ?? ''}`);
