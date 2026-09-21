/**
 * ★ ACQUIS — UNE ERREUR D'ANALYSE DIT LA VÉRITÉ.
 *
 * Constaté le 21 septembre 2026 : un abonné à 60 analyses sur 60 lisait
 * « Une erreur de connexion au modèle d'intelligence artificielle est
 * survenue » et croyait l'application en panne. Même message pour une page
 * ouverte avant une mise à jour, dont la carte renvoyait « Équipe inconnue ».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ecran = () => fs.readFileSync('src/app/(dashboard)/analyze/AnalyzeClient.tsx', 'utf8');

test('★ ACQUIS — plus de fausse « panne du modèle »', () => {
  assert.doesNotMatch(ecran(), /erreur de connexion au modèle d'intelligence artificielle/, 'Le message qui fait croire à une panne est revenu.');
});

test('★ ACQUIS — une équipe inconnue du serveur a son propre message', () => {
  const s = ecran();
  assert.match(s, /if \(res\.status === 404\) throw new Error\("Équipes introuvables"\)/, 'Un 404 retombe dans le message général.');
  assert.match(s, /Rechargez la page, puis choisissez-le de nouveau/, 'Le remède (recharger la page) n’est plus proposé.');
});

test('★ ACQUIS — le quota épuisé est dit, avec sa date de renouvellement', () => {
  const s = ecran();
  assert.match(s, /quota\.remaining <= 0 && \(/, 'L’erreur ne dit plus que le quota est épuisé.');
  assert.match(s, /elles se renouvellent le/, 'La date de renouvellement n’est plus annoncée.');
});
