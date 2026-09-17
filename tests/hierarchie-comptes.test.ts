/**
 * ★ ACQUIS — LA HIÉRARCHIE PORTE LE NOMBRE DE CONFRONTATIONS, ET N'EN RETIRE RIEN.
 *
 * Mesuré le 17 septembre 2026 : ramener le coefficient d'un championnat vers 1
 * quand il repose sur peu de confrontations européennes FAIT PERDRE des
 * vainqueurs (−2/+0, −3/−3, −3/−2, −3/−3 aux retraits 30, 60, 120 et 250), avec
 * un Brier moins bon partout. Les coefficients appris portent donc un vrai
 * signal, même sur 16 confrontations. Le retrait reste ÉTEINT.
 *
 * Les comptes, eux, sont conservés : ils rendent la mesure possible, et le banc
 * d'essai les transmet (sans eux, la mesure rendait exactement zéro — piège
 * attrapé le jour même).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { coefficientDe, rapportEntreChampionnats } from '../src/lib/forces-championnats';

const hierarchie = {
  coefficients: { '39': 1.5667, '404': 0.8185 },
  calculeLe: new Date().toISOString(),
  matchsUtilises: 34101,
  confrontations: 2987,
  confrontationsParLigue: { '39': 439, '404': 16 },
};

test('★ ACQUIS — éteint, le retrait par manque de confrontations ne change rien', () => {
  // 1,5667 ^ 0,7 = 1,3703 : l'amortissement seul, sans retrait.
  assert.equal(Math.round(coefficientDe(hierarchie, 39) * 10000) / 10000, Math.round(Math.pow(1.5667, 0.7) * 10000) / 10000);
  assert.equal(Math.round(coefficientDe(hierarchie, 404) * 10000) / 10000, Math.round(Math.pow(0.8185, 0.7) * 10000) / 10000);
  // Un championnat de 16 confrontations n'est donc pas ramené vers 1.
  assert.ok(coefficientDe(hierarchie, 404) < 0.9, 'Le retrait agit alors qu’il est éteint.');
  assert.ok(rapportEntreChampionnats(hierarchie, 39, 404) > 1.4);
});

test('★ ACQUIS — le banc d’essai transmet les comptes de confrontations', () => {
  const s = fs.readFileSync('scripts/challenger/commun.mts', 'utf8');
  assert.match(s, /confrontationsParLigue: contenu\.confrontationsParLigue/, 'Le banc ne transmet plus les comptes : toute mesure de retrait rendrait zéro.');
});

test('★ ACQUIS — le réglage est relu à chaque appel, jamais figé au chargement', () => {
  const s = fs.readFileSync('src/lib/forces-championnats.ts', 'utf8');
  assert.match(s, /const minimumDeConfrontations = \(\) => Number\(process\.env\.BANC_HIERARCHIE_MINIMUM \?\? 0\);/,
    'Figé au chargement, le réglage rend la mesure nulle : le banc pose ses variables après l’import.');
});
