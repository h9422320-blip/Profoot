/**
 * ★ ACQUIS — LA BARRE « BUTS » NE CONTREDIT PLUS LES BUTS ATTENDUS.
 *
 * Constaté le 21 septembre 2026 sur Arsenal–Lille : « Buts 8 % contre 8 % »
 * au-dessus d'un encadré qui annonçait 4 buts attendus contre 0,4. Le chiffre
 * venait du modèle de langage, qui remplissait un champ dont personne ne lui
 * avait dit ce qu'il mesurait. Il vient désormais du moteur.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — la barre « Buts » est calculée à partir des buts attendus du moteur', () => {
  const s = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(
    s,
    /goals: \{ team1: part1, team2: 100 - part1 \}/,
    'La barre « Buts » est de nouveau laissée au modèle de langage.'
  );
  assert.match(s, /const part1 = Math\.round\(\(100 \* b1\) \/ \(b1 \+ b2\)\)/, 'La part des buts attendus n’est plus calculée.');
});
