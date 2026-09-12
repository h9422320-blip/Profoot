/**
 * ★ ACQUIS — LE CHALLENGER NE MESURE JAMAIS SUR UNE COTE DE CLÔTURE.
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 12 SEPTEMBRE 2026 ───────────────────────────
 *
 * Les trente-huit journées de cotes en réserve portent leur date d'écriture.
 * Toutes celles du 17 août au 10 septembre avaient été rangées APRÈS les
 * matchs — jusqu'à huit jours plus tard. Ce sont des cotes de CLÔTURE : elles
 * contiennent déjà les compositions, les blessures de dernière minute et
 * l'argent engagé. La couche du marché, mesurée là-dessus, gagnait +32 et +33
 * vainqueurs sur 930 matchs : de quoi la mettre en ligne sur un mirage.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * L'export des cotes du challenger lit la date d'écriture de chaque journée
 * et ÉCARTE celle qui a été rangée après son propre jour — ou qui n'a pas de
 * date du tout. Ce qui reste a été relevé avant le coup d'envoi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — l’export des cotes lit la date d’écriture de chaque journée', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/donnees.mts', 'utf8'));
  const bloc = s.slice(s.indexOf("ilike('cle', 'cotes:%')") - 600, s.lastIndexOf('FICHIER_COTES'));
  assert.match(bloc, /select\('cle, contenu, ecrit_le'\)/, "L'export des cotes ne demande plus la date d'écriture : une cote de clôture passerait.");
  assert.match(bloc, /Date\.parse\(ecrit\) > Date\.parse\(jour\)/, 'Plus de comparaison entre le jour des matchs et le jour du relevé.');
  assert.match(bloc, /continue;/, 'La journée relevée après les matchs n’est plus écartée.');
});

test('★ ACQUIS — une journée sans date d’écriture est écartée aussi', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/donnees.mts', 'utf8'));
  assert.match(s, /if \(!ecrit \|\| Date\.parse\(ecrit\) > Date\.parse\(jour\)\)/, 'Une journée sans date d’écriture doit être écartée : on ne peut pas prouver qu’elle précède les matchs.');
});
