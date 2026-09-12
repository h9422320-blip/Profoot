/**
 * ★ ACQUIS — LE BANC D'ESSAI MESURE CE QUE LA PRODUCTION FAIT VRAIMENT.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────
 *
 * Le 12 septembre 2026, la mémoire des clubs est passée en production : là où
 * les occasions manquent, le moteur reprend son avis sur qui domine. Si le
 * « moteur de référence » du challenger ignorait ce changement, chaque couche
 * serait comparée à un moteur qui n'existe plus — et une couche qui ne fait que
 * retrouver ce que la production sait déjà paraîtrait gagnante.
 *
 * De même, le fichier des tirs du challenger contient désormais quatre
 * championnats à l'essai (Roumanie, Serbie, Irlande, Finlande) que le relevé de
 * production NE CONNAÎT PAS. Le relevé du moteur de référence doit les écarter,
 * sinon il serait meilleur que le vrai.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Le moteur de référence reçoit l'avis de la mémoire sur les matchs aveugles.
 * 2. Ce relevé-là écarte les quatre championnats à l'essai ; seule la couche
 *    `tirs-elargis` les ajoute.
 * 3. Les mêmes conditions qu'en production : occasions absentes, et cinq
 *    rencontres au moins pour chaque club.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const source = () => sansCommentaires(fs.readFileSync('scripts/challenger/evaluer.mts', 'utf8'));

test('★ ACQUIS — le moteur de référence du banc inclut la mémoire des clubs', () => {
  const s = source();
  assert.match(s, /const avisDeLaProduction = /, 'Le banc ne connaît plus l’avis de la production.');
  assert.match(
    s,
    /calculerScoreProbable\(s1, s2, true, false, undefined, null, undefined, false, 1, occ, null, avisDeLaProduction\(m\)\)/,
    'Le moteur de référence doit recevoir l’avis de la mémoire, comme la production depuis le 12 septembre 2026.'
  );
});

test('★ ACQUIS — le banc applique les mêmes conditions que la production', () => {
  const s = source();
  assert.match(s, /if \(occ\) continue;/, 'L’avis de la production doit être réservé aux matchs SANS occasions.');
  assert.match(s, /< 5 \|\| \(joues\.get\(m\.ext\) \?\? 0\) < 5/, 'Le seuil de cinq rencontres par club doit être le même qu’en production.');
  assert.match(s, /const PART_PRODUCTION = 0\.6;/, 'La part de la mémoire doit être celle de la production (0,6).');
});

test('★ ACQUIS — le relevé de référence écarte les quatre championnats à l’essai', () => {
  const s = source();
  assert.match(s, /const NOMS_EN_PLUS = new Set\(Object\.values\(TIRS_EN_PLUS\)\)/, 'Le banc ne sait plus quels championnats sont à l’essai.');
  assert.match(
    s,
    /avecLesQuatre \|\| !NOMS_EN_PLUS\.has\(String\(t\.ligue\)\)/,
    'Le relevé du moteur de référence doit écarter les championnats à l’essai : sinon il est meilleur que la production et toute mesure est faussée.'
  );
  const iNarrow = s.indexOf('function releveLaVeille');
  const bloc = s.slice(iNarrow, iNarrow + 260);
  assert.match(bloc, /construireReleve\(jour, false\)/, 'Le relevé par défaut doit être le relevé ÉTROIT, celui de la production.');
});
