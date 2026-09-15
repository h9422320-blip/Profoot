import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  const s = lire('src/components/EcranErreurSegment.tsx');

  assert.match(
    s,
    /E394/,
    'L’écran d’erreur ne reconnaît plus le décalage de version. Il affichera ' +
      'donc « Cette page n’a pas pu s’afficher » là où un simple rechargement suffit.'
  );
  assert.match(
    s,
    /unexpected response was received from the server/i,
    'La reconnaissance par le message a disparu : un code d’erreur peut changer ' +
      'd’une version du cadre à l’autre, le message est le second filet.'
  );
  assert.match(
    s,
    /window\.location\.reload\(\)/,
    'Plus aucun rechargement : l’abonné resterait devant l’erreur.'
  );

  // ── ET UN SEUL RECHARGEMENT ────────────────────────────────────────────
  //
  // Si le serveur est réellement en panne et répond mal à chaque fois,
  // recharger en boucle ferait clignoter la page à l'infini — bien pire que
  // l'écran d'erreur, et impossible à quitter.
  assert.match(
    s,
    /sessionStorage\.(get|set)Item\(CLE_RECHARGEMENT/,
    'Le garde-fou contre la boucle de rechargement a disparu : une panne réelle ' +
      'ferait clignoter la page sans fin.'
  );
  assert.match(
    s,
    /const ENTRE_DEUX_MS = 30_000;/,
    'Le délai entre deux rechargements a disparu ou changé sans mesure.'
  );
});
