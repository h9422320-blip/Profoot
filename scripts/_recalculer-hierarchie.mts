/**
 * RECALCULER LA HIÉRARCHIE DES CHAMPIONNATS, À LA DEMANDE.
 *
 * Le calcul lit près de deux cents pages chez le fournisseur et dure environ
 * deux minutes : il ne tient pas dans les soixante secondes que l'hébergeur
 * accorde à une fonction, et la tâche de minuit ne l'atteint jamais — il y est
 * la quatrième étape, derrière la vérification des pronostics et le mur de
 * preuves. Il se fait donc ici, sans limite de temps.
 *
 *   npx tsx scripts/_recalculer-hierarchie.mts [--forcer]
 *
 * Sans `--forcer`, une hiérarchie de moins de sept jours est conservée.
 */
import { chargerEnv } from './challenger/commun.mjs';

chargerEnv();
const { recalculerForcesChampionnats, lireForcesChampionnats } = await import('../src/lib/forces-championnats.js');

const avant = await lireForcesChampionnats();
const age = (quand: string) => Math.round((Date.now() - Date.parse(quand)) / 86_400_000);
if (avant) console.log(`hiérarchie actuelle : calculée le ${String(avant.calculeLe).slice(0, 10)}, il y a ${age(avant.calculeLe)} jour(s)`);
else console.log('aucune hiérarchie en réserve');

const debut = Date.now();
const apres = await recalculerForcesChampionnats(undefined, { forcer: process.argv.includes('--forcer') });
console.log(`terminé en ${Math.round((Date.now() - debut) / 1000)} s`);

if (!apres) {
  console.log('aucune hiérarchie rendue');
  process.exit(1);
}
const liste = Object.entries(apres.coefficients ?? {})
  .map(([id, force]) => ({ id, force: Number(force) }))
  .filter((x) => Number.isFinite(x.force))
  .sort((a, b) => b.force - a.force);
console.log(
  `calculée le ${String(apres.calculeLe).slice(0, 19)} — ${liste.length} championnat(s), ` +
    `${apres.matchsUtilises} matchs utilisés, ${apres.confrontations} confrontation(s) entre championnats`
);
console.log('les mieux cotés :');
for (const x of liste.slice(0, 8)) console.log(`  ligue ${x.id} : ${x.force.toFixed(3)}`);
console.log('les moins bien cotés :');
for (const x of liste.slice(-5)) console.log(`  ligue ${x.id} : ${x.force.toFixed(3)}`);
