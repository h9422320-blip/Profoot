/**
 * ★ ACQUIS — LE NUL A ÉTÉ MESURÉ, PAS SUPPOSÉ.
 *
 * ── LE CONSTAT QUI RESSEMBLE À UN DÉFAUT ──────────────────────────────────
 *
 * Sur 3 090 rencontres rejouées le 29 septembre 2026, le nul arrive 751 fois
 * (24,3 %) et le moteur ne l'annonce que 27 fois (0,9 %). Un quart des
 * rencontres semble perdu d'avance, et la première réaction est d'ouvrir la
 * marge du nul.
 *
 * ── CE QUE LA MESURE DIT ──────────────────────────────────────────────────
 *
 * Annoncer le nul dès que sa probabilité dépasse un seuil, sur les deux
 * moitiés : -237 et -224 à 24 %, -125 et -93 à 28 %, -32 et -6 à 30 %,
 * -5 et -2 à 32 %. Et restreint aux affiches serrées : -7 et -8.
 *
 * Aucun seuil ne gagne. Le nul n'est JAMAIS l'issue la plus probable (0 fois
 * sur 3 090) : chaque nul annoncé coûte une victoire qu'on aurait eue.
 *
 * ── CE QUE CETTE ÉPREUVE PROTÈGE ──────────────────────────────────────────
 *
 * Que la mesure reste écrite à côté du réglage. Sans elle, le prochain qui
 * verra « 0,9 % de nuls annoncés pour 24,3 % de nuls réels » rouvrira la
 * marge, et le moteur perdra des dizaines de vainqueurs justes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — la mesure du nul reste écrite à côté de la marge du nul', () => {
  const src = fs.readFileSync('src/lib/score-probable.ts', 'utf8');
  const i = src.indexOf('const MARGE_DU_NUL =');
  assert.ok(i > 0, 'La marge du nul a disparu.');
  const avant = src.slice(Math.max(0, i - 2200), i);
  assert.match(avant, /le nul ARRIVE/, 'La mesure du 29 septembre 2026 a été détachée du réglage qu’elle justifie.');
  assert.match(avant, /Aucun seuil ne gagne/);
  assert.match(avant, /69,8 %/, 'Le vrai chiffre — la justesse hors nuls — doit rester lisible.');
});

test('★ ACQUIS — la marge du nul n’a pas été ouverte', () => {
  const src = fs.readFileSync('src/lib/score-probable.ts', 'utf8');
  assert.match(
    src,
    /const MARGE_DU_NUL = Number\(process\.env\.BANC_MARGE_NUL\) \|\| 3;/,
    'La marge du nul a changé : la mesure dit que toute ouverture fait perdre.'
  );
});
