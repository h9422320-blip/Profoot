/**
 * D'OÙ VIENT L'ÉCART ENTRE MAKETOU ET LA PAGE ADMIN — lecture seule.
 *
 * La page admin ne lit pas MakeTou : elle lit NOTRE table `payment_intents`,
 * en ne retenant que les lignes dont `pays_source` vaut « maketou ». Tout
 * écart vient donc d'une de ces trois causes, et ce relevé les sépare :
 *
 *   A. des lignes comptées qui n'ont RIEN rapporté (panier abandonné, échec) ;
 *   B. des ventes payées que la page ne compte pas (source mal étiquetée) ;
 *   C. des ventes de MakeTou qui ne sont jamais arrivées jusqu'à nous.
 *
 * A et B se voient d'ici. C ne se voit qu'en comparant au tableau de bord de
 * la boutique — ce relevé donne donc les nombres exacts à confronter.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('payment_intents').select('*').order('created_at').range(de, de + 999);
  if (error) { console.log('ERREUR : ' + error.message); break; }
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`${tout.length} lignes dans payment_intents.\n`);

const estDiagnostic = (v: any) => /^(verif|diagnostic)/i.test(String(v.sale_id ?? ''));

// ── CE QUE LES DEUX COLONNES CONTIENNENT VRAIMENT ──────────────────────────
const croise = new Map<string, { n: number; xof: number }>();
for (const v of tout) {
  if (estDiagnostic(v)) continue;
  const cle = `${String(v.pays_source ?? '—').padEnd(10)} | ${String(v.statut_boutique ?? '—')}`;
  const c = croise.get(cle) ?? { n: 0, xof: 0 };
  c.n++; c.xof += Number(v.amount ?? 0);
  croise.set(cle, c);
}
console.log('=== pays_source × statut_boutique ===');
console.log('  source     | statut            ventes        montant');
for (const [cle, c] of [...croise].sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${cle.padEnd(30)} ${String(c.n).padStart(5)}  ${String(c.xof).padStart(10)} F`);

// ── CE QUE LA PAGE COMPTE AUJOURD'HUI ──────────────────────────────────────
const compteesAujourdhui = tout.filter((v) => !estDiagnostic(v) && v.pays_source === 'maketou');
// ── CE QU'ELLE DEVRAIT COMPTER ─────────────────────────────────────────────
const reellementPayees = tout.filter(
  (v) => !estDiagnostic(v) && ['completed', 'settled'].includes(String(v.statut_boutique))
);

const somme = (l: any[]) => l.reduce((s, v) => s + Number(v.amount ?? 0), 0);
console.log('\n=== LE COMPTE, DANS LES DEUX LECTURES ===');
console.log(`  page admin aujourd'hui  (pays_source = maketou)      : ${compteesAujourdhui.length} ventes, ${somme(compteesAujourdhui)} F`);
console.log(`  ventes réellement payées (statut completed/settled)  : ${reellementPayees.length} ventes, ${somme(reellementPayees)} F`);

// ── A. COMPTÉES ALORS QU'ELLES N'ONT RIEN RAPPORTÉ ─────────────────────────
const fantomes = compteesAujourdhui.filter((v) => !['completed', 'settled'].includes(String(v.statut_boutique)));
console.log(`\n=== A. COMPTÉES SANS AVOIR RAPPORTÉ : ${fantomes.length} ventes, ${somme(fantomes)} F ===`);
const parStatut = new Map<string, { n: number; xof: number }>();
for (const v of fantomes) {
  const c = parStatut.get(String(v.statut_boutique ?? '—')) ?? { n: 0, xof: 0 };
  c.n++; c.xof += Number(v.amount ?? 0);
  parStatut.set(String(v.statut_boutique ?? '—'), c);
}
for (const [s, c] of [...parStatut].sort((a, b) => b[1].n - a[1].n))
  console.log(`   statut « ${s} » : ${c.n} ventes, ${c.xof} F`);

// ── B. PAYÉES MAIS NON COMPTÉES ────────────────────────────────────────────
const oubliees = reellementPayees.filter((v) => v.pays_source !== 'maketou');
console.log(`\n=== B. PAYÉES MAIS NON COMPTÉES : ${oubliees.length} ventes, ${somme(oubliees)} F ===`);
for (const v of oubliees.slice(0, 20))
  console.log(`   ${String(v.created_at).slice(0, 10)}  ${String(v.amount).padStart(5)} F  source=${v.pays_source}  ${v.email}`);
if (oubliees.length > 20) console.log(`   … et ${oubliees.length - 20} autre(s)`);

// ── LE JOUR PAR JOUR, DANS LES DEUX LECTURES ───────────────────────────────
const parJour = (liste: any[]) => {
  const m = new Map<string, { n: number; xof: number }>();
  for (const v of liste) {
    const j = String(v.created_at ?? '').slice(0, 10);
    const c = m.get(j) ?? { n: 0, xof: 0 };
    c.n++; c.xof += Number(v.amount ?? 0);
    m.set(j, c);
  }
  return m;
};
const aJour = parJour(compteesAujourdhui);
const bJour = parJour(reellementPayees);
const jours = [...new Set([...aJour.keys(), ...bJour.keys()])].sort().slice(-14);

console.log('\n=== JOUR PAR JOUR — 14 derniers jours ===');
console.log('  jour         page admin        réellement payé      écart');
for (const j of jours) {
  const a = aJour.get(j) ?? { n: 0, xof: 0 };
  const b = bJour.get(j) ?? { n: 0, xof: 0 };
  const ecart = b.xof - a.xof;
  console.log(
    `  ${j}  ${String(a.n).padStart(3)} v ${String(a.xof).padStart(7)} F   ` +
      `${String(b.n).padStart(3)} v ${String(b.xof).padStart(7)} F   ` +
      `${ecart === 0 ? '        —' : (ecart > 0 ? '+' : '') + ecart + ' F'}`
  );
}
