/**
 * Premier calcul de la hiérarchie des championnats, en conditions réelles.
 *
 * Le même code que la tâche quotidienne, lancé à la main pour vérifier qu'il
 * tient dans le temps imparti et que ce qu'il range en réserve est utilisable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { recalculerForcesChampionnats, lireForcesChampionnats, coefficientDe, rapportEntreChampionnats, saisonsRecentes } =
  await jiti.import('./src/lib/forces-championnats.ts');

console.log(`\n  Saisons retenues : ${saisonsRecentes().join(' et ')}`);
console.log('  Collecte en cours...\n');

const debut = Date.now();
const forces = await recalculerForcesChampionnats(undefined, { forcer: true });
const duree = Date.now() - debut;

if (!forces) {
  console.log('  ÉCHEC — rien n a été enregistré.');
  process.exit(1);
}

console.log(`  ${forces.matchsUtilises} matchs lus, ${forces.confrontations} confrontations entre championnats.`);
console.log(`  ${Object.keys(forces.coefficients).length} compétitions notées, en ${Math.round(duree / 1000)} s.`);
console.log(`  (la tâche quotidienne dispose de 300 s)\n`);

const relu = await lireForcesChampionnats();
console.log(`  Relecture depuis la réserve : ${relu ? 'OK' : 'ÉCHEC'}`);
if (relu) {
  const identique = JSON.stringify(relu.coefficients) === JSON.stringify(forces.coefficients);
  console.log(`  Contenu identique à ce qui a été écrit : ${identique ? 'OUI' : 'NON'}\n`);
}

const noms = new Map([
  [39, 'Angleterre'], [140, 'Espagne'], [135, 'Italie'], [78, 'Allemagne'], [61, 'France'],
  [94, 'Portugal'], [88, 'Pays-Bas'], [144, 'Belgique'], [203, 'Turquie'], [179, 'Ecosse'],
  [116, 'Bielorussie'], [244, 'Finlande'], [113, 'Suede'], [383, 'Israel'], [119, 'Danemark'],
  [389, 'Kazakhstan'], [218, 'Autriche'], [197, 'Grece'], [106, 'Pologne'], [103, 'Norvege'],
]);

const tri = Object.entries(forces.coefficients).sort((a, b) => b[1] - a[1]);
console.log('  ══ HIÉRARCHIE EN SERVICE ══\n');
console.log('  championnat        brut    utilise');
console.log('  ' + '─'.repeat(40));
for (const paire of [...tri.slice(0, 8), null, ...tri.slice(-5)]) {
  if (paire === null) { console.log('  ' + '·'.repeat(18)); continue; }
  const [id, brut] = paire;
  console.log(
    `  ${(noms.get(Number(id)) ?? `ligue ${id}`).padEnd(18)} ${brut.toFixed(3).padStart(5)} ${coefficientDe(forces, id).toFixed(3).padStart(9)}`
  );
}

console.log('\n  ══ CE QUE ÇA CHANGE CONCRÈTEMENT ══\n');
for (const [a, b, texte] of [
  [39, 116, 'un club anglais contre un club bielorusse'],
  [140, 244, 'un club espagnol contre un club finlandais'],
  [39, 140, 'un club anglais contre un club espagnol'],
  [61, 61, 'deux clubs francais'],
]) {
  const r = rapportEntreChampionnats(forces, a, b);
  const effet = r === 1 ? 'aucun changement' : `buts attendus x${r.toFixed(2)} pour le premier, /${r.toFixed(2)} pour le second`;
  console.log(`  ${texte.padEnd(44)} ${effet}`);
}
console.log('');
