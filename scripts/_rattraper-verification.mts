// Le même travail que la tâche de nuit, lancé à la main : vérifier puis reconstruire les preuves.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { verifierPronostics } = await import('../src/lib/precision-reelle.js');
const { construirePreuves } = await import('../src/lib/preuves.js');
const v = await verifierPronostics(6000);
console.log('vérification :', JSON.stringify(v));
const p = await construirePreuves();
console.log('preuves :', JSON.stringify(p));
