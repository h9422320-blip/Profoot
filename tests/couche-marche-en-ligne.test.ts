/**
 * ★ ACQUIS — L'AVIS DU MARCHÉ EST BRANCHÉ SUR LES SEPT GRANDS CHAMPIONNATS.
 *
 * Mesuré le 18 septembre 2026 sur 4 577 rencontres (cotes d'avant-match de
 * football-data.co.uk, moyenne des bookmakers, jamais la clôture) :
 * vainqueurs +53/+54 sur les deux moitiés, +39/+36/+32 sur trois tranches,
 * matchs sûrs 72,0/73,5 %, 3 mis en avant par jour 66,0 → 68,6 %.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avisDuMarchePour, avisDuMarcheBranche, CHAMPIONNATS_DU_MARCHE, COUPES_DU_MARCHE, PART_DU_MARCHE } from '../src/lib/couche-marche';

test('★ ACQUIS — le marché ne parle QUE sur les sept grands championnats', async () => {
  // Les sept grands, puis neuf championnats mesurés le même jour (6 034 rencontres, +137).
  assert.deepEqual([...CHAMPIONNATS_DU_MARCHE].sort((a, b) => a - b), [39, 40, 61, 62, 78, 79, 88, 94, 135, 136, 140, 141, 144, 179, 197, 203]);
  // Les coupes d'Europe depuis le 18 septembre 2026 : sur 68 matchs joués, le
  // favori du marché 42 justes contre 32 pour le moteur (16 contre 6 quand ils divergent).
  assert.deepEqual([...COUPES_DU_MARCHE].sort((a, b) => a - b), [2, 3, 848]);
  assert.ok(avisDuMarcheBranche(2) && avisDuMarcheBranche(3) && avisDuMarcheBranche(848) && avisDuMarcheBranche(39));
  // Autres compétitions, match sans date : silence.
  assert.equal(avisDuMarcheBranche(283), false);
  assert.equal(await avisDuMarchePour(123, '2026-09-19T14:00:00Z', 283), null);
  assert.equal(await avisDuMarchePour(123, null, 39), null);
  assert.equal(PART_DU_MARCHE, 1);
});

test('★ ACQUIS — l’analyse et la sélection lisent le marché, puis la mémoire à défaut', () => {
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(route, /avisDuMarchePour\(\s*targetFutureMatch\?\.fixture\?\.id,/, 'L’analyse ne lit plus l’avis du marché.');
  assert.match(route, /avisDuMarche \?\?\s*\(occasionsDuMatch/, 'Le marché ne passe plus avant la mémoire des clubs.');
  const selection = fs.readFileSync('src/lib/precalcul-selection.ts', 'utf8');
  assert.match(selection, /\(await avisDuMarchePour\(f\?\.fixture\?\.id, f\?\.fixture\?\.date, ligue\)\) \?\?/,
    'La sélection du jour ne lit plus l’avis du marché : sa carte contredirait l’analyse.');
});

test('★ ACQUIS — le moteur lit sa journée de cotes avec patience, et une seule fois', () => {
  // Le 18 septembre 2026, Werder Brême — Augsbourg a été figé par l'analyse
  // SANS le marché : la lecture de la journée avait dépassé une seconde et demie.
  const s = fs.readFileSync('src/lib/couche-marche.ts', 'utf8');
  assert.match(s, /lireCotesDuJourPatiemment\(jour\)/, 'Le moteur relit ses cotes avec le garde-temps court : le marché peut se perdre en silence.');
  assert.match(s, /const DUREE_JOURNEE_MS = 10 \* 60 \* 1000;/, 'La journée de cotes n’est plus gardée en mémoire.');
});
