/**
 * ★ ACQUIS — LA COUCHE DU MATCH RETOUR EST CONSTRUITE, MESURÉE, ET ÉTEINTE.
 *
 * Mesurée le 17 septembre 2026 sur 963 matchs retour : +9/+4 vainqueurs justes
 * au réglage nul −30 % et avantage +0,08, mais les meilleurs matchs du jour
 * reculent (−0,1 et −0,2 point). Laissée éteinte. Tant qu'elle l'est, le moteur
 * doit rendre exactement ce qu'il rendait.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreProbable } from '../src/lib/score-probable';

const dom = { butsMarques: 22, butsEncaisses: 18, matchsJoues: 15 };
const ext = { butsMarques: 20, butsEncaisses: 19, matchsJoues: 15 };
const occ = { domicile: 1.3, exterieur: 1.2 };

test('★ ACQUIS — éteinte, la couche du match retour ne change rien', () => {
  const reference = calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, null);
  const retour = calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, null, true);
  assert.deepEqual(retour, reference, 'La couche du match retour agit alors qu’elle est éteinte.');
});
