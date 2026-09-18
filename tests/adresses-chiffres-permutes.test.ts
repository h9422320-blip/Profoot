/**
 * ★ ACQUIS — UNE ADRESSE RETAPÉE AVEC LES CHIFFRES DANS LE DÉSORDRE EST RECONNUE.
 *
 * 18 septembre 2026 : konem5633@gmail.com a payé, son compte est
 * konem3356@gmail.com (créé la veille, trois analyses cinq minutes après le
 * paiement). La règle des deux fautes ne le voyait pas (distance 4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chiffresPermutes, jumelleProbable } from '../src/lib/adresses-jumelles';

test('★ ACQUIS — mêmes lettres, mêmes chiffres dans un autre ordre', () => {
  assert.equal(chiffresPermutes('konem5633', 'konem3356'), true);
  assert.equal(chiffresPermutes('konem5633', 'konem5633'), false, 'La même adresse n’est pas une jumelle.');
  assert.equal(chiffresPermutes('konem5633', 'kanem3356'), false, 'Des lettres différentes : une autre personne.');
  assert.equal(chiffresPermutes('jean12', 'jean21'), false, 'Deux chiffres seulement : trop de risques de confusion.');
  assert.equal(chiffresPermutes('konem5633', 'konem3357'), false, 'Des chiffres différents : une autre personne.');
});

test('★ ACQUIS — la livraison pose l’accès sur ce compte, et seulement s’il est unique', () => {
  const compte = (email: string, creeLe = '2026-09-17T12:58:00Z') => ({ id: email, email, creeLe, aUnAccesActif: false }) as any;
  const trouve = jumelleProbable('konem5633@gmail.com', [compte('konem3356@gmail.com'), compte('autre@gmail.com')], '2026-09-18T13:04:00Z');
  assert.equal(trouve?.email, 'konem3356@gmail.com');
  // Deux candidates : on renonce.
  assert.equal(jumelleProbable('konem5633@gmail.com', [compte('konem3356@gmail.com'), compte('konem6335@gmail.com')], '2026-09-18T13:04:00Z'), null);
  // Autre domaine : jamais.
  assert.equal(jumelleProbable('konem5633@gmail.com', [compte('konem3356@yahoo.fr')], '2026-09-18T13:04:00Z'), null);
});
