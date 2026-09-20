/**
 * ★ ACQUIS — LA SÉLECTION DU JOUR NE MET EN AVANT QUE CE DONT ELLE EST SÛRE.
 *
 * Mesuré le 20 septembre 2026 sur 3 402 rencontres des cinq grands
 * championnats (Angleterre, Espagne, Italie, Allemagne, France) depuis le
 * 1er août 2024, avec les cotes d'avant-match :
 *
 *     3 par jour   66,2 % → 77,5 %   journées 100 % justes  35 % → 61 %
 *     5 par jour   64,0 % → 77,0 %   journées 100 % justes  19 % → 56 %
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — le seuil de certitude, avec son repli, garde la sélection non vide', () => {
  const s = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(s, /const PALIERS_DE_CERTITUDE = \[0\.65, 0\.55\];/, 'Le seuil de certitude a disparu ou changé sans mesure.');
  assert.match(
    s,
    /for \(const seuil of PALIERS_DE_CERTITUDE\)[\s\S]{0,260}surs\.length >= MINIMUM_POUR_AFFICHER/,
    'Le repli par paliers n’est plus là : une journée creuse viderait la section.'
  );
  const apres = s.slice(s.indexOf('PALIERS_DE_CERTITUDE'));
  assert.match(apres, /return retenus\.slice\(0, MAX_MATCHS\);/, 'Le dernier repli — l’ancien tri — a été retiré.');
});

test('★ ACQUIS — les cinq grands championnats passent devant les autres', () => {
  // Demande du propriétaire, le 20 septembre 2026. Mesuré à seuil égal sur
  // 3 402 rencontres cotées : justesse 78,5 % → 76,8 %, mais les journées
  // 100 % justes montent de 58 % à 62 %. Les autres championnats restent, en
  // dessous — et reprennent la tête les jours sans match sûr chez les grands.
  const s = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(s, /CINQ_GRANDS_CHAMPIONNATS: ReadonlySet<number> = new Set\(\[39, 140, 135, 78, 61\]\)/);
  assert.match(
    s,
    /rangNom < 2 \? rangNom : CINQ_GRANDS_CHAMPIONNATS\.has\(Number\(f\?\.league\?\.id\)\) \? 2 : 3/,
    'Le rang des cinq grands championnats a disparu du classement.'
  );
  assert.match(s, /rangDe\.get\(a\.fixtureId\)/, 'Le tri n’utilise plus ce rang.');
});
