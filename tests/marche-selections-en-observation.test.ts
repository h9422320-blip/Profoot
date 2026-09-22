/**
 * ★ ACQUIS — LE MARCHÉ DES SÉLECTIONS EST RELEVÉ, PAS ENCORE BRANCHÉ.
 *
 * Depuis le 22 septembre 2026. La note Elo des sélections est mesurée ; le
 * marché ne l'est pas encore sur ces compétitions. Il ne passera devant
 * qu'après `scripts/_marche-selections.mts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avisDuMarcheBranche, MARCHE_EN_OBSERVATION } from '../src/lib/couche-marche';
import { SELECTIONS_COTEES_EN_OBSERVATION } from '../src/lib/cotes-marche';

test('★ ACQUIS — le marché ne décide pas sur les compétitions en observation', () => {
  for (const id of [36, 5, 536]) {
    assert.ok(MARCHE_EN_OBSERVATION.has(id));
    assert.equal(avisDuMarcheBranche(id), false, `Le marché décide sur ${id} sans avoir été mesuré.`);
  }
  // Et rien ne change ailleurs.
  for (const id of [39, 140, 2, 6, 106]) assert.equal(avisDuMarcheBranche(id), true);
});

test('★ ACQUIS — leurs cotes sont relevées, chacune sous sa propre saison', () => {
  assert.deepEqual([...SELECTIONS_COTEES_EN_OBSERVATION].sort(), [36, 5, 536].sort());
  const s = fs.readFileSync('src/lib/cotes-marche.ts', 'utf8');
  assert.match(s, /for \(const s of \[saison, saison \+ 1, saison - 1\]\)/);
  assert.match(s, /paquet\.map\(\(l\) => coterAvecSaSaison\(l, saison\)\)/);
});
