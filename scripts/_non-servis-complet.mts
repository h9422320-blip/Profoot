/**
 * TOUS LES ACHETEURS, UN PAR UN : ONT-ILS REÇU CE QU'ILS ONT PAYÉ ?
 *
 * Lecture seule. Chaque vente encaissée est rangée dans une case :
 *
 *   SERVI                vente portée par un abonnement actif
 *   SERVI AUTREMENT      pas rattachée, mais le compte a un accès actif
 *                        (activation manuelle, autre vente) — à regarder
 *   COMPTE SANS ACCÈS    le compte existe, aucun accès : réparable tout de
 *                        suite, en rattachant la vente comme le pulse l'aurait fait
 *   JUMELLE              aucune adresse exacte, mais un compte à une faute de
 *                        frappe près — même règle serrée que la livraison
 *   SANS COMPTE          personne à cette adresse : l'accès s'ouvrira à
 *                        l'inscription ; on ne crée JAMAIS le compte à sa place
 *
 * Et, parmi les servis, ceux qui ne se sont jamais connectés.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { adresseJoignable, DOMAINES_DE_TEST } = await import('../src/lib/livraison-sans-compte.js');
const { jumelleProbable } = await import('../src/lib/adresses-jumelles.js');
const sb = createAdminClient();
const MAINTENANT = Date.now();

async function toutes(table: string, colonnes = '*') {
  const out: any[] = [];
  for (let de = 0; de < 200_000; de += 1000) {
    const { data, error } = await sb.from(table).select(colonnes).range(de, de + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ── LES COMPTES, EN ENTIER, OU RIEN ─────────────────────────────────────────
const comptes = new Map<string, any>();
for (let page = 1; page <= 200; page++) {
  let lot: any[] | null = null;
  for (let essai = 1; essai <= 4 && lot === null; essai++) {
    try {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      lot = data?.users ?? [];
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * essai));
    }
  }
  if (lot === null) { console.log('LECTURE DES COMPTES INCOMPLÈTE — verdict impossible'); process.exit(1); }
  for (const u of lot) comptes.set(String(u.email ?? '').toLowerCase(), u);
  if (lot.length < 1000) break;
}

const abos = await toutes('subscriptions');
const actif = (s: any) => s.status === 'active' && (s.expires_at ? Date.parse(s.expires_at) > MAINTENANT : s.plan === 'lifetime');
const aboParVente = new Map<string, any>();
for (const s of abos) if (s.chariow_sale_id) aboParVente.set(String(s.chariow_sale_id), s);
const accesActif = new Set(abos.filter(actif).map((s) => String(s.user_id)));
const parId = new Map<string, any>([...comptes.values()].map((u) => [u.id, u]));
const connus = [...comptes.values()].map((u) => ({
  email: String(u.email ?? '').toLowerCase(),
  id: u.id,
  aUnAccesActif: accesActif.has(u.id),
  creeLe: String(u.created_at ?? ''),
}));

const ventes = (await toutes('payment_intents')).filter(
  (p) =>
    ['completed', 'settled'].includes(String(p.statut_boutique)) &&
    !/^(verif|diagnostic|test|e2e|prod_|pay_|l_)/i.test(String(p.sale_id ?? '')) &&
    !DOMAINES_DE_TEST.test(String(p.email ?? ''))
);

const cases: Record<string, any[]> = {
  'SERVI': [], 'SERVI AUTREMENT': [], 'COMPTE SANS ACCÈS': [], 'JUMELLE': [], 'SANS COMPTE': [],
};
const jamaisConnectes: any[] = [];

for (const v of ventes) {
  const email = String(v.email ?? '').trim().toLowerCase();
  const sale = String(v.sale_id);
  const ligne = { quand: String(v.created_at).slice(0, 16), montant: v.amount, plan: v.plan, email, sale };
  const abo = aboParVente.get(sale);
  if (abo && actif(abo)) {
    cases['SERVI'].push(ligne);
    const u = parId.get(abo.user_id);
    if (u && !u.last_sign_in_at) jamaisConnectes.push({ ...ligne, compte: u.email, depuis: String(abo.created_at).slice(0, 10) });
    continue;
  }
  if (abo && !actif(abo)) {
    // Porté par un abonnement désormais expiré : servi en son temps.
    cases['SERVI'].push({ ...ligne, note: 'abonnement expiré depuis' });
    continue;
  }
  const u = comptes.get(email) ?? comptes.get(adresseJoignable(email).toLowerCase());
  if (u) {
    if (accesActif.has(u.id)) cases['SERVI AUTREMENT'].push({ ...ligne, compte: u.email });
    else cases['COMPTE SANS ACCÈS'].push({ ...ligne, compte: u.email, userId: u.id });
    continue;
  }
  const j = jumelleProbable(email, connus as any, v.created_at || undefined);
  if (j) cases['JUMELLE'].push({ ...ligne, compte: j.email, userId: j.id });
  else cases['SANS COMPTE'].push(ligne);
}

console.log(`${comptes.size} comptes, ${abos.length} abonnements, ${ventes.length} ventes encaissées\n`);
for (const [nom, l] of Object.entries(cases)) {
  const total = l.reduce((s, x) => s + Number(x.montant ?? 0), 0);
  console.log(`=== ${nom} : ${l.length} vente(s), ${total} F ===`);
  if (nom === 'SERVI') continue;
  for (const x of l.sort((a, b) => b.quand.localeCompare(a.quand)))
    console.log(`  ${x.quand}  ${String(x.montant).padStart(5)} F  ${String(x.plan).padEnd(18)} ${x.email.padEnd(38)} ${x.compte && x.compte !== x.email ? '-> ' + x.compte : ''}  ${x.sale.slice(0, 8)}`);
  console.log('');
}
console.log(`=== SERVIS MAIS JAMAIS CONNECTÉS : ${jamaisConnectes.length} ===`);
for (const x of jamaisConnectes.sort((a, b) => b.quand.localeCompare(a.quand)))
  console.log(`  payé ${x.quand}  ${String(x.montant).padStart(5)} F  ${String(x.compte).padEnd(38)} accès depuis ${x.depuis}`);

fs.writeFileSync(
  'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/non-servis.json',
  JSON.stringify({ cases, jamaisConnectes }, null, 2)
);
