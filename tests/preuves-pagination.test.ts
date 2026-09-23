/**
 * ★ ACQUIS — LA PAGE DES PREUVES RESTE OUVRABLE SUR UN TÉLÉPHONE.
 *
 * Mesuré au contrôle du 23 septembre 2026 : elle servait les 748 preuves d'un
 * coup — 6 Mo de HTML, 27 secondes de téléchargement — alors que le serveur
 * répondait en une seconde. C'est la page qui porte la confiance du produit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('src/app/(dashboard)/preuves/page.tsx', 'utf8');

test('★ ACQUIS — les preuves sont servies par pages', () => {
  assert.match(src, /const PAR_PAGE = 120;/);
  assert.match(src, /toutes\.slice\(\(page - 1\) \* PAR_PAGE, page \* PAR_PAGE\)/);
  assert.ok(Number((src.match(/const PAR_PAGE = (\d+);/) ?? [])[1]) <= 150, 'Trop de cartes par page.');
});

test('★ ACQUIS — le compteur reste celui de TOUTES les preuves', () => {
  // Le bandeau annonce un nombre de réussites réelles : il ne doit pas suivre
  // la pagination.
  assert.match(src, /<MurPreuves preuves=\{preuves\} bilan=\{bilan\} total=\{total\} avecEntete=\{false\} \/>/);
  assert.match(src, /const \{ preuves: toutes, bilan, total \} = await getPreuvesPubliques\(1000\);/);
});

test('★ ACQUIS — on peut atteindre les preuves suivantes et revenir', () => {
  assert.match(src, /Preuves suivantes/);
  assert.match(src, /Preuves précédentes/);
  assert.match(src, /Page \{page\} sur \{pages\}/);
  // Une page hors bornes ne casse rien.
  assert.match(src, /Math\.min\(Math\.max\(1, Math\.trunc\(demandee\)\), pages\)/);
});
