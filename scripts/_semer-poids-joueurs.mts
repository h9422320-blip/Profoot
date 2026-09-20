// Verse dans la réserve de production le poids des joueurs déjà ramassé par le
// banc d'essai (`.challenger/joueurs.json`). Même source, même chiffres : c'est
// un raccourci, pas une invention. La réserve ne perd jamais ce qu'elle a.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
import fs from 'node:fs';
const { lirePoidsDesJoueurs } = await import('../src/lib/forces-absences.js');
const { ecrireReserve } = await import('../src/lib/api-football.js');
const { compacter, tableDeLaSaison } = await import('../src/lib/forces-absences.js');
const banc: Record<string, any> = JSON.parse(fs.readFileSync('.challenger/joueurs.json', 'utf8'));
const dejaLa = await lirePoidsDesJoueurs();
const minutes: Record<string, number> = {};
for (const saison of Object.keys(dejaLa?.saisons ?? {})) {
  for (const [joueur, min] of tableDeLaSaison(dejaLa, Number(saison))) minutes[`${saison}:${joueur}`] = min;
}
const avant = { ...minutes };
for (const [cle, v] of Object.entries(banc)) {
  if (cle.startsWith('fait:')) continue;
  const min = Number((v as any)?.min ?? 0);
  if (min > 0) minutes[cle] = Math.max(Number(minutes[cle] ?? 0), min);
}
await ecrireReserve('absences:poids-joueurs:v1', { calculeLe: new Date().toISOString(), saisons: compacter(minutes) }, 30 * 24 * 60 * 60 * 1000);
const relu = await lirePoidsDesJoueurs();
const compte = (p: any) => Object.values(p?.saisons ?? {}).reduce((t: number, x: any) => t + String(x).split(',').length, 0);
console.log(`avant ${Object.keys(avant).length} · versés ${Object.keys(minutes).length} · relus ${compte(relu)}`);
