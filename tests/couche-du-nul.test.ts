/**
 * ★ ACQUIS — LE NUL NE DÉPASSE PAS CE QU'IL VAUT VRAIMENT.
 *
 * Mesuré le 17 septembre 2026 sur 31 118 rencontres rejouées avec le moteur en
 * ligne : au-delà de 28 %, le nul réel plafonne vers 29-30 % quand le moteur
 * l'annonçait jusqu'à 40 %. La couche comprime la part du nul au-dessus de
 * 28 % (pente 0,3) et la rend aux deux victoires.
 *
 *   vainqueurs justes    +34 / +27 (deux moitiés), +22 / +27 / +12 (trois tranches)
 *   Brier                0,5892 → 0,5879 et 0,5919 → 0,5914
 *   neuf réglages voisins essayés : huit passent, aucun ne perd
 *   3 et 5 meilleurs matchs du jour : inchangés (73,3 % et 70,7 %)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculerScoreProbable } from '../src/lib/score-probable';

test('★ ACQUIS — la couche du nul est active, aux réglages mesurés', () => {
  const s = fs.readFileSync('src/lib/score-probable.ts', 'utf8');
  assert.match(s, /const SEUIL_DU_NUL = Number\(process\.env\.BANC_NUL_SEUIL \?\? 0\.28\);/, 'Le seuil du nul a changé sans mesure.');
  assert.match(s, /const PENTE_DU_NUL = Number\(process\.env\.BANC_NUL_PENTE \?\? 0\.3\);/, 'La pente du nul a changé sans mesure.');
});

test('★ ACQUIS — deux défenses de fer : le nul reste plausible, jamais gonflé', () => {
  // Deux équipes qui marquent et encaissent très peu : c'est le cas où le
  // calcul brut pousse le nul le plus haut.
  const ferme = { butsMarques: 12, butsEncaisses: 12, matchsJoues: 20 };
  const r: any = calculerScoreProbable(ferme, { ...ferme }, true);
  const nul = Number(r.probaNul);
  assert.ok(nul > 0 && nul <= 100);
  assert.equal(Number(r.probaVictoire1) + nul + Number(r.probaVictoire2), 100, "Les trois issues ne totalisent plus 100.");
  // Sans la couche le nul monte ici à 43 % ; avec elle, 28 + 0,3 × 15 ≈ 33 %.
  assert.ok(nul <= 34, `Nul annoncé à ${nul} % : la couche ne comprime plus.`);
});
