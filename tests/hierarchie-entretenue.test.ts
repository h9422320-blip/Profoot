/**
 * ★ ACQUIS — LA HIÉRARCHIE DES CHAMPIONNATS EST ENTRETENUE.
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 12 SEPTEMBRE 2026 ───────────────────────────
 *
 * Elle dit ce que vaut un championnat face à un autre, et sert aux matchs de
 * coupe d'Europe. Son calcul lit près de deux cents pages et dure deux
 * minutes : il ne tient pas dans les soixante secondes que l'hébergeur accorde
 * à une fonction, et il est la quatrième étape de la tâche de minuit — jamais
 * atteinte. Résultat : dix-neuf jours sans recalcul, le moteur jugeait les
 * coupes d'Europe sur une hiérarchie du 24 août.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * Le challenger, qui tourne sur un ordinateur sans limite de temps, appelle le
 * recalcul chaque jour. Il ne FORCE pas : la fraîcheur d'une semaine reste
 * décidée par `recalculerForcesChampionnats`. Et l'appel est protégé, pour
 * qu'un échec du fournisseur ne fasse pas tomber la journée entière.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — le challenger demande le recalcul de la hiérarchie chaque jour', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/nuit.mts', 'utf8'));
  assert.match(s, /recalculerForcesChampionnats/, 'Le challenger ne recalcule plus la hiérarchie : la production, elle, ne l’atteint jamais.');
  assert.match(s, /await recalculerForcesChampionnats\(\);/, 'Le recalcul doit être appelé SANS forcer : la fraîcheur d’une semaine est décidée par la bibliothèque.');
});

test('★ ACQUIS — un échec du recalcul ne fait pas tomber la journée', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/nuit.mts', 'utf8'));
  // La section du rapport tout entière : du titre « 2 bis » au titre suivant.
  const bloc = s.slice(s.indexOf("ligne('## 2 bis"), s.indexOf("ligne('## 3."));
  assert.ok(bloc.includes('recalculerForcesChampionnats'), 'Le recalcul ne vit plus dans la section de la hiérarchie.');
  assert.match(bloc, /try \{/, 'Le recalcul n’est plus protégé : une coupure chez le fournisseur emporterait tout le travail du jour.');
  assert.match(bloc, /catch \(e: any\) \{/, 'Le recalcul n’a plus de rattrapage d’erreur.');
});
