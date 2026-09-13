/**
 * LE CHIFFRE D'AFFAIRES RANGÉ PAR DATE DE PAIEMENT, ET NON PAR DATE D'ACCÈS.
 *
 * `subscriptions.created_at` est le moment où l'accès a été OUVERT. Quand un
 * paiement passe inaperçu et n'est rattrapé que plus tard, l'argent est compté
 * le jour du rattrapage, pas le jour où il est entré. On compare donc les deux
 * lectures, et on mesure le délai entre payer et recevoir.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data: abos } = await sb
  .from('subscriptions').select('user_id, plan, amount, created_at, chariow_sale_id')
  .gte('created_at', '2026-09-08T00:00:00Z').lt('created_at', '2026-09-13T00:00:00Z');
// Les intentions sur une fenêtre large : un paiement du 5 peut être servi le 10.
const { data: intentions } = await sb
  .from('payment_intents').select('sale_id, email, amount, created_at, consumed_at, statut_boutique')
  .gte('created_at', '2026-08-25T00:00:00Z').lt('created_at', '2026-09-13T00:00:00Z');

const parSale = new Map<string, any>();
for (const i of (intentions ?? []) as any[]) parSale.set(String(i.sale_id), i);

const jour = (x: any) => String(x).slice(0, 10);
const A = ((abos ?? []) as any[]).filter((a) => Number(a.amount ?? 0) > 0);

const retards: any[] = [];
const caAcces = new Map<string, number>();
const caPaiement = new Map<string, number>();

for (const a of A) {
  const mnt = Number(a.amount);
  caAcces.set(jour(a.created_at), (caAcces.get(jour(a.created_at)) ?? 0) + mnt);

  const i = a.chariow_sale_id ? parSale.get(String(a.chariow_sale_id)) : null;
  const datePaiement = i?.created_at ?? a.created_at;
  caPaiement.set(jour(datePaiement), (caPaiement.get(jour(datePaiement)) ?? 0) + mnt);

  if (i) {
    const delaiMin = (new Date(a.created_at).getTime() - new Date(i.created_at).getTime()) / 60000;
    if (delaiMin > 60) retards.push({ ...a, email: i.email, paye: i.created_at, delaiMin });
  }
}

console.log('── LES DEUX LECTURES, CÔTE À CÔTE (francs CFA)');
console.log('   jour          accès ouvert      argent entré     écart');
for (const j of ['2026-09-05','2026-09-06','2026-09-07','2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12']) {
  const a = caAcces.get(j) ?? 0;
  const p = caPaiement.get(j) ?? 0;
  if (!a && !p) continue;
  const ecart = p - a;
  console.log(`   ${j}   ${String(a.toLocaleString('fr-FR')).padStart(12)}   ${String(p.toLocaleString('fr-FR')).padStart(14)}   ${ecart > 0 ? '+' : ''}${ecart.toLocaleString('fr-FR')}`);
}

console.log(`\n── PAIEMENTS SERVIS AVEC PLUS D'UNE HEURE DE RETARD : ${retards.length} sur ${A.length}`);
for (const r of retards.sort((x, y) => y.delaiMin - x.delaiMin))
  console.log(`   ${r.email.padEnd(30)} ${String(r.amount).padStart(6)}F  payé ${String(r.paye).slice(0, 16).replace('T', ' )')}  ` +
    `servi ${String(r.created_at).slice(0, 16).replace('T', ' ')}  → ${(r.delaiMin / 60).toFixed(1)} h d'attente`);

const mediane = (l: number[]) => l.length ? l.sort((a, b) => a - b)[Math.floor(l.length / 2)] : 0;
const delais = A.map((a) => {
  const i = a.chariow_sale_id ? parSale.get(String(a.chariow_sale_id)) : null;
  return i ? (new Date(a.created_at).getTime() - new Date(i.created_at).getTime()) / 1000 : null;
}).filter((x): x is number => x !== null);
console.log(`\n── DÉLAI ENTRE PAYER ET RECEVOIR SON ACCÈS (${delais.length} ventes mesurées)`);
console.log(`   médiane : ${mediane([...delais]).toFixed(0)} secondes`);
console.log(`   au-delà d'une minute : ${delais.filter((d) => d > 60).length} vente(s)`);
