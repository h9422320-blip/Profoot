import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { construirePreuves } = await jiti.import('./src/lib/preuves.ts');
const { enregistrerPrecisionDuJour } = await jiti.import('./src/lib/precision-quotidienne.ts');

const debut = Date.now();
const r = await construirePreuves();
await enregistrerPrecisionDuJour();
console.log(`\n  Mur reconstruit en ${Math.round((Date.now() - debut) / 100) / 10} s`);
console.log('  ' + JSON.stringify(r));
console.log('');
