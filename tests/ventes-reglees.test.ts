/**
 * ★ ACQUIS — FAIRE TAIRE UNE ALERTE DEMANDE D'ÉCRIRE POURQUOI.
 *
 * Une vente réglée autrement — un mois ajouté sur l'abonnement existant, par
 * exemple — ne portera jamais d'abonnement à son nom, et ressort donc chaque
 * jour comme « payé, jamais servi ». Une alerte qui se répète pour une raison
 * connue cesse d'être lue, et finit par cacher le vrai cas.
 *
 * Mais une liste d'exceptions est aussi l'endroit le plus commode où glisser
 * un cas gênant. Ces assertions rendent ce geste impossible à faire en
 * silence : identifiant complet, raison écrite, date du règlement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VENTES_REGLEES, venteReglee } from '../src/lib/ventes-reglees';

test('★ ACQUIS — chaque vente réglée porte un identifiant complet, une raison et une date', () => {
  for (const [id, v] of VENTES_REGLEES) {
    // L'identifiant ENTIER : deux ventes peuvent partager leurs huit premiers
    // caractères, et un préfixe ferait taire l'alerte de quelqu'un d'autre.
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      `« ${id} » n'est pas un identifiant de vente complet.`
    );
    assert.ok(
      v.raison.trim().length >= 80,
      `La vente ${id} est écartée sans que la raison soit vraiment écrite.`
    );
    assert.match(v.le, /^\d{4}-\d{2}-\d{2}$/, `La vente ${id} n'a pas de date de règlement.`);
  }
});

test('★ ACQUIS — la reconnaissance se fait sur l’identifiant exact', () => {
  const [premier] = [...VENTES_REGLEES.keys()];
  assert.ok(venteReglee(premier), 'Une vente réglée n’est plus reconnue.');
  assert.equal(venteReglee(premier.slice(0, 8)), null, 'Un préfixe suffit à faire taire une alerte.');
  assert.equal(venteReglee(''), null, 'Une vente sans identifiant est traitée comme réglée.');
  assert.equal(venteReglee(null), null, 'Une vente sans identifiant est traitée comme réglée.');
  assert.equal(venteReglee(premier + 'x'), null, 'Un identifiant approchant suffit à faire taire une alerte.');
});

test('★ ACQUIS — l’audit quotidien consulte cette liste', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const s = fs.readFileSync('src/lib/acces-manquants.ts', 'utf8');
  assert.match(s, /venteReglee/, 'Le rattrapage des accès ne consulte plus les ventes réglées : le bruit revient.');
});
