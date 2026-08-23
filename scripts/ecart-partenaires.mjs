/** D'où vient l'écart entre la page partenaires et la caisse Chariow ? */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { listSalesEncaissees, listRecentSales, STATUTS_ENCAISSES } = await jiti.import('../src/lib/chariow.ts');

// A. Ce que la page partenaires utilise.
const A = await listSalesEncaissees();
// B. La liste complète, filtrée à la main.
const B = (await listRecentSales()).filter((v) => STATUTS_ENCAISSES.includes(String(v.status)));

const jour = (v) => String(v.completed_at ?? v.created_at).slice(0, 10);
const somme = (l) => l.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);

console.log(`\n  A — listSalesEncaissees (page partenaires) : ${A.length} ventes, ${somme(A).toLocaleString('fr-FR')} FCFA`);
console.log(`  B — liste complète filtrée à la main       : ${B.length} ventes, ${somme(B).toLocaleString('fr-FR')} FCFA`);

const idsB = new Set(B.map((v) => v.id));
const idsA = new Set(A.map((v) => v.id));
const seulA = A.filter((v) => !idsB.has(v.id));
const seulB = B.filter((v) => !idsA.has(v.id));

console.log(`\n  Présentes SEULEMENT dans A : ${seulA.length}`);
for (const v of seulA.slice(0, 12))
  console.log(`     ${jour(v)}  ${String(v.amount?.value).padStart(6)}  ${v.status.padEnd(10)} ${v.id}`);
console.log(`\n  Présentes SEULEMENT dans B : ${seulB.length}`);
for (const v of seulB.slice(0, 12))
  console.log(`     ${jour(v)}  ${String(v.amount?.value).padStart(6)}  ${v.status.padEnd(10)} ${v.id}`);

console.log(`\n  ══ JOUR PAR JOUR, LES DEUX LECTURES ══\n`);
const jours = [...new Set([...A, ...B].map(jour))].sort().slice(-9);
console.log(`  jour          A (partenaires)      B (à la main)     écart`);
for (const j of jours) {
  const a = somme(A.filter((v) => jour(v) === j));
  const b = somme(B.filter((v) => jour(v) === j));
  console.log(`  ${j}  ${String(a).padStart(10)}  ${String(b).padStart(16)}  ${String(a - b).padStart(8)}${a !== b ? '  <<<' : ''}`);
}
console.log('');
