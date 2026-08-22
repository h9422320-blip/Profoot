/** Ce que la boutique Chariow dit VRAIMENT. Rien n'est écrit. */
import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const CLE = env.CHARIOW_API_KEY;

const ventes = [];
let url = 'https://api.chariow.com/v1/sales?per_page=100';
for (let p = 0; p < 60 && url; p++) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${CLE}`, Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (Array.isArray(d?.data)) ventes.push(...d.data);
  let s = d?.pagination?.next_page_url ?? null;
  if (s) { const u = new URL(s); u.searchParams.set('per_page', '100'); s = u.toString(); }
  url = s;
}

const PAYE = ['completed', 'settled'];
const jourDe = (v) => String(v.completed_at ?? v.created_at).slice(0, 10);
const payees = ventes.filter((v) => PAYE.includes(v.status));

console.log(`\n  ${ventes.length} vente(s) lues — ${payees.length} encaissée(s).\n`);

console.log(`  ══ JOUR PAR JOUR (encaissé) ══\n`);
const parJour = new Map();
for (const v of payees) {
  const a = parJour.get(jourDe(v)) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(v.amount?.value ?? 0);
  parJour.set(jourDe(v), a);
}
let cumul = 0;
for (const [j, a] of [...parJour].sort()) {
  cumul += a.xof;
  console.log(`  ${j}   ${String(a.n).padStart(3)} vente(s)   ${String(a.xof).padStart(8)} FCFA`);
}
console.log(`  ${'—'.repeat(46)}`);
console.log(`  TOTAL BOUTIQUE (7 → 22 août)          ${String(cumul).padStart(8)} FCFA\n`);

for (const [libelle, du, au] of [['16 → 22 août', '2026-08-16', '2026-08-22']]) {
  const lot = payees.filter((v) => jourDe(v) >= du && jourDe(v) <= au);
  const t = lot.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
  console.log(`  ${libelle} : ${lot.length} vente(s), ${t.toLocaleString('fr-FR')} FCFA`);
  console.log(`  Part de Kader (35 %) : ${Math.round(t * 0.35).toLocaleString('fr-FR')} FCFA\n`);
}

console.log(`  ══ PAR PRODUIT (16 → 22) ══\n`);
const p22 = payees.filter((v) => jourDe(v) >= '2026-08-16');
const parProduit = new Map();
for (const v of p22) {
  const k = v.product?.name ?? '—';
  const a = parProduit.get(k) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(v.amount?.value ?? 0);
  parProduit.set(k, a);
}
for (const [k, a] of [...parProduit].sort((x, y) => y[1].xof - x[1].xof))
  console.log(`  ${String(k).slice(0, 40).padEnd(41)} ${String(a.n).padStart(3)}   ${String(a.xof).padStart(8)} FCFA`);

// Les devises, au cas où une vente ne serait pas en FCFA.
const devises = new Set(payees.map((v) => v.amount?.currency));
console.log(`\n  Devises rencontrées : ${[...devises].join(', ')}\n`);
