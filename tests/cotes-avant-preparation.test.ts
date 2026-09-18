/**
 * ★ ACQUIS — LES COTES SONT RELEVÉES AVANT QUE LES PRONOSTICS SOIENT FIGÉS.
 *
 * Constaté le 18 septembre 2026 : l'entretien quotidien figeait les grands
 * matchs PUIS relevait les cotes. Chaque rencontre figée cette nuit-là
 * l'était sans l'avis du marché, et le restait jusqu'au coup d'envoi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — l’entretien relève les cotes avant de préparer les grands matchs', () => {
  const s = fs.readFileSync('src/lib/entretien-quotidien.ts', 'utf8');
  const cotes = s.indexOf("'Relever les cotes du marché'");
  const preparation = s.indexOf("'Préparer les grands matchs à venir'");
  assert.ok(cotes > 0 && preparation > 0, 'Une des deux étapes a disparu.');
  assert.ok(cotes < preparation, 'Les pronostics sont de nouveau figés avant que les cotes soient relevées.');
});

test('★ ACQUIS — les compétitions où le marché est branché sont relevées en premier', () => {
  const s = fs.readFileSync('src/lib/cotes-marche.ts', 'utf8');
  assert.match(s, /const ligues = \[\.\.\.prioritaires, /, 'Les compétitions du marché ne passent plus en tête du relevé.');
});

test('★ ACQUIS — un pronostic figé sans le marché se refige quand la cote arrive', () => {
  const s = fs.readFileSync('src/lib/precalcul-selection.ts', 'utf8');
  assert.match(s, /const ECART_SANS_MARCHE = 8;/);
  assert.match(s, /\(await figeSansLeMarche\(f\)\)/, 'Le rattrapage automatique n’est plus branché.');
  assert.match(s, /GEL_DEFINITIF_MS = 24 \* 3_600_000/, 'Le gel des vingt-quatre heures a changé.');
});
