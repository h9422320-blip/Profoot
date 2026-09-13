/**
 * QUI A PAYÉ LE 12 ET LE 13 SEPTEMBRE, ET QUI N'A PAS SON ACCÈS.
 *
 * La boutique MakeTou ne se relit pas : elle POUSSE ses ventes dans
 * `payment_intents`. C'est donc là qu'une vente encaissée existe, et c'est en
 * la confrontant à `subscriptions` et `matchs_debloques` qu'on voit si l'accès
 * a bien été ouvert.
 *
 * Trois façons de rester sans accès :
 *   1. l'intention n'a jamais été consommée ;
 *   2. elle est consommée mais aucun abonnement ne porte son identifiant ;
 *   3. l'acheteur n'a pas encore de compte — rien ne peut s'ouvrir.
 *
 * Aucune écriture ici.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data: intentions, error } = await sb
  .from('payment_intents')
  .select('sale_id, user_id, plan, email, amount, created_at, consumed_at, pays, statut_boutique, cause_echec, message_echec, moyen_paiement')
  .gte('created_at', '2026-09-12T00:00:00Z')
  .order('created_at', { ascending: true });
if (error) throw new Error(error.message);
const I = (intentions ?? []) as any[];

const abos: any[] = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('chariow_sale_id, user_id, plan, status, expires_at, created_at').range(de, de + 999);
  if (!data?.length) break;
  abos.push(...data);
  if (data.length < 1000) break;
}
const { data: matchs } = await sb.from('matchs_debloques').select('sale_id');
const parSale = new Map<string, any>();
for (const a of abos) if (a.chariow_sale_id) parSale.set(String(a.chariow_sale_id), a);
const matchsServis = new Set(((matchs ?? []) as any[]).map((m) => String(m.sale_id)));

const jour = (x: any) => String(x).slice(0, 10);
console.log(`── ${I.length} PAIEMENT(S) DEPUIS LE 12 SEPTEMBRE 00 h 00\n`);

const sansAcces: any[] = [];
for (const j of ['2026-09-12', '2026-09-13']) {
  const duJour = I.filter((i) => jour(i.created_at) === j);
  console.log(`══ ${j} — ${duJour.length} paiement(s) ══`);
  for (const i of duJour) {
    const abo = parSale.get(String(i.sale_id));
    const parMatch = matchsServis.has(String(i.sale_id));
    const ok = Boolean(abo) || parMatch;
    if (!ok) sansAcces.push(i);
    console.log(
      `   ${String(i.created_at).slice(11, 16)}  ${String(i.amount).padStart(6)}F  ${String(i.plan).padEnd(18)} ` +
        `${String(i.email ?? '—').padEnd(34)} ${String(i.statut_boutique ?? '—').padEnd(10)} ` +
        `${ok ? (parMatch ? 'match débloqué' : `accès OK jusqu'au ${String(abo.expires_at).slice(0, 10)}`) : '*** SANS ACCÈS ***'}` +
        `${i.user_id ? '' : '  [aucun compte]'}`
    );
  }
  console.log('');
}

console.log(`══════ ${sansAcces.length} PAIEMENT(S) SANS ACCÈS ══════`);
for (const s of sansAcces)
  console.log(`   ${String(s.created_at).slice(0, 16).replace('T', ' ')}  ${s.amount}F  ${s.plan}  ${s.email}  ` +
    `compte ${s.user_id ?? 'AUCUN'}  boutique ${s.statut_boutique ?? '—'}  vente ${s.sale_id}` +
    (s.cause_echec ? `  ÉCHEC ${s.cause_echec} ${s.message_echec ?? ''}` : ''));
