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

test('★ ACQUIS — après correction, les seuils restent dans l’ordre', () => {
  // Chaque seuil a ses propres coefficients : rien n'empêcherait, en théorie,
  // « plus de 1,5 but » de dépasser « plus de 0,5 but » et de rendre l'écran
  // absurde. Vérifié sur toute la plage réaliste de buts attendus.
  for (let xg = 0.5; xg <= 5.001; xg += 0.05) {
    const p = (k: number) => (Math.exp(-xg) * Math.pow(xg, k)) / [1, 1, 2, 6][k];
    const o05 = 1 - p(0);
    const brut = [o05, o05 - p(1), o05 - p(1) - p(2), o05 - p(1) - p(2) - p(3)].map((x) =>
      Math.round(x * 100)
    );
    const c = [
      calibrerMarcheDeButs('plus05', brut[0]),
      calibrerMarcheDeButs('plus15', brut[1]),
      calibrerMarcheDeButs('plus25', brut[2]),
      calibrerMarcheDeButs('plus35', brut[3]),
    ];
    for (let i = 1; i < 4; i++) {
      assert.ok(
        c[i] <= c[i - 1],
        `Pour ${xg.toFixed(2)} but(s) attendu(s) : ${brut.join('/')} devient ${c.join('/')}.`
      );
    }
  }
});

/**
 * ── LE RÉAJUSTEMENT DU 29 SEPTEMBRE 2026 ──────────────────────────────────
 *
 * Les coefficients d'origine avaient été ajustés sur 711 rencontres. Le banc
 * en rejoue 3 090 : de quoi les remesurer. Chaque marché a été ajusté sur une
 * moitié et jugé sur l'autre, DANS LES DEUX SENS. Deux ont gagné des deux
 * côtés, deux ont gagné d'un côté et perdu de l'autre — ceux-là gardent leurs
 * coefficients d'origine.
 *
 * Sur la moitié jamais utilisée pour l'ajustement :
 *     plus de 1,5 but  ... 0,1651 → 0,1635  (brut 0,1656)
 *     plus de 3,5 buts ... 0,2220 → 0,2190  (brut 0,2214)
 *
 * « Plus de 3,5 buts » faisait MOINS BIEN que ne rien faire : son ancien
 * calibrage était pire que le brut.
 */
test('★ ACQUIS — les deux marchés réajustés le sont dans le bon sens', () => {
  // Un `b` bas resserre : c'est ce que la mesure demande, puisque les
  // pourcentages annoncés sont trop étalés dans les deux marchés retenus.
  assert.ok(COEFFICIENTS.plus15.b < 0.6, `plus15 ne resserre plus (b = ${COEFFICIENTS.plus15.b}).`);
  assert.ok(COEFFICIENTS.plus35.b < 0.6, `plus35 ne resserre plus (b = ${COEFFICIENTS.plus35.b}).`);

  // Les deux marchés REFUSÉS gardent leurs coefficients d'origine : ils
  // gagnaient dans un sens et perdaient dans l'autre.
  assert.deepEqual(COEFFICIENTS.plus25, { a: 0.2, b: 0.75 }, 'plus25 a été réajusté alors que l’épreuve l’a refusé.');
  assert.deepEqual(COEFFICIENTS.lesDeuxMarquent, { a: 0, b: 0.75 }, 'lesDeuxMarquent a été réajusté alors que l’épreuve l’a refusé.');
});

test('★ ACQUIS — le resserrage rapproche du taux réellement observé', () => {
  // Mesuré par tranche sur 3 090 rencontres : « plus de 1,5 but » annoncé
  // 40-50 % arrive 70,4 % ; annoncé 80-100 % arrive 82,9 %. La vraie plage est
  // bien plus étroite que celle annoncée.
  const bas = calibrerMarcheDeButs('plus15', 45);
  const haut = calibrerMarcheDeButs('plus15', 90);
  assert.ok(bas >= 60 && bas <= 75, `45 % brut devrait ressortir vers 70 %, il ressort ${bas} %.`);
  assert.ok(haut >= 78 && haut <= 88, `90 % brut devrait ressortir vers 83 %, il ressort ${haut} %.`);
  assert.ok(haut - bas < 45 - 90 + 90, 'La plage annoncée ne s’est pas resserrée.');

  // « Plus de 3,5 buts » annoncé 60-70 % arrive 45,6 %.
  const t = calibrerMarcheDeButs('plus35', 65);
  assert.ok(t >= 40 && t <= 52, `65 % brut devrait ressortir vers 46 %, il ressort ${t} %.`);
});

test('★ ACQUIS — la mesure reste écrite à côté des coefficients', () => {
  const src = fs.readFileSync('src/lib/calibration-buts.ts', 'utf8');
  assert.match(src, /DANS LES DEUX SENS/, 'La discipline des deux sens a disparu du fichier.');
  // Les commentaires sont coupés à 80 colonnes : l'épreuve tolère le retour
  // à la ligne, sinon elle casse au premier reformatage.
  assert.match(src, /moins bien que ne\s+\*?\s*rien faire/, 'Le constat sur « plus de 3,5 buts » a disparu.');
  // Et la raison pour laquelle « plus de 3,5 buts » n'a PAS son optimum :
  // l'ajustement libre cassait l'ordre des seuils.
  assert.match(src, /CASSAIT L'ORDRE DES/, 'La raison du coefficient sous contrainte a disparu.');
});
