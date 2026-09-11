/**
 * ★ ACQUIS — LE RELEVÉ DES COTES PEUT ALLER PLUS LOIN, SANS RIEN CHANGER À MINUIT.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 11 SEPTEMBRE 2026 ─────────────────────────────
 *
 * La production relève les cotes à minuit, avec un budget de quatre-vingt-dix
 * secondes, douze championnats à la fois et à tour de rôle : chaque jour, une
 * partie seulement des championnats est passée. Une cinquantaine de matchs
 * cotés et joués par semaine dans les grands championnats et les coupes
 * d'Europe — trois à quatre semaines avant que la couche du marché ait de quoi
 * être jugée.
 *
 * Le challenger de l'ordinateur du propriétaire n'a pas la limite de trois
 * cents secondes de l'hébergeur : il passe un budget plus long, et relève TOUS
 * les championnats chaque jour, dans la même réserve.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * Sans argument, le relevé garde exactement son budget d'aujourd'hui, et la
 * tâche de minuit continue de l'appeler sans argument.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — sans argument, le relevé garde son budget de minuit', () => {
  const s = sansCommentaires(fs.readFileSync('src/lib/cotes-marche.ts', 'utf8'));
  assert.match(s, /const BUDGET_MS = 90_000;/, 'Le budget de minuit a changé.');
  assert.match(s, /budgetMs = BUDGET_MS\s*\)/, 'Le budget facultatif ne retombe plus sur celui de minuit.');
  assert.match(s, /Date\.now\(\) - debut > budgetMs\)/, 'Le premier contrôle du budget a disparu.');
  assert.match(s, /Date\.now\(\) - debut > budgetMs \* 1\.5\)/, 'Le second contrôle du budget a disparu.');
});

test('★ ACQUIS — la tâche de minuit appelle toujours le relevé sans argument', () => {
  const s = fs.readFileSync('src/app/api/cron/refresh/route.ts', 'utf8');
  assert.ok(s.includes('await releverCotes()'), 'La tâche de minuit passe désormais un budget : elle risquerait d’être tuée.');
});

test('★ ACQUIS — le challenger relève toutes les cotes avec un budget long', () => {
  const s = sansCommentaires(fs.readFileSync('scripts/challenger/donnees.mts', 'utf8'));
  assert.match(s, /releverCotes\(new Date\(\), 20 \* 60_000\)/, 'Le challenger ne relève plus les cotes de tous les championnats.');
});
