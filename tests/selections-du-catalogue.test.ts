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
import { COMPETITIONS_DE_SELECTIONS_PREPAREES, competitionRetenue, rencontreRetenue } from '../src/lib/precalcul-selection';

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

test('★ ACQUIS — les Ligues des nations sont préparées, les amicaux seulement entre sélections A', () => {
  for (const id of [36, 6, 5, 536]) {
    assert.ok(COMPETITIONS_DE_SELECTIONS_PREPAREES.has(id));
    assert.ok(competitionRetenue({ id }), `La compétition ${id} n’est plus préparée.`);
  }
  // Les amicaux : seulement entre deux sélections A du catalogue.
  const amical = (a: number, b: number) => ({ league: { id: 10 }, teams: { home: { id: a }, away: { id: b } } });
  assert.ok(rencontreRetenue(amical(30, 2384)), 'Pérou–USA, deux sélections A, doit entrer.');
  assert.ok(!rencontreRetenue(amical(99999, 2384)), 'Un amical avec une équipe inconnue (jeunes) est entré.');
  assert.ok(!competitionRetenue({ id: 34 }), 'Les éliminatoires sud-américains (66,7 %) sont entrés.');
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

test('★ ACQUIS — les 68 sélections ajoutées le 22 septembre sont au catalogue, avec leur numéro', () => {
  for (const [n, id] of [[773, 'slovakia_nat'], [1099, 'finland_nat'], [18, 'iceland_nat'], [1117, 'greece_nat'], [769, 'hungary_nat'], [30, 'peru_nat'], [4672, 'honduras_nat'], [771, 'northern_ireland_nat']] as [number, string][]) {
    assert.ok(clubs[id], `${id} absente du catalogue.`);
    assert.equal((clubs[id] as any).league, 'selections');
    assert.equal(catalogueDeSelection(n), id);
    assert.equal(numeroDeSelection(id), n);
  }
});

test('★ ACQUIS — le sélecteur montre une rubrique « Sélections nationales », Coupe du monde comprise', () => {
  const s = fs.readFileSync('src/app/(dashboard)/analyze/AnalyzeClient.tsx', 'utf8');
  assert.match(s, /"selections",\s*\n\s*"can",/);
  assert.match(s, /c\.league === "selections" \|\| c\.league === "wc"/);
});

test('★ ACQUIS — le prochain adversaire d’une sélection se trouve par la table', () => {
  const s = fs.readFileSync('src/app/api/next-match/route.ts', 'utf8');
  assert.match(s, /if \(!apiId\) apiId = numeroDeSelection\(teamId\);/);
  assert.match(s, /nextTeamId: catalogueDeSelection\(opponent\.id\) \|\|/);
});
