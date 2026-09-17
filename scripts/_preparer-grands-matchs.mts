// Lance la préparation des grands matchs à venir (le même travail que l'entretien quotidien) et mesure sa durée.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { precalculerGrandsMatchs } = await import('../src/lib/precalcul-selection.js');
const t = Date.now();
const r = await precalculerGrandsMatchs(Number(process.argv[2]) || 20_000);
console.log(JSON.stringify({ ...r, details: r.details.slice(0, 8) }, null, 1));
console.log(`durée : ${Math.round((Date.now() - t) / 1000)} s`);
