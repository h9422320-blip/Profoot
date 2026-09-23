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

test('★ ACQUIS — une carte que le marché contredit n’est pas montrée', () => {
  // Mesuré le 23 septembre 2026 sur 283 cartes figées et jouées depuis trois
  // mois : 70,3 % de bons vainqueurs, mais 25,0 % sur les 12 rencontres où le
  // marché désignait l'autre camp. Les deux moitiés chronologiques gagnent :
  // 59,5 → 62,8 % et 78,4 → 79,1 %.
  const s = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(s, /const marcheContredit = async \(/);
  assert.match(s, /if \(\s*await marcheContredit\(/, 'Le filtre du marché n’est plus appliqué à la sélection.');
  assert.match(
    s,
    /return \(probaDom >= probaExt \? 'dom' : 'ext'\) !== \(c\.dom >= c\.ext \? 'dom' : 'ext'\);/,
    'La comparaison des deux favoris a changé.'
  );
});
