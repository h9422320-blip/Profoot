/**
 * Rafraîchit les pronostics figés des sept grands championnats dont le coup
 * d'envoi est à plus de vingt-quatre heures — la règle de l'analyse. Sert
 * après une amélioration du moteur.
 *
 *   npx tsx scripts/_rafraichir-grands-matchs.mts
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { precalculerGrandsMatchs } = await import('../src/lib/precalcul-selection.js');
const { CHAMPIONNATS_DU_MARCHE, COUPES_DU_MARCHE } = await import('../src/lib/couche-marche.js');
const t = Date.now();
const r = await precalculerGrandsMatchs(900_000, { rafraichirLigues: new Set([...CHAMPIONNATS_DU_MARCHE, ...COUPES_DU_MARCHE]), joursEnPlus: 1, maxParPassage: 400 });
console.log(JSON.stringify({ ...r, details: r.details.slice(0, 5) }));
console.log(`durée : ${Math.round((Date.now() - t) / 1000)} s`);
