/**
 * ★ ACQUIS — UNE JOURNÉE DE COTES COMMENCÉE NE SE RÉÉCRIT PLUS.
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 12 SEPTEMBRE 2026 ───────────────────────────
 *
 * Le relevé parcourt une fenêtre de journées qui englobe aussi des jours
 * PASSÉS, et il les réécrivait avec les cotes encore disponibles. La journée
 * du 11 septembre, rangée la veille AVANT les matchs, s'est ainsi retrouvée
 * datée du 12 : une cote de CLÔTURE, qui contient déjà les compositions, les
 * blessures de dernière minute et l'argent engagé. La seule journée honnête
 * que nous avions a été détruite en une matinée, et la couche du marché ne
 * pouvait donc jamais être prouvée.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * Dès que le jour d'une journée est arrivé, sa première version rangée est
 * conservée telle quelle : c'est la seule qui précède le coup d'envoi. Les
 * journées à VENIR restent rafraîchies — leurs cotes se précisent jusqu'à la
 * veille, et elles sont écrites avant les matchs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — le relevé ne réécrit pas une journée dont le jour est arrivé', () => {
  const s = sansCommentaires(fs.readFileSync('src/lib/cotes-marche.ts', 'utf8'));
  assert.match(s, /const aujourdhui = maintenant\.toISOString\(\)\.slice\(0, 10\);/, 'Le relevé ne compare plus la journée à aujourd’hui.');
  assert.match(s, /if \(jour <= aujourdhui && fusion\.size > 0\) \{/, 'Une journée déjà rangée et déjà commencée peut de nouveau être réécrite par des cotes de clôture.');
});

test('★ ACQUIS — le gel vient AVANT la fusion des cotes du jour', () => {
  const s = sansCommentaires(fs.readFileSync('src/lib/cotes-marche.ts', 'utf8'));
  const iGel = s.indexOf('if (jour <= aujourdhui && fusion.size > 0)');
  const iFusion = s.indexOf('for (const m of matchs) fusion.set(m.id, m);');
  assert.ok(iGel > 0 && iFusion > 0, 'Le gel ou la fusion a disparu.');
  assert.ok(iGel < iFusion, 'Le gel passe après la fusion : les cotes d’après-match écrasent encore celles d’avant-match.');
});
