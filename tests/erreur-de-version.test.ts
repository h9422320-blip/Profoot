import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { estErreurDeVersion } from '../src/lib/nouvelle-version';

/**
 * ── « CETTE PAGE N'A PAS PU S'AFFICHER » : CE QUI L'A VRAIMENT CAUSÉE ─────
 *
 * Le propriétaire l'a rencontrée quatre ou cinq fois les 14 et 15 septembre
 * 2026, dont deux fois sur le match mis en avant de la page d'accueil — celui
 * qu'ouvre justement quelqu'un qui découvre l'application. Ses mots : « ils
 * vont directement quitter l'application, ils vont dire que c'est de l'arnaque,
 * même le gratuit ne marche pas ».
 *
 * Relevée en production, l'erreur exacte est :
 *
 *     An unexpected response was received from the server.   (Next E394)
 *
 * Ce n'est ni le moteur, ni l'affichage : c'est le DÉPLOIEMENT. Le navigateur
 * garde la version chargée en arrivant ; chaque mise en ligne change celle du
 * serveur ; la réponse devient illisible pour lui. Une analyse dure une minute
 * et demie — la fenêtre la plus large de toute l'application pour qu'une mise
 * en ligne tombe au milieu.
 *
 * DEUX PROTECTIONS, ET IL FAUT LES DEUX.
 *
 *   `deploymentId`   fait recharger AVANT l'erreur. Mais il ne protège que les
 *                    navigateurs ayant déjà chargé une version qui le porte.
 *   le filet ici     rattrape ceux qui étaient déjà sur le site, et toute panne
 *                    de la même famille qu'on n'aurait pas prévue.
 *
 * Ces tests existent pour qu'aucune des deux ne disparaisse par inadvertance.
 */
const lire = (p: string) => fs.readFileSync(p, 'utf8');

test('★ ACQUIS — l’application porte un identifiant de version', () => {
  const s = lire('next.config.ts');

  assert.match(
    s,
    /deploymentId:/,
    'Sans identifiant de version, un déploiement casse les sessions ouvertes : ' +
      'le navigateur reçoit une réponse qu’il ne sait pas lire, et l’abonné voit ' +
      '« Cette page n’a pas pu s’afficher » au milieu de son analyse.'
  );

  // Il doit venir du déploiement, jamais d'une valeur écrite à la main : figée,
  // elle ne changerait plus jamais et ne protégerait plus rien.
  assert.match(
    s,
    /VERCEL_DEPLOYMENT_ID|VERCEL_GIT_COMMIT_SHA|NEXT_DEPLOYMENT_ID/,
    'L’identifiant de version doit venir du déploiement lui-même, sinon il ne ' +
      'change jamais et ne détecte aucun décalage.'
  );
});

test('★ ACQUIS — une erreur de version se répare toute seule', () => {
  // ── LA PANNE QUI A DURÉ TROIS JOURS, REJOUÉE À L’IDENTIQUE ──────────
  //
  // Les 14, 15 et 16 septembre 2026, le propriétaire a vu « Cette page n’a
  // pas pu s’afficher » au bout d’une analyse, et ses ventes ont baissé ces
  // jours-là. La cause : une mise en ligne renomme les morceaux de code, et
  // Turbopack lève alors EXACTEMENT ceci. Aucun des trois détecteurs du
  // projet ne le reconnaissait — démontré en rejouant cette erreur sur
  // l'ancien code. Si ce test tombe, la panne revient.
  const turbopack = new Error('Failed to load chunk /_next/static/immutable/chunks/0666khkr2mnoq.js from module 4521');
  turbopack.name = 'ChunkLoadError';
  assert.ok(
    estErreurDeVersion(turbopack),
    'La forme Turbopack du morceau manquant n’est plus reconnue : l’écran d’erreur reviendra après chaque mise en ligne.'
  );

  // Le NOM seul doit suffire, quel que soit le message.
  const nomSeul = new Error('peu importe'); nomSeul.name = 'ChunkLoadError';
  assert.ok(estErreurDeVersion(nomSeul), 'Le nom ChunkLoadError n’est plus lu : c’est le défaut exact de l’ancien détecteur.');

  // Les autres formes de la même panne.
  for (const message of [
    'An unexpected response was received from the server.',
    'Loading chunk 123 failed.',
    'Loading CSS chunk 77 failed.',
    'Failed to fetch dynamically imported module: https://profootai.com/_next/x.js',
    'Importing a module script failed.',
  ])
    assert.ok(estErreurDeVersion(new Error(message)), `« ${message} » n’est plus reconnu.`);
  assert.ok(estErreurDeVersion(Object.assign(new Error('x'), { __NEXT_ERROR_CODE: 'E394' })), 'Le code E394 n’est plus reconnu.');

  // ── ET RIEN D’AUTRE, DANS L’ÉCOUTE DE LA FENÊTRE ───────────────────────
  //
  // Une coupure réseau n’est PAS une panne de version. Si l’écoute de la
  // fenêtre la prenait pour telle, un compteur de visites qui n’aboutit pas
  // rechargerait la page en pleine analyse.
  assert.equal(estErreurDeVersion(new TypeError('Failed to fetch')), false, 'Une simple coupure passe pour une nouvelle version.');
  assert.equal(estErreurDeVersion(new TypeError('Cannot read properties of undefined')), false);
  for (const vide of [null, undefined, {}, 42])
    assert.doesNotThrow(() => estErreurDeVersion(vide));

  const ecoute = lire('src/components/RecuperationChargement.tsx');
  assert.match(ecoute, /estErreurDeVersion\(/, 'L’écoute de la fenêtre ne passe plus par le détecteur partagé.');
  assert.doesNotMatch(
    ecoute,
    /estErreurReparableParRechargement/,
    'L’écoute de la fenêtre reconnaît les coupures réseau : un appel secondaire qui échoue rechargera la page en pleine analyse.'
  );
  // En capture, sans quoi l’échec d’une balise <script> ne remonte pas.
  assert.match(ecoute, /addEventListener\('error', surErreur, true\)/, 'L’écoute ne voit plus les balises <script> en échec.');

  // ── ET UN SEUL RECHARGEMENT PAR DEMI-MINUTE ──────────────────────────
  const v = lire('src/lib/nouvelle-version.ts');
  assert.match(v, /export const ENTRE_DEUX_RECHARGEMENTS_MS = 30_000;/, 'Le délai entre deux rechargements a disparu ou changé sans mesure.');
  assert.match(v, /window\.location\.reload\(\)/, 'Plus aucun rechargement : l’abonné resterait devant l’erreur.');
});
