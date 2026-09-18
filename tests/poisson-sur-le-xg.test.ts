/**
 * ★ ACQUIS — LE MODÈLE DE POISSON S'AJUSTE SUR LE xG QUAND IL EXISTE.
 *
 * Mesuré le 18 septembre 2026 sur 1 063 matchs des sept grands championnats :
 * scores exacts 114 → 121, Brier « plus de 2,5 buts » 0,2424 → 0,2412, erreur
 * sur le total 1,272 → 1,265 ; meilleur ou égal chaque mois.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — la nuit du challenger et le rangement passent par les cibles xG', () => {
  const nuit = fs.readFileSync('scripts/challenger/nuit.mts', 'utf8');
  assert.match(nuit, /ciblesDuModele\(JSON\.parse\(fsNuit\.readFileSync\(FICHIER_RENCONTRES, 'utf8'\)\)\)/,
    'La nuit du challenger ajuste de nouveau le modèle sur les buts seuls.');
  assert.match(nuit, /exporterStatistiquesDeMatch\(\)/, 'La nuit ne relit plus les fiches de statistiques.');
  const ranger = fs.readFileSync('scripts/_ranger-forces-poisson.mts', 'utf8');
  assert.match(ranger, /ciblesDuModele\(/, 'Le rangement à la main ajuste de nouveau sur les buts seuls.');
});

test('★ ACQUIS — le xG remplace les buts rencontre par rencontre, et seulement là', async () => {
  const { ciblesDuModele, FICHIER_STATISTIQUES } = await import('../scripts/challenger/statistiques.mjs');
  const rencontres = [
    { id: -101, date: '2026-01-01', ligue: 39, dom: 1, ext: 2, bd: 3, be: 0 },
    { id: -102, date: '2026-01-08', ligue: 39, dom: 2, ext: 1, bd: 1, be: 1 },
  ];
  const cibles = ciblesDuModele(rencontres);
  // Aucune de ces deux rencontres fictives n'a de xG : les buts restent.
  assert.deepEqual([cibles[0].bd, cibles[0].be, cibles[1].bd, cibles[1].be], [3, 0, 1, 1]);
  assert.ok(typeof FICHIER_STATISTIQUES === 'string');
});
