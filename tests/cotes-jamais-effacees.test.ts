/**
 * ★ ACQUIS — UNE JOURNÉE DE COTES N'EST JAMAIS RÉÉCRITE À L'AVEUGLE.
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 11 SEPTEMBRE 2026 ───────────────────────────
 *
 * Sept journées déjà jouées, du 4 au 10 septembre, ont été réécrites par le
 * relevé. Le fournisseur ne rend plus les cotes de certains matchs une fois
 * joués ; la relecture de l'existant, passée par la réserve qui abandonne au
 * bout d'une seconde et demie, a rendu « rien » — et chaque journée a été
 * remplacée par les seules cotes encore disponibles. Une dizaine de matchs
 * cotés perdus pour toujours : le fournisseur ne garde pas les cotes passées.
 *
 * C'est la matière dont la couche du marché a besoin pour être jugée.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * Si la relecture rapide ne rend rien, une relecture directe est tentée ; si
 * elle échoue aussi, la journée est laissée intacte.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — une journée illisible est laissée intacte', () => {
  const s = sansCommentaires(fs.readFileSync('src/lib/cotes-marche.ts', 'utf8'));
  const iLecture = s.indexOf('await lireReserve<ReleveDuJour>(cleDuJour(jour))');
  const iSecours = s.indexOf('await relireSansDelai(cleDuJour(jour))');
  const iRefus = s.indexOf("if (lu === 'illisible')");
  const iEcriture = s.indexOf('await ecrireReserve(cleDuJour(jour)');
  assert.ok(iLecture > 0, 'La relecture de la journée existante a disparu.');
  assert.ok(iSecours > iLecture, 'Plus de relecture directe quand la réserve ne rend rien.');
  assert.ok(iRefus > iSecours && iRefus < iEcriture, 'Une journée illisible serait réécrite à l’aveugle.');
  assert.match(
    s,
    /if \(lu === 'illisible'\) \{[\s\S]{0,200}continue;/,
    'Une journée illisible n’est plus sautée : ses cotes seraient remplacées.'
  );
});

test('★ ACQUIS — la relecture directe distingue « absente » et « illisible »', () => {
  const s = sansCommentaires(fs.readFileSync('src/lib/cotes-marche.ts', 'utf8'));
  assert.match(s, /async function relireSansDelai\(/, 'La relecture directe a disparu.');
  assert.match(s, /setTimeout\(\(\) => r\('delai'\), 5_000\)/, 'La relecture directe n’a plus son délai de cinq secondes.');
  assert.match(s, /return r\?\.data\?\.contenu \? \{ contenu: r\.data\.contenu as ReleveDuJour \} : null;/, 'Une journée absente n’est plus distinguée d’une journée illisible.');
});
