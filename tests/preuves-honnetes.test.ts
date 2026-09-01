/**
 * ★ ACQUIS — UNE PREUVE PORTE SUR UN MATCH QU'ON POUVAIT ENCORE PRÉDIRE.
 *
 * ── CE QUE LE MUR PUBLIC ANNONÇAIT LE 1er SEPTEMBRE 2026 ──────────────────
 *
 * Seize cartes sur trois cent quatre portaient sur des rencontres jouées AVANT
 * que l'application n'existe. La pire :
 *
 *     Liverpool FC — FC Barcelone, 7 mai 2019 — SCORE EXACT
 *
 * Le 4-0 le plus célèbre du football moderne, annoncé « avant le match » par
 * une application née en 2026.
 *
 * ── D'OÙ ELLES VENAIENT ───────────────────────────────────────────────────
 *
 * D'analyses lancées à la main sur deux équipes sans match à venir. La
 * vérification retrouvait alors leur dernière confrontation, la comparait au
 * pronostic, et publiait le résultat.
 *
 * Le chemin par PAIRE D'ÉQUIPES refusait déjà toute rencontre antérieure à
 * l'analyse. Le chemin par IDENTIFIANT — le plus rapide, donc le plus employé —
 * ne vérifiait rien : il faisait confiance à l'identifiant enregistré.
 *
 * ── POURQUOI CE N'EST PAS UNE QUESTION DE PRÉSENTATION ────────────────────
 *
 * Un amateur de football qui reconnaît ce match conclut que TOUT le mur est
 * fabriqué. Les 288 preuves honnêtes tombent avec les seize fausses — sur la
 * page dont le seul rôle est d'être crue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('★ ACQUIS — le chemin rapide refuse un match antérieur à l’analyse', () => {
  const s = sansCommentaires(lire('src/lib/precision-reelle.ts'));
  assert.match(s, /jouéeLe: f\.fixture\?\.date \?\? null/, 'La rencontre ne porte plus sa date.');
  assert.match(
    s,
    /connue\.jouéeLe &&[\s\S]{0,160}new Date\(analyse\.created_at\)\.getTime\(\) - 6 \* 3600 \* 1000/,
    'Le chemin par identifiant accepte de nouveau un match déjà joué.'
  );
});

test('★ ACQUIS — les deux chemins appliquent la même règle', () => {
  // Le chemin par paire d'équipes l'appliquait depuis toujours. C'est l'écart
  // entre les deux qui a laissé passer seize preuves fausses.
  const s = sansCommentaires(lire('src/lib/precision-reelle.ts'));
  assert.match(
    s,
    /new Date\(f\.fixture\.date\)\.getTime\(\) >= creee - 6 \* 3600 \* 1000/,
    'Le chemin par paire ne vérifie plus la date.'
  );
});

test('★ ACQUIS — le mur écarte ce qui précède la première analyse', () => {
  // La cause est corrigée, mais seize cartes étaient déjà enregistrées. Ce
  // filtre les écarte à la lecture, et rattrapera toute nouvelle échappée.
  const s = sansCommentaires(lire('src/lib/preuves.ts'));
  assert.match(s, /const PREMIERE_ANALYSE = '2026-07-06'/, 'Le seuil a disparu.');
  assert.match(s, /return !jour \|\| jour >= PREMIERE_ANALYSE;/, 'Le filtre ne s’applique plus.');
});
