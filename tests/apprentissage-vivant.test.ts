/**
 * ★ ACQUIS — L'APPRENTISSAGE DOIT REGARDER LES MATCHS JOUÉS, PAS CEUX À VENIR.
 *
 * ── QUINZE JOURS DE SILENCE ───────────────────────────────────────────────
 *
 * La boucle d'apprentissage lisait `predictions_match` triée du plus RÉCENT au
 * plus ancien. Elle commençait donc par les pronostics écrits dans l'heure —
 * ceux des matchs de ce soir et de demain. Le fournisseur répondait « NS »
 * (pas commencé), rien n'était retenu, et le plafond d'appels était atteint
 * avant d'avoir approché une seule rencontre terminée.
 *
 * Constaté le 4 septembre 2026, en appelant la fonction à la main :
 *
 *     [CALIBRAGE] 40 rencontre(s) examinée(s), 0 jugée(s).
 *
 * Et ce n'était pas l'affaire d'un jour. Les 2 854 jugements en base avaient
 * TOUS été écrits le 21 août, en une seule fois, par l'amorçage. Depuis,
 * plus un seul. Quinze jours pendant lesquels le propriétaire croyait que
 * « l'application apprend tous les jours » — pendant lesquels 1 028 rencontres
 * jouées attendaient d'être apprises, et pendant lesquels l'entretien
 * quotidien partait bien, chaque matin, pour ne rien faire.
 *
 * ── POURQUOI PERSONNE NE L'A VU ───────────────────────────────────────────
 *
 * Parce que « 0 jugée » n'est pas une erreur. Rien n'est levé, rien n'échoue,
 * rien ne s'écrit en rouge. La chaîne rendait un succès parfait — et vide.
 * C'est la panne la plus coûteuse qui soit : celle qui se signale par
 * l'absence de progrès, jamais par un message.
 *
 * Après correction, au même appel : 40 examinées, 40 jugées. Le rattrapage a
 * porté la base d'apprentissage de 2 854 à 3 467 rencontres, et de 30 à 66
 * championnats.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const calibrage = sansCommentaires(lire('src/lib/calibrage.ts'));

test('★ ACQUIS — la file d’apprentissage se lit du plus ANCIEN au plus récent', () => {
  const bloc = calibrage.slice(
    calibrage.indexOf('export async function jugerRencontresTerminees'),
    calibrage.indexOf('export async function jugerRencontresTerminees') + 1600
  );
  assert.match(
    bloc,
    /from\('predictions_match'\)[\s\S]{0,120}ascending: true/,
    'Le tri est redevenu descendant : la boucle ne verra plus que des matchs à venir, ' +
      'et l’apprentissage s’arrêtera en silence comme il l’a fait du 21 août au 4 septembre 2026.'
  );
  assert.doesNotMatch(
    bloc,
    /order\('calculee_le', \{ ascending: false \}\)/,
    'Le tri descendant est de retour sur la file de jugement.'
  );
});

test('★ ACQUIS — on n’interroge pas le fournisseur sur un match non joué', () => {
  // Chaque lot coûte une requête sur le quota, et un pronostic écrit il y a
  // une heure ne peut rien rendre d'autre que « pas commencé ».
  assert.match(
    calibrage,
    /const DELAI_DE_GRACE_MS = 48 \* 60 \* 60 \* 1000/,
    'Le délai de grâce a disparu : le quota repart dans des rencontres à venir.'
  );
  assert.match(
    calibrage,
    /quand <= limite/,
    'Le filtre sur l’âge du pronostic n’est plus appliqué.'
  );
});

test('★ ACQUIS — une date illisible n’écarte jamais un pronostic', () => {
  // Le filtre d'âge doit se tromper du bon côté : une requête de trop coûte
  // une unité de quota, un pronostic jamais confronté coûte l'apprentissage.
  assert.match(
    calibrage,
    /!Number\.isFinite\(quand\) \|\| quand <= limite/,
    'Un pronostic dont la date est illisible est désormais écarté pour toujours.'
  );
});

test('★ ACQUIS — le seuil de matière protège toujours l’apprentissage', () => {
  // Corriger un biais mesuré sur six matchs, c'est prendre le hasard pour une
  // tendance. Ce garde-fou existait avant le correctif et doit lui survivre.
  assert.match(calibrage, /export const MATCHS_MINIMUM = 30/, 'Le seuil de matière a bougé.');
  assert.match(calibrage, /const FACTEUR_MIN = 0\.8/, 'La borne basse des facteurs a sauté.');
  assert.match(calibrage, /const FACTEUR_MAX = 1\.25/, 'La borne haute des facteurs a sauté.');
});
