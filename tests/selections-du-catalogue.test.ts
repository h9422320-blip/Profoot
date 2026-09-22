/**
 * ★ ACQUIS — LES SÉLECTIONS DU CATALOGUE, PAR LEUR NUMÉRO VÉRIFIÉ.
 *
 * Voir `src/lib/selections-du-catalogue.ts`. Sans cette table, la sélection du
 * jour ne pouvait proposer aucune rencontre de sélections, et l'analyse
 * retrouvait « Angleterre » par une recherche de nom.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { catalogueDeSelection, numeroDeSelection } from '../src/lib/selections-du-catalogue';
import { clubs } from '../src/lib/data';
import { COMPETITIONS_DE_SELECTIONS_PREPAREES, competitionRetenue } from '../src/lib/precalcul-selection';

test('★ ACQUIS — chaque sélection de la table existe dans le catalogue', () => {
  for (const n of [2, 10, 9, 25, 26, 6, 768, 27, 770, 2384, 16, 1501, 13, 31]) {
    const c = catalogueDeSelection(n);
    assert.ok(c && clubs[c], `Le numéro ${n} ne mène à aucune sélection du catalogue (${c}).`);
    assert.equal(numeroDeSelection(c), n, `L'aller-retour ${n} → ${c} ne revient pas au même numéro.`);
  }
  assert.equal(catalogueDeSelection(2), 'france');
  assert.equal(catalogueDeSelection(10), 'england');
  assert.equal(numeroDeSelection('arsenal'), null, 'Un club ne doit jamais passer pour une sélection.');
  assert.equal(catalogueDeSelection(999_999), null);
});

test('★ ACQUIS — les sélections africaines gardent leurs identifiants de CAN', () => {
  assert.equal(catalogueDeSelection(1501), 'ivory_coast_can');
  assert.equal(catalogueDeSelection(13), 'senegal_can');
});

test('★ ACQUIS — les Ligues des nations sont préparées, pas les amicaux', () => {
  for (const id of [36, 6, 5, 536]) {
    assert.ok(COMPETITIONS_DE_SELECTIONS_PREPAREES.has(id));
    assert.ok(competitionRetenue({ id }), `La compétition ${id} n’est plus préparée.`);
  }
  assert.ok(!competitionRetenue({ id: 10 }), 'Les matchs amicaux, pleins d’équipes de jeunes, sont entrés.');
});

test('★ ACQUIS — la sélection du jour et l’analyse lisent la même table', () => {
  const sel = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(sel, /enSelections \? clubs\[catalogueDeSelection\(/, 'La sélection du jour ne retrouve plus les sélections.');
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  const i = route.indexOf('numeroDeSelection(team.id)');
  assert.ok(i > 0 && i < route.indexOf('selectionParNom(team.name)'), 'L’analyse ne passe plus d’abord par la table vérifiée.');
});

test('★ ACQUIS — pendant la trêve, la sélection regarde d’abord les jours proches', () => {
  // Sans cela, le 22 septembre 2026, elle proposait le 9 octobre et sautait
  // les Ligues des nations et la CAN du 24, pourtant préparées.
  const sel = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(sel, /\[2, 3, 4, 5\]\.map\(\(d\) => new Date\(Date\.now\(\) \+ d \* 86_400_000\)/);
});
