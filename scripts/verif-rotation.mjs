/**
 * En combien de jours la rotation couvre-t-elle tous les championnats ?
 * Un championnat jamais atteint est un trou permanent dans la mesure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { LEAGUE_IDS } = await jiti.import('./src/lib/api-football.ts');

const toutes = [...new Set([...Object.values(LEAGUE_IDS), 2, 3, 848, 531])];
const DE_FRONT = 12;
// Mesuré : 36 championnats atteints avant que le budget ne coupe.
const ATTEINTS_PAR_JOUR = 36;

const vus = new Set();
console.log(`\n  ${toutes.length} championnats au total, ~${ATTEINTS_PAR_JOUR} atteints par passage.\n`);
console.log('  jour   nouveaux   couverture');
console.log('  ' + '─'.repeat(38));

for (let j = 0; j < 12; j++) {
  const jourAbsolu = Math.floor((Date.now() + j * 86400000) / 86400000);
  const depart = (jourAbsolu * DE_FRONT * 3) % toutes.length;
  const ordre = [...toutes.slice(depart), ...toutes.slice(0, depart)];
  const avant = vus.size;
  for (const l of ordre.slice(0, ATTEINTS_PAR_JOUR)) vus.add(l);
  console.log(
    `  ${String(j + 1).padStart(4)}   ${String(vus.size - avant).padStart(8)}   ` +
    `${String(vus.size).padStart(3)} / ${toutes.length}  ${'█'.repeat(Math.round((vus.size / toutes.length) * 24))}`
  );
  if (vus.size === toutes.length) {
    console.log(`\n  Couverture complete au bout de ${j + 1} jour(s).\n`);
    break;
  }
}
if (vus.size < toutes.length) console.log(`\n  ATTENTION : ${toutes.length - vus.size} championnats jamais atteints en 12 jours.\n`);
