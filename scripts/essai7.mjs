/**
 * LES COEFFICIENTS SONT-ILS UNE VRAIE HIÉRARCHIE, OU DU BRUIT ?
 *
 * ── LE CONTRÔLE QUI TRANCHE ───────────────────────────────────────────────
 *
 * Si les coefficients décrivent quelque chose de réel — la force d'un
 * championnat — ils doivent se ressembler d'une saison à l'autre. On les
 * calcule donc DEUX FOIS, sur deux périodes qui ne partagent aucun match, et
 * on regarde s'ils s'accordent.
 *
 * S'ils divergent, ils ne mesurent que le hasard des tirages au sort, et le
 * gain de sept points serait un accident dont on ne reverrait jamais la
 * couleur.
 */
import { chargerMatchs } from './banc.mjs';
import { poissonAvance } from './modeles2.mjs';

const matchs = chargerMatchs();
const COUPURE = Date.parse('2025-08-01T00:00:00Z');

function coefficientsSur(liste) {
  const m = poissonAvance({ normaliserLigues: true, ponderationTemporelle: true, memoire: 60 });
  for (const x of liste) m.apprendre(x);
  return m.coefLigue;
}

const avant = coefficientsSur(matchs.filter((m) => Date.parse(m.date) < COUPURE));
const apres = coefficientsSur(matchs.filter((m) => Date.parse(m.date) >= COUPURE));

const communs = [...avant.keys()].filter((l) => apres.has(l));

// Corrélation de rang : c'est l'ORDRE qui compte, pas la valeur exacte.
const rangs = (map, cles) => {
  const tri = [...cles].sort((a, b) => map.get(b) - map.get(a));
  return new Map(tri.map((l, i) => [l, i + 1]));
};
const rA = rangs(avant, communs);
const rB = rangs(apres, communs);
const n = communs.length;
let sommeD2 = 0;
for (const l of communs) sommeD2 += (rA.get(l) - rB.get(l)) ** 2;
const spearman = 1 - (6 * sommeD2) / (n * (n * n - 1));

console.log(`\n  ${n} championnats comparés sur deux périodes sans aucun match commun.\n`);
console.log(`  Corrélation des classements : ${Math.round(spearman * 100) / 100}`);
console.log(
  `  ${spearman > 0.7 ? 'FORTE — la hiérarchie est réelle et se reproduit.'
    : spearman > 0.4 ? 'MOYENNE — une hiérarchie existe, mais elle bouge.'
      : 'FAIBLE — ce ne serait que du bruit.'}\n`
);

const noms = new Map([
  [39, 'Angleterre'], [140, 'Espagne'], [135, 'Italie'], [78, 'Allemagne'], [61, 'France'],
  [94, 'Portugal'], [88, 'Pays-Bas'], [144, 'Belgique'], [203, 'Turquie'], [179, 'Ecosse'],
  [218, 'Autriche'], [197, 'Grece'], [106, 'Pologne'], [119, 'Danemark'], [103, 'Norvege'],
  [113, 'Suede'], [345, 'Tchequie'], [283, 'Roumanie'], [389, 'Kazakhstan'], [172, 'Bulgarie'],
  [235, 'Russie'], [210, 'Croatie'], [271, 'Hongrie'], [164, 'Islande'], [244, 'Finlande'],
  [116, 'Bielorussie'], [383, 'Israel'], [419, 'Azerbaidjan'], [40, 'Angleterre D2'],
  [141, 'Espagne D2'], [357, 'Irlande'], [329, 'Estonie'], [365, 'Lettonie'], [362, 'Lituanie'],
]);

console.log('  ══ LES DEUX CALCULS, COTE A COTE ══\n');
console.log('  championnat        avant 08/2025   apres 08/2025   ecart');
console.log('  ' + '─'.repeat(62));
const tri = [...communs].sort((a, b) => apres.get(b) - apres.get(a));
for (const l of [...tri.slice(0, 8), null, ...tri.slice(-6)]) {
  if (l === null) { console.log('  ' + '·'.repeat(20)); continue; }
  const a = avant.get(l), b = apres.get(l);
  console.log(
    `  ${(noms.get(l) ?? `ligue ${l}`).padEnd(18)} ${a.toFixed(3).padStart(11)} ${b.toFixed(3).padStart(15)} ${(b - a > 0 ? '+' : '') + (b - a).toFixed(3)}`
  );
}
console.log('');
