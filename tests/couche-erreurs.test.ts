/**
 * ★ ACQUIS — LA COUCHE DES ERREURS APPRISES S'AJOUTE, ELLE NE REMPLACE RIEN.
 *
 * Décision du propriétaire, le 11 septembre 2026 : le moteur ne s'améliore
 * que par couches nouvelles, et aucun réglage existant n'est touché. Ces
 * assertions garantissent que, sans la couche, le moteur rend EXACTEMENT ce
 * qu'il rendait — au centième près, sur tous ses chiffres.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculerScoreProbable } from '../src/lib/score-probable';
import { apprendreErreurs, correctionPour } from '../src/lib/couche-erreurs';

const dom = { butsMarques: 30, butsEncaisses: 18, matchsJoues: 15 };
const ext = { butsMarques: 20, butsEncaisses: 22, matchsJoues: 15 };
const occ = { domicile: 1.6, exterieur: 1.1 };
const appel = (couche?: { domicile: number; exterieur: number } | null) =>
  calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, couche);

test('★ ACQUIS — sans la couche, le moteur rend exactement ce qu’il rendait', () => {
  const reference = calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ);
  assert.deepEqual(appel(undefined), reference, 'Le moteur a changé alors que la couche est absente.');
  assert.deepEqual(appel(null), reference, 'Une couche nulle change le moteur.');
  assert.deepEqual(appel({ domicile: 0, exterieur: 0 }), reference, 'Une couche à zéro change le moteur.');
});

test('★ ACQUIS — la couche agit dans le bon sens, et reste bornée', () => {
  const reference = appel(null);
  const plus = appel({ domicile: 0.3, exterieur: 0 });
  assert.ok(plus.butsAttendus1 > reference.butsAttendus1, 'Une correction positive n’augmente pas les buts attendus.');
  assert.equal(plus.butsAttendus2, reference.butsAttendus2, 'La correction d’une équipe déborde sur l’autre.');
  const excessive = appel({ domicile: 9, exterieur: -9 });
  assert.ok(excessive.butsAttendus1 - reference.butsAttendus1 <= 0.5 + 1e-9, 'Une correction dépasse le demi-but.');
});

test('★ ACQUIS — la leçon d’un club se mesure sur ses propres matchs', () => {
  const clubs = apprendreErreurs([
    { dom: '1', ext: '2', attenduDom: 1.0, attenduExt: 1.0, reelDom: 2, reelExt: 0 },
    { dom: '1', ext: '3', attenduDom: 1.0, attenduExt: 1.0, reelDom: 2, reelExt: 1 },
  ]);
  assert.deepEqual(clubs.get('1'), { n: 2, attaque: 1, defense: -0.5 });
  assert.deepEqual(clubs.get('2'), { n: 1, attaque: -1, defense: 1 });
  // Un club jamais jugé ne produit aucune correction : le moteur ne change rien.
  assert.equal(correctionPour(clubs, '8', '9', { retrecissement: 10, poids: 1 }), null);
  // La leçon est modérée par le nombre de matchs qui l'ont enseignée.
  const faible = correctionPour(clubs, '1', '9', { retrecissement: 10, poids: 1 })!;
  const forte = correctionPour(clubs, '1', '9', { retrecissement: 0.0001, poids: 1 })!;
  assert.ok(Math.abs(faible.domicile) < Math.abs(forte.domicile), 'Deux matchs pèsent autant que deux cents.');
});

test('★ ACQUIS — la couche est posée après tout le calcul existant', () => {
  const s = fs.readFileSync('src/lib/score-probable.ts', 'utf8');
  const iMelange = s.indexOf('let butsAttendus2 = melanger(');
  const iCouche = s.indexOf('if (correctionErreurs && equipe1AJoueADomicile !== null)');
  assert.ok(iMelange > 0 && iCouche > iMelange, 'La couche n’est plus posée après le mélange des occasions.');
  assert.match(
    s,
    /correctionErreurs\?: \{ domicile: number; exterieur: number \} \| null\r?\n\): ScoreProbable \{/,
    'Le paramètre de la couche n’est plus le dernier : un appel existant pourrait changer de sens.'
  );
});
