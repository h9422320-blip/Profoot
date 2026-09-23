/**
 * ★ ACQUIS — LES PRÉVISIONS DE BUTS DISENT LA VÉRITÉ.
 *
 * Voir `src/lib/calibration-buts.ts` pour la mesure : 1 422 rencontres
 * réellement affichées puis jugées, coefficients ajustés sur la première
 * moitié, gain vérifié sur la seconde.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calibrerMarcheDeButs, COEFFICIENTS } from '../src/lib/calibration-buts';

test('★ ACQUIS — les affirmations les plus fortes sont ramenées vers la réalité', () => {
  // 83 % annoncé pour « plus de 2,5 buts » valait 67 % réels : la correction
  // doit descendre, sans s'effondrer.
  const fort = calibrerMarcheDeButs('plus25', 83);
  assert.ok(fort < 83 && fort > 65, `83 % corrigé donne ${fort} %.`);
  // 26 % annoncé valait 51 % : la correction doit monter.
  const faible = calibrerMarcheDeButs('plus25', 26);
  assert.ok(faible > 26 && faible < 50, `26 % corrigé donne ${faible} %.`);
  // Le milieu de l'échelle était juste : il ne doit presque pas bouger.
  assert.ok(Math.abs(calibrerMarcheDeButs('plus25', 50) - 50) <= 6);
});

test('★ ACQUIS — la correction garde un sens et ne casse jamais', () => {
  for (const m of Object.keys(COEFFICIENTS) as (keyof typeof COEFFICIENTS)[]) {
    for (const v of [0, 1, 50, 99, 100]) {
      const r = calibrerMarcheDeButs(m, v);
      assert.ok(r >= 0 && r <= 100, `${m} à ${v} % rend ${r}.`);
    }
    // Monotone : plus la prévision d'origine est forte, plus la corrigée l'est.
    let precedent = -1;
    for (let v = 0; v <= 100; v += 5) {
      const r = calibrerMarcheDeButs(m, v);
      assert.ok(r >= precedent, `${m} n’est plus croissant à ${v} %.`);
      precedent = r;
    }
  }
  // Un chiffre illisible ne devient pas un chiffre inventé.
  assert.ok(Number.isNaN(calibrerMarcheDeButs('plus25', 'abc' as any)));
});

test('★ ACQUIS — l’analyse sert les prévisions de buts CALIBRÉES', () => {
  const s = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(s, /over25: calibrerMarcheDeButs\('plus25', scoreCalcule\.probaPlusDe\.deuxCinq\)/);
  assert.match(s, /yes: calibrerMarcheDeButs\('lesDeuxMarquent', scoreCalcule\.probaLesDeuxMarquent\)/);
  // Et le vainqueur annoncé ne passe PAS par là.
  assert.doesNotMatch(s, /probaVictoire1: calibrerMarcheDeButs/);
});

test('★ ACQUIS — la cage inviolée est calibrée elle aussi', () => {
  // Annoncée à 64 %, elle n'arrivait que 39 fois sur 100.
  assert.ok(calibrerMarcheDeButs('cageInviolee', 64) < 64);
  assert.ok(calibrerMarcheDeButs('cageInviolee', 6) > 6);
  const s = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(s, /team1: calibrerMarcheDeButs\('cageInviolee', scoreCalcule\.probaCageInviolee1\)/);
  assert.match(s, /team2: calibrerMarcheDeButs\('cageInviolee', scoreCalcule\.probaCageInviolee2\)/);
});
