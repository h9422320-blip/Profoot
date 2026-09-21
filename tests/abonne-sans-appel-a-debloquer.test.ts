/**
 * ★ ACQUIS — UN ABONNÉ NE LIT JAMAIS « DÉBLOQUEZ ».
 *
 * Constaté le 21 septembre 2026 sur Côte d'Ivoire–Ghana, avec un compte VIP :
 * le modèle de langage n'avait pas répondu, l'analyse est tombée sur son
 * secours, et le secours emprunte le rédacteur de l'avant-goût gratuit — qui
 * finit par « Débloquez l'analyse complète pour tout voir. »
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { composerApercu } from '../src/lib/apercu-vendeur';

test('★ ACQUIS — le texte d’un abonné ne l’invite pas à débloquer', () => {
  const pourAbonne = composerApercu('Côte d’Ivoire', 'Ghana', undefined, undefined, {
    competition: 'Africa Cup of Nations - Qualification',
    pourUnAbonne: true,
  });
  assert.doesNotMatch(pourAbonne, /bloqu/i, 'Un abonné est invité à débloquer ce qu’il a déjà payé.');
  // Le visiteur gratuit, lui, garde son invitation.
  const pourVisiteur = composerApercu('Côte d’Ivoire', 'Ghana', undefined, undefined, { competition: 'X' });
  assert.match(pourVisiteur, /Débloquez/, 'L’avant-goût gratuit a perdu son invitation.');
});

test('★ ACQUIS — les deux secours de l’analyse complète se déclarent lus par un abonné', () => {
  const s = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  const appels = s.split('composerApercuVendeur(').length - 1;
  const declares = (s.match(/pourUnAbonne: true/g) ?? []).length;
  assert.ok(appels >= 2, 'Le rédacteur n’est plus appelé par l’analyse : ce test ne garde plus rien.');
  assert.equal(declares, appels, 'Un appel au rédacteur, dans l’analyse payante, a oublié qu’il parle à un abonné.');
});
