import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { verifierPronostics } = await jiti.import('./src/lib/precision-reelle.ts');

const limite = Number(process.argv[2] || 200);
console.log(`\n  Lot demandé : ${limite} analyses.\n`);
const debut = Date.now();
const r = await verifierPronostics(limite);
const secondes = Math.round((Date.now() - debut) / 100) / 10;

console.log(`\n  ══ RÉSULTAT ══\n`);
console.log(`  examinées .. ${r.examinees}`);
console.log(`  vérifiées .. ${r.verifiees}`);
console.log(`  en attente . ${r.enAttente}`);
console.log(`  durée ...... ${secondes} s`);
if (r.examinees) console.log(`  cadence .... ${Math.round(r.examinees / Math.max(0.1, secondes))} analyses par seconde`);
console.log('');
