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
const { listSalesEncaissees } = await jiti.import('../src/lib/chariow.ts');
const V = await listSalesEncaissees();

const jour = (v) => String(v.completed_at ?? v.created_at).slice(0, 10);
const parJour = new Map();
for (const v of V) {
  const j = jour(v);
  const a = parJour.get(j) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(v.amount?.value ?? 0);
  parJour.set(j, a);
}

console.log(`\n  ${V.length} ventes encaissées au total\n`);
console.log(`  jour          ventes      montant     cumul depuis le 16`);
let cumul = 0, total = 0;
for (const [j, a] of [...parJour].sort()) {
  total += a.xof;
  if (j >= '2026-08-16') cumul += a.xof;
  console.log(`  ${j}  ${String(a.n).padStart(6)}  ${String(a.xof).padStart(10)}  ${j >= '2026-08-16' ? String(cumul).padStart(12) : '           —'}`);
}
console.log(`  ${'-'.repeat(52)}`);
console.log(`  TOTAL toutes dates : ${total.toLocaleString('fr-FR')} FCFA`);
console.log(`  DEPUIS LE 16 AOÛT  : ${cumul.toLocaleString('fr-FR')} FCFA`);
console.log(`  Part de Kader 35 % : ${Math.round(cumul * 0.35).toLocaleString('fr-FR')} FCFA\n`);
