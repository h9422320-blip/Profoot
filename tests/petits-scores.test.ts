/**
 * ★ ACQUIS — LES CINQ GRANDS CHAMPIONNATS RESSERRENT MOINS LES PETITS SCORES.
 *
 * Remesuré le 20 septembre 2026 sur 3 553 rencontres des cinq grands, avec la
 * production d'aujourd'hui : −0,10 → 1 917 vainqueurs et 408 scores exacts ;
 * −0,05 → 1 923 et 419, positif sur les deux moitiés (+2 et +4), sans période
 * en recul. Dans les onze autres championnats, la même valeur fait PERDRE
 * trois vainqueurs : elle n'y est pas appliquée.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculerScoreProbable, RHO_CINQ_GRANDS } from '../src/lib/score-probable';

const dom = { butsMarques: 20, butsEncaisses: 15, matchsJoues: 12 };
const ext = { butsMarques: 16, butsEncaisses: 17, matchsJoues: 12 };
const occ = { domicile: 1.3, exterieur: 1.1 };
const appel = (rho?: number | null) =>
  calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, null, false, null, null, null, null, rho);

test('★ ACQUIS — sans valeur, le moteur garde exactement la correction d’avant', () => {
  assert.deepEqual(appel(), appel(null), 'Une valeur absente change le moteur.');
  assert.deepEqual(appel(), appel(-0.1), 'Le défaut n’est plus la valeur de la littérature (−0,10).');
});

test('★ ACQUIS — moins de resserrement, moins de nuls annoncés, mêmes buts attendus', () => {
  assert.equal(RHO_CINQ_GRANDS, -0.05);
  const serre = appel(-0.1);
  const relache = appel(RHO_CINQ_GRANDS);
  // Le resserrement ajoute de la masse sur 0-0 et 1-1 : en relâcher, c'est
  // annoncer moins de nuls. C'est là qu'est le gain mesuré, pas ailleurs.
  assert.ok(
    relache.probaNul < serre.probaNul,
    'Relâcher le resserrement doit réduire la part du nul dans la grille.'
  );
  // Le total de buts n'a pas à bouger : seule la répartition change.
  assert.ok(Math.abs(relache.butsAttendus1 - serre.butsAttendus1) < 1e-9);
  assert.ok(Math.abs(relache.butsAttendus2 - serre.butsAttendus2) < 1e-9);
});

test('★ ACQUIS — la valeur ne vise QUE les cinq grands championnats', () => {
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(
    route,
    /CINQ_GRANDS\.has\(Number\(targetFutureMatch\?\.league\?\.id\)\) \? RHO_CINQ_GRANDS : null/,
    'L’analyse applique la valeur hors des cinq grands, où elle fait perdre.'
  );
  const pre = fs.readFileSync('src/lib/precalcul-selection.ts', 'utf8');
  assert.match(pre, /CINQ_GRANDS\.has\(ligue\) \? RHO_CINQ_GRANDS : null/, 'La préparation ne l’applique plus aux cinq grands.');
});
