/**
 * ★ ACQUIS — « PUBLIÉ » VEUT DIRE ÉCRIT.
 *
 * Le 23 septembre 2026, le rapport du matin annonçait la note Elo des
 * sélections publiée alors que la réserve datait de la veille : `ecrireReserve`
 * avale ses erreurs, et le script annonçait le succès sans vérifier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — la publication de la note Elo se relit avant de s’annoncer', () => {
  const s = fs.readFileSync('scripts/challenger/elo-selections-publier.mts', 'utf8');
  assert.match(s, /ÉCRITURE PERDUE/, 'Le script ne vérifie plus ce qu’il a écrit.');
  assert.match(s, /if \(enLigne !== contenu\.calculeLe\)/);
  assert.match(s, /process\.exit\(1\)/, 'Un échec doit se voir dans le rapport du challenger.');
  assert.ok(
    s.indexOf('ecrireReserve(CLE_ELO_SELECTIONS') < s.indexOf('ÉCRITURE PERDUE'),
    'La relecture doit suivre l’écriture.'
  );
});
