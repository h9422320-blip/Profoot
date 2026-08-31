/**
 * ★ ACQUIS — UN CHAMPIONNAT AMBIGU PORTE SON PAYS.
 *
 * ── CE QUE LE MUR AFFICHAIT LE 31 AOÛT 2026 ───────────────────────────────
 *
 *   SERIE A     — Flamengo — Botafogo
 *   BUNDESLIGA  — Rapid Vienne — Sturm Graz
 *
 * Les deux étiquettes venaient du fournisseur et étaient EXACTES : le
 * championnat brésilien s'appelle bien Série A, l'autrichien bien Bundesliga.
 *
 * Exactes, et trompeuses. Sur la même page, « SERIE A » coiffait aussi
 * Napoli — Como. Un amateur de football qui voit Flamengo rangé dans le
 * championnat italien n'en conclut pas qu'il existe deux Série A : il conclut
 * que nos données sont fausses — sur la page dont le seul rôle est de prouver
 * qu'elles sont justes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nommerCompetition } from '../src/lib/preuves';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('★ ACQUIS — les deux cas réels sont désambiguïsés', () => {
  assert.equal(nommerCompetition('Serie A', 'Brazil'), 'Serie A (Brésil)');
  assert.equal(nommerCompetition('Bundesliga', 'Austria'), 'Bundesliga (Autriche)');
});

test('★ ACQUIS — le pays n’est ajouté que s’il surprend', () => {
  // Alourdir chaque étiquette d'un pays évident — « Premier League
  // (Angleterre) » — ferait perdre en lisibilité ce qu'on gagne en précision.
  assert.equal(nommerCompetition('Serie A', 'Italy'), 'Serie A');
  assert.equal(nommerCompetition('Bundesliga', 'Germany'), 'Bundesliga');
  assert.equal(nommerCompetition('Premier League', 'England'), 'Premier League');
  assert.equal(nommerCompetition('Jupiler Pro League', 'Belgium'), 'Jupiler Pro League');
  assert.equal(nommerCompetition('UEFA Champions League', 'World'), 'UEFA Champions League');
});

test('★ ACQUIS — sans pays connu, on ne perd jamais le nom d’origine', () => {
  // Une compétition sans pays vaut mieux qu'une carte muette.
  assert.equal(nommerCompetition('Serie A', null), 'Serie A');
  assert.equal(nommerCompetition('Serie A', ''), 'Serie A');
  assert.equal(nommerCompetition(null, 'Brazil'), null);
});

test('★ ACQUIS — les cartes déjà enregistrées sont réparées', () => {
  // La reconstruction ne redemande jamais la fiche d'un match connu : sans ce
  // rattrapage, les cartes écrites avant le correctif garderaient leur
  // étiquette trompeuse pour toujours.
  const s = sansCommentaires(lire('src/lib/preuves.ts'));
  assert.match(s, /const aBesoinDuPays =/, 'Le rattrapage des anciennes cartes a sauté.');
  assert.match(
    s,
    /!etiquette\.includes\('\('\) && !!PAYS_ATTENDU\[etiquette\.toLowerCase\(\)\]/,
    'Le rattrapage ne cible plus les seules étiquettes ambiguës.'
  );
  assert.match(s, /!aBesoinDuPays &&/, 'La fiche n’est plus redemandée pour les cartes à réparer.');
});
