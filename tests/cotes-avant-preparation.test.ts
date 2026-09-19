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

test('★ ACQUIS — la préparation interroge le fournisseur SANS « no-store »', () => {
  // Du 5 au 18 septembre 2026, l'option faisait échouer chaque requête dans
  // l'entretien (page régénérée) : « 0 sur 0 examinée » chaque jour.
  const s = fs.readFileSync('src/lib/precalcul-selection.ts', 'utf8');
  const api = s.slice(s.indexOf('async function api('), s.indexOf('async function api(') + 2000);
  assert.doesNotMatch(api.replace(/\/\/.*$/gm, ''), /cache:\s*'no-store'/, 'La préparation redemande « no-store » : elle ne préparera plus rien en production.');
  const e = fs.readFileSync('src/lib/entretien-quotidien.ts', 'utf8');
  assert.match(e, /if \(r\.examinees === 0\) throw/, 'Une préparation vide redevient silencieuse dans les comptes rendus.');
});

test('★ ACQUIS — la vérification des résultats lit le fournisseur SANS « no-store »', () => {
  // Le rattrapage du soir tourne dans la page des preuves (régénérée) : avec
  // « no-store », chaque paquet rendait null et rien n'était vérifié.
  const s = fs.readFileSync('src/lib/precision-reelle.ts', 'utf8');
  const f = s.slice(s.indexOf('export async function lirePaquetFrais('), s.indexOf('async function lireRencontresParIdentifiant('));
  assert.doesNotMatch(f.replace(/\/\/.*$/gm, ''), /cache:\s*'no-store'/, 'La vérification redemande « no-store » : le rattrapage du soir ne vérifiera plus rien.');
  assert.match(f, /next: \{ revalidate: 60 \}/);
});
