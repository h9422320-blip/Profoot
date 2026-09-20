// Verse dans la réserve de production les passages d'entraîneurs déjà ramassés
// par le banc d'essai. Même source, mêmes dates.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
import fs from 'node:fs';
const { lireEntraineurs } = await import('../src/lib/entraineurs.js');
const { ecrireReserve } = await import('../src/lib/api-football.js');
const banc: Record<string, { debut: string; fin: string | null }[]> = JSON.parse(
  fs.readFileSync('.challenger/entraineurs.json', 'utf8')
);
const avant = await lireEntraineurs();
const clubs: Record<string, string> = { ...(avant?.clubs ?? {}) };
for (const [club, passages] of Object.entries(banc)) {
  const compact = passages.map((p) => `${p.debut}|${p.fin ?? ''}`).sort().join(',');
  if (compact) clubs[club] = compact;
}
await ecrireReserve('entraineurs:v1', { calculeLe: new Date().toISOString(), clubs }, 30 * 24 * 60 * 60 * 1000);
const relu = await lireEntraineurs();
console.log(`clubs versés : ${Object.keys(clubs).length} · relus : ${Object.keys(relu?.clubs ?? {}).length} · taille ${JSON.stringify(relu ?? {}).length} caractères`);
