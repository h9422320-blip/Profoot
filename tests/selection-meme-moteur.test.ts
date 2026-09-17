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
