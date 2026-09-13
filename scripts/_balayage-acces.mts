/**
 * LE BALAYAGE COMPLET : DEPUIS L'OUVERTURE DE MAKETOU, QUI EST RESTÉ SANS ACCÈS ?
 *
 * Deux jours ne suffisent pas à dormir tranquille. On confronte ici CHAQUE
 * vente encaissée depuis le 28 août 2026 à ce que la base a réellement servi.
 * Lecture seule.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const intentions: any[] = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('payment_intents')
    .select('sale_id, user_id, plan, email, amount, created_at, consumed_at, statut_boutique, cause_echec')
    .gte('created_at', '2026-08-28T00:00:00Z').order('created_at').range(de, de + 999);
  if (!data?.length) break;
  intentions.push(...data);
  if (data.length < 1000) break;
}

const abos: any[] = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('chariow_sale_id, user_id, expires_at, status').range(de, de + 999);
  if (!data?.length) break;
  abos.push(...data);
  if (data.length < 1000) break;
}
const { data: matchs } = await sb.from('matchs_debloques').select('sale_id');

const servies = new Set<string>([
  ...abos.map((a) => a.chariow_sale_id).filter(Boolean).map(String),
  ...((matchs ?? []) as any[]).map((m) => m.sale_id).filter(Boolean).map(String),
]);

console.log(`${intentions.length} vente(s) enregistrée(s) depuis le 28 août 2026.`);
const encaissees = intentions.filter((i) => String(i.statut_boutique ?? '').toLowerCase() === 'completed');
console.log(`   dont ${encaissees.length} confirmée(s) « completed » par la boutique.`);
console.log(`   dont ${intentions.length - encaissees.length} sans confirmation (abandonnées ou en cours).\n`);

const sansAcces = encaissees.filter((i) => !servies.has(String(i.sale_id)));
console.log(`══ VENTES ENCAISSÉES SANS ACCÈS : ${sansAcces.length} ══`);
for (const s of sansAcces)
  console.log(`   ${String(s.created_at).slice(0, 16).replace('T', ' ')}  ${String(s.amount).padStart(6)}F  ${String(s.plan).padEnd(18)} ` +
    `${String(s.email ?? '—').padEnd(36)} compte ${s.user_id ? 'oui' : 'AUCUN'}  ${s.sale_id}`);

// Et les ventes non confirmées : de l'argent peut-être entré sans qu'on le sache ?
const douteuses = intentions.filter((i) => String(i.statut_boutique ?? '').toLowerCase() !== 'completed' && !servies.has(String(i.sale_id)));
console.log(`\n── VENTES SANS CONFIRMATION DE LA BOUTIQUE ET SANS ACCÈS : ${douteuses.length}`);
const parStatut = new Map<string, number>();
for (const d of douteuses) parStatut.set(String(d.statut_boutique ?? 'jamais relevé'), (parStatut.get(String(d.statut_boutique ?? 'jamais relevé')) ?? 0) + 1);
for (const [s, n] of [...parStatut].sort((a, b) => b[1] - a[1])) console.log(`   ${String(s).padEnd(22)} ${n}`);
for (const d of douteuses.slice(0, 25))
  console.log(`      ${String(d.created_at).slice(0, 16).replace('T', ' ')}  ${String(d.amount).padStart(6)}F  ${String(d.email ?? '—').padEnd(34)} ${d.statut_boutique ?? '—'}  ${d.cause_echec ?? ''}`);
