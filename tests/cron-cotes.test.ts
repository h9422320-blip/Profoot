/**
 * ★ ACQUIS — LE RELEVÉ DES COTES A SON PROPRE PASSAGE.
 *
 * Dans la tâche de minuit, il n'avait que 90 s sur 300 partagées, et ne
 * passait qu'un tiers des compétitions par nuit : une ligue manquée attendait
 * trois jours, et les rencontres analysées entre-temps étaient calculées sans
 * la couche la plus précise du moteur.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — la tâche des cotes est planifiée et protégée', () => {
  const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const tache = (v.crons ?? []).find((c: any) => c.path === '/api/cron/cotes');
  assert.ok(tache, 'La tâche des cotes a disparu du calendrier.');
  assert.match(String(tache.schedule), /^\d+ \d+ \* \* \*$/, 'Elle doit tourner une fois par jour.');

  const s = fs.readFileSync('src/app/api/cron/cotes/route.ts', 'utf8');
  assert.match(s, /autoriserCron\(request, 'cotes'\)/, 'La route n’est plus protégée : elle consomme le quota du fournisseur.');
  assert.match(s, /releverCotes\(new Date\(\), 240_000\)/, 'Le budget du relevé a changé.');
  assert.match(s, /export const maxDuration = 300;/);
});

test('★ ACQUIS — la tâche de minuit garde son relevé', () => {
  // Deux passages valent mieux qu'un : un relevé COMPLÈTE l'autre.
  const s = fs.readFileSync('src/app/api/cron/refresh/route.ts', 'utf8');
  assert.match(s, /await releverCotes\(\)/);
});
