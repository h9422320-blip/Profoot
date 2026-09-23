/**
 * ★ ACQUIS — LA SÉLECTION NE MONTRE QUE DES PREMIÈRES DIVISIONS.
 *
 * Décision du propriétaire le 5 septembre 2026, après que la section se soit
 * mise à proposer de la 2. Bundesliga. La règle avait disparu le 10 septembre
 * en passant du filtrage par nom au filtrage par numéro : la liste des
 * compétitions préparées est devenue celle du relevé des tirs, qui contient
 * le Championship, la Serie B, la Ligue 2 et la Segunda.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEUXIEMES_DIVISIONS, competitionRetenue } from '../src/lib/precalcul-selection';

test('★ ACQUIS — les deuxièmes divisions restent préparées mais jamais proposées', () => {
  for (const [id, nom] of [[40, 'Championship'], [136, 'Serie B'], [62, 'Ligue 2'], [141, 'Segunda'], [79, '2. Bundesliga']] as [number, string][]) {
    assert.ok(DEUXIEMES_DIVISIONS.has(id), `${nom} peut de nouveau être proposée dans « les matchs les mieux cernés ».`);
    assert.ok(competitionRetenue({ id }), `${nom} n’est plus préparée : l’abonné qui l’analyse perdrait le moteur complet.`);
  }
  for (const id of [39, 140, 135, 78, 61, 94, 88, 235]) {
    assert.ok(!DEUXIEMES_DIVISIONS.has(id), `Une première division (${id}) a été écartée de la sélection.`);
  }
  const s = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(s, /if \(DEUXIEMES_DIVISIONS\.has\(Number\(f\?\.league\?\.id\)\)\) continue;/);
});

test('★ ACQUIS — hors journée de championnat, la sélection complète avec les jours suivants', () => {
  // Le 23 septembre 2026 : la journée du lendemain ne portait qu'une carte,
  // Portugal–Pays de Galles, alors que le surlendemain en avait cinq déjà
  // calculées. La section s'arrêtait à la première journée trouvée.
  const s = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(s, /export const COMPLEMENT_MINIMUM = 4;/);
  assert.match(s, /const cumul: MatchSelectionne\[\] = await pourLeJour\(demain\);/);
  assert.match(s, /if \(cumul\.length >= COMPLEMENT_MINIMUM\) break;/);
  // Le seuil de fiabilité, lui, ne bouge pas : on n'ajoute que des rencontres
  // qui le franchissent déjà.
  assert.match(s, /export const FIABILITE_MINIMUM = 70;/);
});
