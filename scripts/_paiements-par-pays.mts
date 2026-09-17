/**
 * Lecture seule : les paiements par PAYS, réussis et échoués, et l'opérateur
 * déduit du préfixe de téléphone.
 *
 *   npx tsx scripts/_paiements-par-pays.mts TG
 *
 * La boutique n'envoie JAMAIS le moyen de paiement employé : seuls le pays et
 * le téléphone du client arrivent. L'opérateur est donc une DÉDUCTION à partir
 * du préfixe, à prendre comme telle.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const paysCherche = String(process.argv[2] ?? 'TG').toUpperCase();

const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('webhook_events').select('*').range(de, de + 999);
  if (error) throw error;
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

/** L'opérateur, déduit du préfixe togolais. Togocom (T-Money) ou Moov (Flooz). */
const operateurTogo = (tel: string) => {
  const n = tel.replace(/[^0-9]/g, '').replace(/^228/, '');
  const p = n.slice(0, 2);
  if (['70', '71', '72', '79', '90', '91', '92', '93'].includes(p)) return 'Togocom / Yas (T-Money)';
  if (['96', '97', '98', '99'].includes(p)) return 'Moov (Flooz)';
  return `préfixe ${p || '?'}`;
};

const lignes: any[] = [];
for (const e of tout) {
  const p: any = e.payload ?? {};
  const pays = p?.customer?.country ?? null;
  if (String(pays ?? '').toUpperCase() !== paysCherche) continue;
  lignes.push({
    quand: p?.sale?.created_at ?? p?.sale?.completed_at ?? '',
    evenement: String(p?.event ?? e.provider ?? ''),
    statut: String(p?.sale?.status ?? ''),
    email: String(p?.customer?.email ?? p?.email ?? ''),
    tel: String(p?.customer?.phone ?? ''),
    montant: p?.sale?.amount?.value ?? p?.product?.price?.value ?? null,
    plan: p?.sale?.custom_metadata?.plan ?? '',
  });
}
lignes.sort((a, b) => String(a.quand).localeCompare(String(b.quand)));

const compte = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const parStatut = new Map<string, number>();
const parOperateur = new Map<string, number>();
const parOperateurEchec = new Map<string, number>();
for (const l of lignes) {
  compte(parStatut, l.statut || l.evenement);
  const op = operateurTogo(l.tel);
  if (/complet|settle|success/i.test(l.statut + l.evenement)) compte(parOperateur, op);
  else compte(parOperateurEchec, op);
}

console.log(`\n══ ${paysCherche} : ${lignes.length} événement(s) de boutique ══\n`);
console.log('par statut :');
for (const [s, n] of [...parStatut].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${s}`);
console.log('\nopérateur déduit du téléphone — PAIEMENTS RÉUSSIS :');
for (const [o, n] of [...parOperateur].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${o}`);
console.log('\nopérateur déduit du téléphone — ÉCHECS ET ABANDONS :');
for (const [o, n] of [...parOperateurEchec].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${o}`);
console.log('\nles quinze derniers :');
for (const l of lignes.slice(-15))
  console.log(`  ${String(l.quand).slice(0, 16)}  ${String(l.statut || l.evenement).padEnd(10)} ${String(l.montant ?? '').padStart(6)}  ${l.tel.padEnd(16)} ${operateurTogo(l.tel).padEnd(26)} ${l.email}`);
