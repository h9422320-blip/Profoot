/**
 * ★ ACQUIS — UNE COTE N'EST PAS ÉCARTÉE PARCE QUE LE FOURNISSEUR A ÉTÉ LENT.
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 11 SEPTEMBRE 2026 ───────────────────────────
 *
 * Pour rapprocher une cote d'une analyse, le relevé va chercher les deux
 * équipes dans la fiche du match, par paquets de vingt. Dix-huit de ces
 * paquets ont dépassé les dix secondes accordées au fournisseur : 360 cotes
 * écartées « faute d'équipes », alors que le fournisseur les avait données.
 * C'est de la matière perdue pour la couche du marché, qui en manque.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * Après le passage normal, les cotes restées sans équipes sont redemandées
 * cinq par cinq — une fiche plus légère répond plus vite —, une demande à la
 * fois, au même rythme et dans le même budget, AVANT le tri qui écarte les
 * cotes incomplètes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — les cotes sans équipes ont une seconde chance, avant d’être écartées', () => {
  const s = sansCommentaires(fs.readFileSync('src/lib/cotes-marche.ts', 'utf8'));
  const iSeconde = s.indexOf('const sansEquipes = [...parId.values()]');
  const iTri = s.indexOf('const complets = [...parId.values()].filter((m) => m.dom > 0 && m.ext > 0);');
  assert.ok(iSeconde > 0, 'Plus de seconde chance : une réponse lente fait écarter des cotes valables.');
  assert.ok(iTri > iSeconde, 'La seconde chance vient après le tri : elle ne sauve plus rien.');
  assert.match(s, /i \+= 5\)/, 'La seconde chance ne redemande plus en petits paquets.');
  assert.match(s, /sansEquipes\.slice\(i, i \+ 5\)/, 'La seconde chance ne redemande plus en petits paquets.');
});

test('★ ACQUIS — la seconde chance respecte le budget et le rythme', () => {
  const s = sansCommentaires(fs.readFileSync('src/lib/cotes-marche.ts', 'utf8'));
  const bloc = s.slice(s.indexOf('const sansEquipes'), s.indexOf('const complets'));
  assert.match(bloc, /Date\.now\(\) - debut > budgetMs \* 1\.5\) break;/, 'La seconde chance peut dépasser le budget de la tâche de minuit.');
  assert.match(bloc, /if \(pauseMs > 0\) await new Promise/, 'La seconde chance ne respecte plus la pause du challenger.');
});
