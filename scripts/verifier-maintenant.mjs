import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { verifierPronostics } = await jiti.import('./src/lib/precision-reelle.ts');
const debut = Date.now();
const r = await verifierPronostics(10000);
console.log(`\n  ${r.examinees} analyses examinees, ${r.verifiees} verifiees, ${r.enAttente} encore en attente.`);
console.log(`  en ${Math.round((Date.now() - debut) / 1000)} s\n`);
