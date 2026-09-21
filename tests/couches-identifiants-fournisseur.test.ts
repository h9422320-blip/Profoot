/**
 * ★ ACQUIS — LES COUCHES RANGÉES PAR NUMÉRO DU FOURNISSEUR REÇOIVENT CE NUMÉRO.
 *
 * Défaut trouvé le 21 septembre 2026. L'analyse passait `team1.id` —
 * l'identifiant du CATALOGUE, « arsenal » — à deux couches rangées par numéro
 * du FOURNISSEUR (Arsenal = 42) :
 *
 *   • la mémoire des clubs, en ligne depuis le 12 septembre ;
 *   • la seconde grille des scores (modèle de Poisson).
 *
 * Elles ne trouvaient jamais personne. Elles ont été mesurées, validées et
 * mises en ligne — et n'ont JAMAIS agi dans une seule analyse d'abonné,
 * seulement dans les pronostics préparés à l'avance, qui passent les numéros.
 * Rien n'échouait : elles se taisaient, en silence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = () => fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');

test('★ ACQUIS — la mémoire des clubs reçoit les numéros du fournisseur', () => {
  const s = route();
  const i = s.indexOf('avisDeLaMemoire(');
  const appel = s.slice(i, i + 900);
  assert.doesNotMatch(appel, /team1\.id|team2\.id/, 'La mémoire des clubs reçoit de nouveau l’identifiant du catalogue : elle ne parlera jamais.');
  assert.match(appel, /\? id1 : id2/, 'La mémoire des clubs ne reçoit plus le numéro du fournisseur.');
});

test('★ ACQUIS — la seconde grille des scores reçoit les numéros du fournisseur', () => {
  const s = route();
  const i = s.indexOf('butsAttendusPourLeMatch(');
  const appel = s.slice(i, i + 250);
  assert.doesNotMatch(appel, /team1\.id|team2\.id/, 'La seconde grille reçoit de nouveau l’identifiant du catalogue : elle ne relira aucun score.');
  assert.match(appel, /\? id1 : id2/, 'La seconde grille ne reçoit plus le numéro du fournisseur.');
});

test('★ ACQUIS — ces couches se lisent patiemment', () => {
  for (const [f, nom] of [
    ['src/lib/memoire-clubs.ts', 'la mémoire des clubs'],
    ['src/lib/forces-poisson.ts', 'la seconde grille'],
    ['src/lib/forces-selections.ts', 'la force des sélections'],
  ]) {
    assert.match(fs.readFileSync(f, 'utf8'), /lireReservePatiemment</, `${nom} abandonne de nouveau au bout d’une seconde et demie.`);
  }
});
