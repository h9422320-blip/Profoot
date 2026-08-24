/**
 * La version de production apprend-elle la même chose que le banc d'essai ?
 *
 * Deux implémentations qui divergent, c'est une des deux qui est fausse — et
 * on ne saurait pas laquelle. On les confronte sur les mêmes 22 443 matchs.
 */
import path from 'node:path';
import { createJiti } from 'jiti';
import { chargerMatchs } from './banc.mjs';
import { poissonAvance } from './modeles2.mjs';

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { apprendre, coefficientDe, rapportEntreChampionnats } = await jiti.import('./src/lib/forces-championnats.ts');

const matchs = chargerMatchs();

// La version de production.
const production = apprendre(matchs.map((m) => ({
  date: m.date, ligue: m.ligue, dom: m.dom, ext: m.ext, butsDom: m.butsDom, butsExt: m.butsExt,
})));

// Celle du banc.
const banc = poissonAvance({ normaliserLigues: true, ponderationTemporelle: true, memoire: 60 });
for (const m of matchs) banc.apprendre(m);

console.log(`\n  Production : ${production.matchsUtilises} matchs, ${production.confrontations} confrontations entre championnats.\n`);

const noms = new Map([
  [39, 'Angleterre'], [140, 'Espagne'], [135, 'Italie'], [78, 'Allemagne'], [61, 'France'],
  [94, 'Portugal'], [88, 'Pays-Bas'], [144, 'Belgique'], [203, 'Turquie'], [179, 'Ecosse'],
  [116, 'Bielorussie'], [244, 'Finlande'], [113, 'Suede'], [383, 'Israel'], [119, 'Danemark'],
]);

const cles = Object.keys(production.coefficients).map(Number);
const tri = cles.sort((a, b) => production.coefficients[b] - production.coefficients[a]);

console.log('  ══ HIERARCHIE APPRISE PAR LA PRODUCTION ══\n');
console.log('  championnat        brut     amorti   banc d essai   ecart');
console.log('  ' + '─'.repeat(62));
let ecartMax = 0;
for (const l of [...tri.slice(0, 8), null, ...tri.slice(-5)]) {
  if (l === null) { console.log('  ' + '·'.repeat(20)); continue; }
  const brut = production.coefficients[String(l)];
  const amorti = coefficientDe(production, l);
  const ref = banc.coefLigue.get(l);
  const ecart = ref === undefined ? null : Math.abs(brut - ref);
  if (ecart !== null) ecartMax = Math.max(ecartMax, ecart);
  console.log(
    `  ${(noms.get(l) ?? `ligue ${l}`).padEnd(18)} ${brut.toFixed(3).padStart(6)} ${amorti.toFixed(3).padStart(10)}` +
    ` ${(ref === undefined ? '—' : ref.toFixed(3)).padStart(12)} ${(ecart === null ? '' : ecart.toFixed(4)).padStart(8)}`
  );
}

console.log(`\n  Ecart maximal entre les deux implementations : ${ecartMax.toFixed(4)}`);
console.log(`  ${ecartMax < 0.01 ? 'IDENTIQUES — les deux calculs concordent.' : 'DIVERGENTES — a corriger avant toute mise en service.'}`);

console.log('\n  ══ LE RAPPORT APPLIQUE AUX BUTS ATTENDUS ══\n');
for (const [a, b] of [[39, 116], [140, 244], [39, 140], [78, 78]]) {
  const r = rapportEntreChampionnats(production, a, b);
  const na = noms.get(a) ?? `ligue ${a}`;
  const nb = noms.get(b) ?? `ligue ${b}`;
  console.log(`  ${na} contre ${nb} : buts attendus multiplies par ${r.toFixed(3)}`);
}
console.log('');
