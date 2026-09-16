import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cleDUneErreur, prefixeDuJour, resumeDeLErreur } from '../src/lib/erreurs-affichage';

/**
 * ── POURQUOI CES GARDE-FOUS ───────────────────────────────────────────────
 *
 * Les 15 et 16 septembre 2026, le propriétaire a vu « Cette page n'a pas pu
 * s'afficher » sur trois matchs. Le 16, sur Atlético–Osasuna, je n'ai PAS pu le
 * reproduire : ni en gratuit, ni en abonné, ni en mobile, ni en faisant défiler
 * vingt et un mille pixels d'analyse. Une erreur née dans le navigateur
 * n'apparaît dans aucun journal du serveur, et l'écran n'en disait rien.
 *
 * Depuis, chaque écran d'erreur envoie sa cause exacte, et en affiche un
 * résumé. Ces tests empêchent que l'un ou l'autre disparaisse.
 */
const lire = (p: string) => fs.readFileSync(p, 'utf8');

test('★ ACQUIS — deux erreurs ne peuvent jamais partager la même ligne', () => {
  // Première version : une liste par jour, relue puis réécrite. Éprouvée le
  // 16 septembre 2026 : trois signalements reçus, UN SEUL gardé — la relecture
  // abandonnait en silence et chaque écriture écrasait la précédente.
  const quand = '2026-09-16T10:55:29.192Z';
  const cles = new Set(Array.from({ length: 200 }, () => cleDUneErreur(quand)));
  assert.equal(cles.size, 200, 'Deux erreurs de la même milliseconde ont reçu la même clé.');
  for (const c of cles)
    assert.ok(c.startsWith(prefixeDuJour('2026-09-16')), `La clé ${c} ne se retrouve plus par son jour.`);
});

test('★ ACQUIS — la route n’écrit jamais en relisant d’abord', () => {
  const s = lire('src/app/api/erreur-affichage/route.ts');
  assert.match(s, /cleDUneErreur\(/, 'La route n’écrit plus une ligne par erreur.');
  assert.doesNotMatch(
    s,
    /lireReserve|from\('cache_api'\)\.select/,
    'La route relit avant d’écrire : deux signalements rapprochés s’écraseront de nouveau.'
  );
  assert.match(s, /after\(/, 'L’écriture n’est plus faite après la réponse : le visiteur attendra.');
  assert.match(s, /isRateLimited\(/, 'La route n’est plus limitée : n’importe qui pourrait remplir la réserve.');
});

test('★ ACQUIS — l’écran d’erreur envoie sa cause et en affiche le résumé', () => {
  const s = lire('src/components/EcranErreurSegment.tsx');
  assert.match(s, /\/api\/erreur-affichage/, 'L’écran d’erreur n’envoie plus sa cause : on redevra deviner.');
  assert.match(s, /sendBeacon/, 'Le signalement ne survit plus à un rechargement immédiat.');
  assert.match(s, /resumeDeLErreur\(error\)/, 'L’écran n’affiche plus la nature de la panne.');
});

test('le résumé nomme la panne sans jamais lever', () => {
  const e = Object.assign(new TypeError("Cannot read properties of undefined (reading 'trim')"), {
    __NEXT_ERROR_CODE: 'E394',
  });
  const r = resumeDeLErreur(e);
  assert.match(r, /E394/);
  assert.match(r, /TypeError/);
  assert.match(r, /Cannot read properties/);

  // Une erreur banale ne répète pas « Error ».
  assert.equal(resumeDeLErreur(new Error('boum')), 'boum');

  for (const vide of [null, undefined, {}, 'texte', 42])
    assert.doesNotThrow(() => resumeDeLErreur(vide as any));
});
