/**
 * LE BILAN DE SANTÉ : POURQUOI PLUS RIEN NE SE VEND DEPUIS UNE HEURE ?
 *
 * Quand les ventes s'arrêtent, trois causes seulement sont possibles :
 *
 *   1. PLUS PERSONNE NE VIENT — le trafic s'est tari, c'est un problème
 *      d'audience, pas de logiciel.
 *   2. LES GENS VIENNENT MAIS N'ACHÈTENT PAS — la caisse est cassée, le lien
 *      est mort, ou l'application refuse quelque chose.
 *   3. ILS ACHÈTENT MAIS ON NE LE VOIT PAS — le pulse de la boutique n'arrive
 *      plus, et l'argent entre sans que la base l'enregistre. C'est le pire
 *      des trois : on croit à un creux commercial alors que des clients paient
 *      sans être servis.
 *
 * Ce script les sépare. Lecture seule.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const maintenant = new Date();
const jour = maintenant.toISOString().slice(0, 10);
const heureH = (x: any) => String(x).slice(11, 13);
const hier = new Date(maintenant.getTime() - 86400000).toISOString().slice(0, 10);
const avantHier = new Date(maintenant.getTime() - 2 * 86400000).toISOString().slice(0, 10);

console.log('════════════════════════════════════════════════════════════════');
console.log(`  BILAN DE SANTÉ — ${maintenant.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
console.log('════════════════════════════════════════════════════════════════\n');

// ── 1. L'ARGENT, HEURE PAR HEURE ────────────────────────────────────────────
const { data: ventes } = await sb
  .from('payment_intents')
  .select('sale_id, created_at, amount, plan, email, statut_boutique')
  .gte('created_at', `${avantHier}T00:00:00Z`)
  .order('created_at', { ascending: true });
const V = (ventes ?? []) as any[];

const parJourEtHeure = new Map<string, Map<string, { n: number; f: number }>>();
for (const v of V) {
  const j = String(v.created_at).slice(0, 10);
  const h = heureH(v.created_at);
  if (!parJourEtHeure.has(j)) parJourEtHeure.set(j, new Map());
  const m = parJourEtHeure.get(j)!;
  const c = m.get(h) ?? { n: 0, f: 0 };
  c.n++; c.f += Number(v.amount ?? 0);
  m.set(h, c);
}

console.log('── VENTES HEURE PAR HEURE (nombre / francs)');
console.log('   heure  ' + [avantHier, hier, jour].map((j) => j.slice(5).padStart(12)).join('  '));
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  const cols = [avantHier, hier, jour].map((j) => {
    const c = parJourEtHeure.get(j)?.get(hh);
    return c ? `${String(c.n).padStart(2)} / ${String(c.f).padStart(6)}` : '       —    ';
  });
  const marque = Number(hh) === maintenant.getUTCHours() ? ' ←' : '';
  console.log(`   ${hh}h    ${cols.join('  ')}${marque}`);
}

const duJour = V.filter((v) => String(v.created_at).slice(0, 10) === jour);
const derniere = duJour[duJour.length - 1];
console.log(`\n   Aujourd'hui : ${duJour.length} vente(s), ${duJour.reduce((s, v) => s + Number(v.amount ?? 0), 0).toLocaleString('fr-FR')} F`);
if (derniere) {
  const ecoule = Math.round((maintenant.getTime() - Date.parse(derniere.created_at)) / 60000);
  console.log(`   DERNIÈRE VENTE : ${String(derniere.created_at).slice(11, 16)} — il y a ${ecoule} minutes (${derniere.amount} F, ${derniere.email})`);
}

// ── 2. LE TRAFIC : les gens viennent-ils encore ? ───────────────────────────
const lireTout = async (table: string, colonnes: string, depuis: string) => {
  const out: any[] = [];
  for (let de = 0; de < 8000; de += 1000) {
    const { data } = await sb.from(table).select(colonnes).gte('created_at', depuis).range(de, de + 999);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
};

const analyses = await lireTout('analysis_history', 'created_at, user_id', `${hier}T00:00:00Z`);
const parHeureA = new Map<string, Map<string, Set<string>>>();
const comptesA = new Map<string, Map<string, number>>();
for (const a of analyses) {
  const j = String(a.created_at).slice(0, 10);
  const h = heureH(a.created_at);
  if (!parHeureA.has(j)) { parHeureA.set(j, new Map()); comptesA.set(j, new Map()); }
  const s = parHeureA.get(j)!;
  if (!s.has(h)) s.set(h, new Set());
  s.get(h)!.add(String(a.user_id));
  comptesA.get(j)!.set(h, (comptesA.get(j)!.get(h) ?? 0) + 1);
}

console.log('\n── ANALYSES HEURE PAR HEURE (analyses / personnes distinctes)');
console.log('   heure  ' + [hier, jour].map((j) => j.slice(5).padStart(14)).join('  '));
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  const cols = [hier, jour].map((j) => {
    const n = comptesA.get(j)?.get(hh) ?? 0;
    const p = parHeureA.get(j)?.get(hh)?.size ?? 0;
    return n ? `${String(n).padStart(4)} / ${String(p).padStart(3)}` : '        —   ';
  });
  const marque = Number(hh) === maintenant.getUTCHours() ? ' ←' : '';
  console.log(`   ${hh}h    ${cols.join('  ')}${marque}`);
}

// ── 3. LES NOUVEAUX COMPTES ────────────────────────────────────────────────
const { data: liste } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const nouveaux = (liste?.users ?? []).filter((u: any) => String(u.created_at).slice(0, 10) === jour);
const parHeureN = new Map<string, number>();
for (const u of nouveaux) parHeureN.set(heureH(u.created_at), (parHeureN.get(heureH(u.created_at)) ?? 0) + 1);
console.log(`\n── NOUVEAUX COMPTES AUJOURD'HUI : ${nouveaux.length}`);
console.log('   ' + [...parHeureN].sort().map(([h, n]) => `${h}h:${n}`).join('  '));

// ── 4. LES PANNES D'ANALYSE ────────────────────────────────────────────────
const { data: echecs } = await sb
  .from('analysis_failures')
  .select('created_at, cause, servi_quand_meme, message')
  .gte('created_at', `${jour}T00:00:00Z`)
  .order('created_at', { ascending: false });
const E = (echecs ?? []) as any[];
console.log(`\n── ÉCHECS D'ANALYSE AUJOURD'HUI : ${E.length}`);
console.log(`   dont RIEN SERVI (le client a vu une erreur) : ${E.filter((x) => !x.servi_quand_meme).length}`);
for (const x of E.slice(0, 6))
  console.log(`   ${String(x.created_at).slice(11, 16)}  ${x.cause}  servi ${x.servi_quand_meme}  ${String(x.message ?? '').slice(0, 80)}`);

// ── 5. LES PAIEMENTS ENCAISSÉS SANS ACCÈS ──────────────────────────────────
const abos: any[] = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('chariow_sale_id').range(de, de + 999);
  if (!data?.length) break;
  abos.push(...data);
  if (data.length < 1000) break;
}
const servies = new Set(abos.map((a) => String(a.chariow_sale_id)));
const orphelines = duJour.filter((v) => Number(v.amount) > 0 && v.statut_boutique === 'completed' && !servies.has(String((v as any).sale_id)));
console.log(`\n── PAIEMENTS DU JOUR ENCAISSÉS SANS ACCÈS : ${orphelines.length}`);
