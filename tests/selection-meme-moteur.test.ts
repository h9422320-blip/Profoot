/**
 * ★ ACQUIS — LA SÉLECTION DU JOUR CALCULE AVEC LE MÊME MOTEUR QUE L'ANALYSE.
 *
 * La préparation des grands matchs fige le pronostic que juge le mur des
 * preuves. Jusqu'au 17 septembre 2026, elle calculait sans l'ancre des douze
 * derniers matchs ni les corrections d'élan, de terrain et de repos. Mesuré sur
 * 697 matchs joués depuis le 1er septembre : 23 désaccords avec l'analyse lue
 * par l'abonné, 14 où l'analyse avait raison contre 4
 * (`scripts/_fige-contre-analyse.mts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { statistiquesDepuisMatchs } from '../src/lib/statistiques-recentes';

const sans = (p: string) =>
  fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('★ ACQUIS — la préparation applique l’ancre et les corrections de l’analyse', () => {
  const s = sans('src/lib/precalcul-selection.ts');
  assert.match(s, /melangerStatistiques\(brut\(sDom\), ancreDom\)/, 'La sélection du jour a perdu l’ancre des douze derniers matchs.');
  assert.match(s, /melangerStatistiques\(brut\(sExt\), ancreExt\)/, 'La sélection du jour a perdu l’ancre des douze derniers matchs.');
  assert.match(s, /fixtures\?team=\$\{domId\}&last=12/);
  assert.match(s, /correctionElanTerrain\(elanEtTerrain,/, 'La sélection du jour a perdu l’élan et le terrain.');
  assert.match(s, /correctionRepos\(/, 'La sélection du jour a perdu le repos.');
  assert.match(s, /^\s*corrections,\s*$/m, 'Les corrections ne sont plus transmises au moteur.');
});

test('★ ACQUIS — un seul calcul des derniers matchs, partagé', () => {
  const route = sans('src/app/api/analyze/route.ts');
  assert.doesNotMatch(route, /const statistiquesDepuisMatchs = /, 'La route a recopié le calcul : les deux finiront par diverger.');
  assert.match(route, /import \{ statistiquesDepuisMatchs \} from "@\/lib\/statistiques-recentes"/);
});

test('★ ACQUIS — les amicaux sont écartés quand il reste quatre matchs officiels', () => {
  const m = (ligue: string, dom: number, bd: number, be: number) => ({
    fixture: { status: { short: 'FT' } },
    league: { name: ligue, type: ligue === 'Friendlies Clubs' ? 'Cup' : 'League' },
    teams: { home: { id: dom }, away: { id: dom === 1 ? 2 : 1 } },
    goals: { home: bd, away: be },
  });
  const liste = [m('Ligue 1', 1, 1, 0), m('Ligue 1', 2, 0, 0), m('Ligue 1', 1, 2, 2), m('Ligue 1', 2, 1, 1), m('Friendlies Clubs', 1, 9, 0)];
  const r = statistiquesDepuisMatchs(liste, '1');
  assert.equal(r.matchsJoues, 4, 'Un amical compte encore dans la force d’une équipe.');
  assert.equal(r.butsMarques, 1 + 0 + 2 + 1);
});

test('★ ACQUIS — la préparation ne déborde pas sur l’entretien qui la suit', () => {
  const s = sans('src/lib/precalcul-selection.ts');
  assert.match(s, /budgetMs = 20_000/, 'La préparation n’a plus de budget de temps.');
  assert.match(s, /if \(Date\.now\(\) - debutDesCalculs > budgetMs\) \{/, 'Le budget n’est plus contrôlé dans la boucle.');
  // Le budget court depuis le début des CALCULS : compté depuis l'entrée de la
  // fonction, la seule lecture des pronostics connus l'épuisait et la
  // préparation ne calculait plus rien.
  assert.match(s, /const debutDesCalculs = Date\.now\(\);/);
});

test('★ ACQUIS — en coupe d’Europe, la préparation lit le championnat de chaque club', () => {
  // Les statistiques de la coupe elle-même portent une ou deux rencontres :
  // elles ne décrivent rien. L'analyse résout le championnat domestique de
  // chacun, y prend statistiques et classement, et corrige l'écart de niveau
  // entre les deux championnats. Mesuré le 17 septembre 2026 sur les matchs
  // joués depuis le 15 août : en coupes d'Europe l'analyse trouvait 96 bons
  // vainqueurs contre 82 au pronostic figé, et avait raison dans 17 des 20
  // désaccords.
  const s = sans('src/lib/precalcul-selection.ts');
  assert.match(s, /const enCoupeDEurope = COUPES_EUROPE_IDS\.has\(ligue\)/, 'La préparation ne distingue plus les coupes d’Europe.');
  assert.match(s, /championnatDe\(domId, saison\)/, 'Le championnat domestique n’est plus résolu.');
  assert.match(s, /rapportEntreChampionnats\(forcesDesChampionnats, ligueDom, ligueExt\)/, 'L’écart de niveau entre championnats n’est plus corrigé.');
  assert.match(s, /Number\(ligueDom\) !== Number\(ligueExt\)/, 'La confiance n’est plus plafonnée entre deux championnats.');
});

test('★ ACQUIS — les coupes d’Europe sont reconnues par leur indicateur, pas par leur nom', async () => {
  // Le relevé les nomme en français, la liste d'affichage en anglais :
  // comparer les deux rendait un ensemble VIDE, et le chemin « championnat de
  // chaque club » ne se serait jamais déclenché.
  const { COUPES_EUROPE_IDS } = await import('../src/lib/precalcul-selection');
  assert.ok(COUPES_EUROPE_IDS.has(2) && COUPES_EUROPE_IDS.has(3) && COUPES_EUROPE_IDS.has(848), 'Les coupes d’Europe ne sont plus reconnues.');
});

test('★ ACQUIS — un pronostic rafraîchi ne l’est jamais dans les 24 dernières heures', () => {
  // Deux abonnés du même match doivent lire la même chose quand ça compte :
  // le rafraîchissement (après une amélioration du moteur) s'arrête à 24 h du
  // coup d'envoi, comme dans l'analyse.
  const s = sans('src/lib/precalcul-selection.ts');
  assert.match(s, /const GEL_DEFINITIF_MS = 24 \* 3_600_000;/);
  assert.match(s, /Date\.parse\(String\(f\?\.fixture\?\.date \?\? ''\)\) - Date\.now\(\) > GEL_DEFINITIF_MS/,
    'Le rafraîchissement ne respecte plus le gel des 24 dernières heures.');
});
