import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { listSalesEncaissees } = await jiti.import('./src/lib/chariow.ts');
const ventes = await listSalesEncaissees();

// ── Quel produit vaut quoi ? ──────────────────────────────────────────────
const produits = new Map();
for (const v of ventes) {
  const n = String(v.product?.name ?? '?');
  if (!produits.has(n)) produits.set(n, { n: 0, montants: new Set() });
  produits.get(n).n++;
  produits.get(n).montants.add(`${v.amount?.value} ${v.amount?.currency}`);
}
console.log(`\n  ══ LES PRODUITS VENDUS ══\n`);
for (const [n, e] of [...produits].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${String(e.n).padStart(4)} ventes · ${[...e.montants].join(' / ').padEnd(18)} · ${n}`);
}

// ── Depuis quand la boutique tourne-t-elle ? ──────────────────────────────
const dates = ventes.map((v) => v.created_at).filter(Boolean).sort();
console.log(`\n  ══ ÂGE DE LA BOUTIQUE ══\n`);
console.log(`  Première vente : ${String(dates[0]).slice(0, 10)}`);
console.log(`  Dernière vente : ${String(dates[dates.length - 1]).slice(0, 10)}`);
const jours = (new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000;
console.log(`  La boutique a ${Math.round(jours)} jours.`);

// ── Les 14 rachats, un par un ─────────────────────────────────────────────
const parClient = new Map();
for (const v of ventes) {
  const cle = String(v.customer?.email ?? v.customer?.id ?? '').trim().toLowerCase();
  if (!cle) continue;
  if (!parClient.has(cle)) parClient.set(cle, []);
  parClient.get(cle).push(v);
}
for (const l of parClient.values()) l.sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
const revenus = [...parClient.values()].filter((l) => l.length > 1);

console.log(`\n  ══ LES ${revenus.length} CLIENTS REVENUS, UN PAR UN ══\n`);
for (const l of revenus) {
  const j = (new Date(l[1].created_at) - new Date(l[0].created_at)) / 86400000;
  const court = (v) => `${String(v.amount?.value ?? '?').padStart(6)} ${String(v.product?.name ?? '').replace(/Abonnement |ProFoot AI ?/g, '').replace(/🔓 Débloquer l'analyse de ce match — /, 'match ').trim() || '?'}`;
  console.log(`  ${String(Math.round(j * 10) / 10).padStart(5)} j  ·  ${court(l[0])}  →  ${court(l[1])}`);
}
console.log('');
