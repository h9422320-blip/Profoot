/** Chariow date-t-il ses ventes à la création ou au paiement ? */
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

const somme = (l) => l.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
const dans = (l, de, a, champ) =>
  l.filter((v) => { const j = String(v[champ] ?? v.created_at).slice(0, 10); return j >= de && j <= a; });

console.log(`\n  ══ 16 → 23 AOÛT, SELON LA DATE RETENUE ══\n`);
for (const [nom, champ] of [['date de PAIEMENT (completed_at)', 'completed_at'], ['date de CRÉATION (created_at)', 'created_at']]) {
  const l = dans(V, '2026-08-16', '2026-08-23', champ);
  console.log(`  ${nom.padEnd(34)} ${l.length} ventes · ${somme(l).toLocaleString('fr-FR')} FCFA`);
}

// Combien de ventes ont une date de paiement différente du jour de création ?
const decalees = V.filter((v) => {
  const c = String(v.created_at ?? '').slice(0, 10);
  const p = String(v.completed_at ?? '').slice(0, 10);
  return p && c && p !== c;
});
console.log(`\n  Ventes payées un AUTRE jour que leur création : ${decalees.length}`);
for (const v of decalees.slice(0, 10))
  console.log(`     créée ${String(v.created_at).slice(0, 10)} → payée ${String(v.completed_at).slice(0, 10)}  ${v.amount?.value} FCFA`);

console.log(`\n  ══ ET LE 22 AOÛT SEUL ══\n`);
for (const [nom, champ] of [['par paiement', 'completed_at'], ['par création', 'created_at']]) {
  const l = dans(V, '2026-08-22', '2026-08-22', champ);
  console.log(`  ${nom.padEnd(16)} ${l.length} ventes · ${somme(l).toLocaleString('fr-FR')} FCFA`);
}
console.log('');
