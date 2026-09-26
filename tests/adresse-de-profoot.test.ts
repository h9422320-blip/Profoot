/**
 * ★ ACQUIS — PROFOOT ÉCRIT ET REÇOIT SUR SA PROPRE ADRESSE.
 *
 * Jusqu'au 26 septembre 2026, les réponses des clients et les alertes de vente
 * partaient vers `m09997818@gmail.com` — l'adresse personnelle du
 * propriétaire, partagée avec un second projet sans aucun rapport. Décision du
 * propriétaire : chaque projet reste dans son coin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADRESSE_ALERTES } from '../src/lib/courriel';
import { ALERTE_A } from '../src/lib/maketou-courriels';
import { ADMIN_EMAILS } from '../src/lib/admins';

const ADRESSE_PROFOOT = 'h9422320@gmail.com';

test('★ ACQUIS — les réponses et les alertes vont à l’adresse de ProFoot', () => {
  assert.equal(ADRESSE_ALERTES, ADRESSE_PROFOOT);
  assert.equal(ALERTE_A, ADRESSE_PROFOOT);
  // Et c'est bien une adresse qui ouvre l'administration : une alerte envoyée
  // à quelqu'un qui ne peut rien faire ne sert à rien.
  assert.ok(
    ADMIN_EMAILS.map((a) => a.toLowerCase()).includes(ADRESSE_PROFOOT),
    'L’adresse qui reçoit les alertes n’est pas celle d’un administrateur.'
  );
});

test('★ ACQUIS — l’adresse de l’autre projet ne revient nulle part', () => {
  for (const fichier of [
    'src/lib/courriel.ts',
    'src/lib/maketou-courriels.ts',
    'src/app/api/diagnostic/courriel/route.ts',
  ]) {
    const s = fs.readFileSync(fichier, 'utf8');
    const code = s
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');
    assert.doesNotMatch(
      code,
      /m09997818@gmail\.com/,
      `${fichier} renvoie encore vers l’adresse partagée avec l’autre projet.`
    );
  }
});
