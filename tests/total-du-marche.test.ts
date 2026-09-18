/**
 * ★ ACQUIS — LE NOMBRE DE BUTS DES CHIFFRES AFFICHÉS EST RECALÉ SUR LE MARCHÉ.
 *
 * Mesuré le 18 septembre 2026 sur 10 611 rencontres de seize championnats :
 * Brier « plus de 2,5 » 0,2557 → 0,2416 ; et les chiffres NON cotés suivent —
 * les deux marquent 0,2556 → 0,2461, plus de 1,5 0,1881 → 0,1789, plus de 3,5
 * 0,2091 → 0,1996.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreProbable } from '../src/lib/score-probable';
import { extraireCotes } from '../src/lib/cotes-marche';

const dom = { butsMarques: 26, butsEncaisses: 18, matchsJoues: 15 };
const ext = { butsMarques: 20, butsEncaisses: 22, matchsJoues: 15 };
const occ = { domicile: 1.5, exterieur: 1.1 };
const appel = (p?: number | null) =>
  calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, null, null, null, null, p);

test('★ ACQUIS — sans total du marché, le moteur rend exactement ce qu’il rendait', () => {
  const reference = calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ);
  assert.deepEqual(appel(undefined), reference);
  assert.deepEqual(appel(null), reference);
});

test('★ ACQUIS — le total du marché recale les buts, jamais le vainqueur', () => {
  const sans: any = appel(null);
  const avec: any = appel(0.72);
  // « Plus de 2,5 » rejoint le marché, au point près.
  assert.ok(Math.abs(avec.probaPlusDe.deuxCinq - 72) <= 1.5, `« Plus de 2,5 » vaut ${avec.probaPlusDe.deuxCinq} au lieu de 72.`);
  assert.ok(avec.probaLesDeuxMarquent > sans.probaLesDeuxMarquent, 'Les chiffres non cotés ne suivent plus le total.');
  // Les issues, la confiance et le score ne bougent pas.
  assert.equal(avec.probaVictoire1, sans.probaVictoire1);
  assert.equal(avec.probaNul, sans.probaNul);
  assert.equal(avec.probaVictoire2, sans.probaVictoire2);
  assert.equal(avec.confiance, sans.confiance);
  assert.deepEqual([avec.buts1, avec.buts2], [sans.buts1, sans.buts2]);
});

test('★ ACQUIS — le relevé lit le marché des buts dans la même réponse', () => {
  const maison = (o: number, u: number) => ({
    bets: [
      { name: 'Match Winner', values: [{ value: 'Home', odd: '2.10' }, { value: 'Draw', odd: '3.40' }, { value: 'Away', odd: '3.50' }] },
      { name: 'Goals Over/Under', values: [{ value: 'Over 2.5', odd: String(o) }, { value: 'Under 2.5', odd: String(u) }] },
    ],
  });
  const [m] = extraireCotes([{ league: { id: 39 }, fixture: { id: 1, date: '2026-09-19T14:00:00Z' }, bookmakers: [maison(1.8, 2.0), maison(1.85, 1.95)] }]);
  assert.ok(m && typeof m.plusDeDeuxCinq === 'number', 'Le marché des buts n’est plus extrait.');
  assert.ok(m.plusDeDeuxCinq! > 0.5 && m.plusDeDeuxCinq! < 0.56);
});
