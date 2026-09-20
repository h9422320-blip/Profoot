/**
 * ★ ACQUIS — UNE ANALYSE NE PEUT PLUS TOMBER PARCE QU'UN BLOC MANQUE.
 *
 * Le 20 septembre 2026, une analyse s'est terminée par « Cette page n'a pas
 * pu s'afficher — Cannot read properties of undefined (reading 'team1') ».
 * Le calcul était complet ; le modèle de langage avait rendu un JSON amputé
 * d'une ligne, et la page lisait `comparison.h2h.team1` sur un objet absent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { completerLesBlocs } from '../src/lib/analyse-complete';

test('★ ACQUIS — les blocs absents sont complétés par des valeurs neutres', () => {
  const d: any = completerLesBlocs({ comparison: { attack: { team1: 70, team2: 30 } } });
  assert.equal(d.comparison.attack.team1, 70, 'Une valeur rendue par le modèle a été écrasée.');
  for (const ligne of ['defense', 'form', 'h2h', 'goals', 'global']) {
    assert.equal(d.comparison[ligne].team1, 50, `La ligne ${ligne} manque encore.`);
    assert.equal(d.comparison[ligne].team2, 50);
  }
  assert.equal(d.predictions.expectedGoals.team1, 0);
  assert.equal(d.predictions.cleanSheet.team2, 0);
  assert.deepEqual(d.keyStrengths.team1, []);
  assert.deepEqual(d.scenarios, []);
});

test('★ ACQUIS — une moitié de paire suffit à faire tomber la page : on complète l’autre', () => {
  const d: any = completerLesBlocs({
    advancedMetrics: { possession: { team1: 60 }, xG: null },
    stats: { shots: { team2: 9 } },
  });
  assert.equal(d.advancedMetrics.possession.team2, 50);
  assert.equal(d.advancedMetrics.xG.team1, 0);
  assert.equal(d.advancedMetrics.ppda.team1, 10);
  assert.equal(d.stats.shots.team1, 0);
  assert.equal(d.stats.possession.team1, 50);
});

test('★ ACQUIS — rien n’est inventé quand le bloc entier est absent', () => {
  const d: any = completerLesBlocs({});
  assert.equal(d.stats, undefined, 'Des statistiques de match ont été inventées pour une rencontre à venir.');
  assert.equal(d.advancedMetrics, undefined);
  assert.equal(typeof d.comparison, 'object');
});

test('★ ACQUIS — la complétion est branchée sur le passage obligé des réponses', () => {
  const s = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  const respond = s.slice(s.indexOf('const respond = async'), s.indexOf('const respond = async') + 1500);
  assert.match(respond, /completerLesBlocs\(data\);/, 'La complétion n’est plus dans `respond` : une sortie peut l’éviter.');
  const client = fs.readFileSync('src/app/(dashboard)/analyze/AnalyzeClient.tsx', 'utf8');
  assert.doesNotMatch(
    client,
    /\.(possession|shots|shotsOnTarget|corners|fouls|passes|attack|defense|form|h2h|goals|global|expectedGoals|cleanSheet|xG|xT|ppda|keyStrengths)\.(team1|team2)/,
    'L’affichage relit une paire sans précaution : la page peut retomber.'
  );
});

test('★ ACQUIS — l’écran d’analyse ne lit plus aucune cascade sans précaution', () => {
  // « Cannot read properties of undefined » vient TOUJOURS d'une lecture en
  // cascade sur un objet absent. Ce garde-fou interdit la forme fautive.
  const client = fs.readFileSync('src/app/(dashboard)/analyze/AnalyzeClient.tsx', 'utf8');
  const cascades = client.match(/result\.[a-zA-Z]+\.[a-zA-Z]+/g) ?? [];
  assert.deepEqual(cascades, [], `Lectures en cascade non protégées : ${[...new Set(cascades)].slice(0, 5).join(', ')}`);
});

test('★ ACQUIS — quand un bloc tombe, l’abonné garde l’essentiel de son analyse', () => {
  const client = fs.readFileSync('src/app/(dashboard)/analyze/AnalyzeClient.tsx', 'utf8');
  assert.match(client, /secours=\{<EssentielDeLAnalyse/, 'Le filet de secours a été retiré de la barrière.');
  assert.match(client, /function EssentielDeLAnalyse/, 'Le bloc de secours n’existe plus.');
  const barriere = fs.readFileSync('src/components/BarriereDeRendu.tsx', 'utf8');
  assert.match(barriere, /if \(this\.props\.secours\) return this\.props\.secours;/, 'La barrière n’affiche plus le secours fourni.');
  assert.match(client, /setResult\(completerLesBlocs\(data\)\)/, 'L’analyse reçue n’est plus complétée côté navigateur.');
});
