/**
 * ★ ACQUIS — UNE COUPURE RÉSEAU NE FAIT PLUS PERDRE UNE JOURNÉE DE TRAVAIL.
 *
 * ── CE QUI S'EST PASSÉ LE 12 SEPTEMBRE 2026 ──────────────────────────────
 *
 * Deux journées entières du challenger ont été perdues, à sept heures
 * d'intervalle :
 *
 *   11 h 06  « lecture des tirs : TypeError: terminated »    — la base a coupé
 *            une lecture volumineuse après cinq minutes de pagination.
 *   13 h 53  « lecture des cotes : TypeError: fetch failed » — coupure réseau
 *            (la même minute, une publication GitHub a échoué aussi).
 *
 * La patience posée le matin ne regardait que l'erreur RENDUE par la base. Une
 * coupure réseau, elle, LÈVE une exception : elle passait donc à travers. Et un
 * seul échec de lecture emportait tout — aucun rapport, aucune couche essayée.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Les lectures de la réserve réessaient quatre fois, en patientant de plus
 *    en plus, et attrapent l'erreur rendue COMME l'exception levée.
 * 2. Les trois lectures paginées passent par là : les clés, les tirs, les cotes.
 * 3. Si le rafraîchissement échoue quand même, la journée continue sur les
 *    fichiers de la dernière fois, en le DISANT dans le rapport. Mesurer sur
 *    des données d'hier vaut mieux que ne rien mesurer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — la patience attrape l’exception levée, pas seulement l’erreur rendue', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/donnees.mts', 'utf8'));
  const i = s.indexOf('const lireAvecPatience');
  assert.ok(i > 0, 'La lecture patiente a disparu : une coupure réseau reprendrait toute une journée.');
  const bloc = s.slice(i, i + 900);
  assert.match(bloc, /try \{/, 'La lecture patiente doit protéger l’appel : une coupure réseau LÈVE une exception.');
  assert.match(bloc, /catch \(e: any\) \{/, 'Sans rattrapage, « TypeError: fetch failed » traverse la patience.');
  assert.match(bloc, /essai <= 4/, 'Quatre essais au moins : une coupure dure parfois quelques secondes.');
  assert.match(bloc, /setTimeout\(r, 3000 \* essai\)/, 'L’attente doit croître entre deux essais.');
});

test('★ ACQUIS — les trois lectures paginées sont patientes', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/donnees.mts', 'utf8'));
  assert.match(s, /lirePage\('cle', de, 'lecture des clés de la réserve'\)/, 'La lecture des clés n’est plus patiente.');
  assert.match(s, /lirePage\('cle, contenu', de, 'lecture des tirs'\)/, 'La lecture des tirs n’est plus patiente.');
  assert.match(
    s,
    /lireAvecPatience\(`lecture des cotes \(page \$\{de\}\)`/,
    'La lecture des cotes n’est plus patiente : c’est elle qui a emporté la journée du 12 septembre 2026 à 13 h 53.'
  );
  assert.doesNotMatch(
    s,
    /if \(error\) throw new Error\('lecture des cotes/,
    'La lecture des cotes abandonne encore au premier refus.'
  );
});

test('★ ACQUIS — un rafraîchissement manqué ne tue plus la journée', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/nuit.mts', 'utf8'));
  const i = s.indexOf('rafraichirDonnees()');
  assert.ok(i > 0, 'Le rafraîchissement a disparu.');
  const bloc = s.slice(Math.max(0, i - 400), i + 900);
  assert.match(bloc, /try \{/, 'Le rafraîchissement doit être protégé.');
  assert.match(bloc, /catch \(e: any\) \{/, 'Sans rattrapage, une coupure emporte le rejeu, les couches et le rapport.');
  assert.match(
    bloc,
    /on travaille sur les fichiers existants/,
    'La journée doit continuer sur les fichiers de la dernière fois.'
  );
  assert.match(
    s,
    /Données NON rafraîchies aujourd’hui/,
    'Le rapport doit DIRE que les données ne sont pas fraîches : un chiffre sans son avertissement trompe le lecteur.'
  );
});
