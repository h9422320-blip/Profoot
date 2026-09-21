/**
 * ★ ACQUIS — LA FORCE DES SÉLECTIONS NATIONALES.
 *
 * Un classement Elo sur 9 819 matchs internationaux depuis 2014. Mesuré en
 * marche avant sur 4 626 matchs de 2022 à 2026 : 53,2 → 57,2 % de vainqueurs
 * justes, Brier 0,5862 → 0,5438, à la part 0,75. Voir `forces-selections.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avisEloPour, PART_ELO_SELECTIONS, type ReserveEloSelections } from '../src/lib/forces-selections';

// Une réserve miniature : des tranches où la victoire à domicile croît avec l'écart.
const tranches: Record<string, [number, number, number]> = {};
for (let k = -12; k <= 12; k++) {
  const dom = 40 + 4 * k;
  tranches[String(k)] = [Math.max(1, dom), 25, Math.max(1, 100 - dom - 25)];
}
const reserve: ReserveEloSelections = {
  calculeLe: '2026-09-21',
  notes: { '1501': 1808, '1504': 1635, '9999': 1700 },
  joues: { '1501': 146, '1504': 127, '9999': 3 },
  tranches,
};

test('★ ACQUIS — la plus forte sélection est favorite, avec la part mesurée', () => {
  const a = avisEloPour(reserve, 1501, 1504, 36)!;
  assert.ok(a, 'La couche se tait sur deux sélections connues.');
  assert.ok(a.dom > a.ext, 'La Côte d’Ivoire n’est plus favorite contre le Ghana.');
  assert.equal(a.poids, PART_ELO_SELECTIONS);
  assert.equal(PART_ELO_SELECTIONS, 0.75, 'La part mesurée (0,75) a changé sans nouvelle mesure.');
  const somme = a.dom + a.nul + a.ext;
  assert.ok(Math.abs(somme - 1) < 1e-9, 'Les probabilités ne somment plus à 1.');
});

test('★ ACQUIS — en phase finale, le terrain est neutre', () => {
  const qualif = avisEloPour(reserve, 1501, 1504, 36)!;
  const can = avisEloPour(reserve, 1501, 1504, 6)!;
  assert.ok(can.dom < qualif.dom, 'L’avantage du terrain est compté en phase finale de CAN.');
});

test('★ ACQUIS — elle se tait quand elle ne sait pas', () => {
  assert.equal(avisEloPour(reserve, 1501, 9999, 36), null, 'Une sélection à trois matchs connus fait parler la couche.');
  assert.equal(avisEloPour(reserve, 33, 42, 39), null, 'La couche parle sur un match de clubs.');
  assert.equal(avisEloPour(null, 1501, 1504, 36), null, 'Une réserve absente fait parler la couche.');
});

test('★ ACQUIS — l’analyse passe l’avis Elo après le marché et avant la mémoire des clubs', () => {
  const s = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(s, /avisDuMarche \?\?\s*avisEloSelections \?\?\s*\(occasionsDuMatch/, 'L’ordre marché → Elo → mémoire a changé.');
  assert.match(
    s,
    /coucheEloSelections\(\s*equipe1AJoueADomicile === false \? id2 : id1,\s*equipe1AJoueADomicile === false \? id1 : id2,/,
    'L’avis Elo n’est plus vu de l’équipe qui reçoit : il favoriserait la mauvaise sélection.'
  );
});
