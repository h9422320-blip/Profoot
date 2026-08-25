/**
 * ★ ACQUIS — L'AUTHENTIFICATION N'EST INTERROGÉE QUE QUAND ELLE SERT.
 *
 * ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────────
 *
 * Le 25 août 2026 à 21 h, le projet Supabase est passé en « Malsain » :
 * 23 946 requêtes en une heure, 0,0 % de réussite, 800 erreurs Postgres sur
 * 818 requêtes. Plus personne ne pouvait se connecter — un influenceur l'a
 * signalé, et la page de connexion répondait « une erreur inattendue est
 * survenue ». Le tableau de bord annonçait « dépassement des limites
 * d'utilisation » sur un serveur NANO en plan gratuit.
 *
 * La cause vivait dans le middleware. Il s'exécute sur CHAQUE requête et
 * appelait `getUser()` — un appel réseau à Supabase — même pour afficher la
 * page d'accueil. À lui seul : 23 127 des requêtes d'authentification.
 *
 * ── LE PIÈGE QUE CES TESTS SURVEILLENT ────────────────────────────────────
 *
 * Une optimisation du chemin d'authentification peut ouvrir une porte sans
 * qu'on s'en aperçoive : il suffit qu'un chemin protégé cesse d'exiger
 * l'identité pour que n'importe qui atteigne l'analyse payante ou
 * l'administration.
 *
 * Ces tests tiennent les deux bouts : l'appel doit être évité sur les pages
 * publiques, ET rester obligatoire partout où il protège quelque chose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/utils/supabase/middleware.ts'),
  'utf8'
);

test('★ ACQUIS — l identité n est demandée que si elle sert', () => {
  // L'appel doit être CONDITIONNEL. S'il redevient inconditionnel, la base
  // reprend 23 000 requêtes par heure et retombe.
  assert.match(
    source,
    /const\s+user\s*=\s*besoinDIdentite\s*\?/,
    "`getUser()` est redevenu inconditionnel dans le middleware : chaque page " +
      'publique déclenche de nouveau un appel réseau à Supabase.'
  );

  // Et il ne doit exister qu'UN SEUL appel dans tout le fichier : un second,
  // ajouté plus bas sans condition, annulerait tout le bénéfice.
  //
  // Les COMMENTAIRES sont retirés avant de compter. La première version de ce
  // test en trouvait deux et criait à la régression : le second n'était pas un
  // appel, mais la phrase « Do not run code between createServerClient and
  // supabase.auth.getUser() » — un commentaire de la documentation Supabase.
  // Un test qui compte des mots dans des commentaires accuse du code sain.
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
  const appels = (sansCommentaires.match(/auth\.getUser\(\)/g) ?? []).length;
  assert.equal(
    appels,
    1,
    `Le middleware fait ${appels} appels à getUser() au lieu d'un seul.`
  );
});

test('★ ACQUIS — tout chemin protégé exige toujours l identité', () => {
  // Le point de sécurité. `besoinDIdentite` doit couvrir les pages protégées :
  // sans identité, `activeUser` vaut null, et la redirection vers /login se
  // déclencherait pour TOUT LE MONDE — ou pire, un contrôle d'administration
  // pourrait passer sur un utilisateur inconnu.
  assert.match(
    source,
    /const\s+besoinDIdentite\s*=\s*isProtectedPath\s*\|\|/,
    'La condition ne part plus des chemins protégés : une page payante ' +
      "pourrait s'ouvrir sans que personne ne soit identifié."
  );

  // La liste des chemins protégés doit rester complète. Chacun garde du
  // contenu payant ou des droits.
  for (const chemin of [
    '/dashboard',
    '/analyze',
    '/settings',
    '/history',
    '/search',
    '/expert',
    '/payment-success',
    '/payment-failed',
    '/admin',
  ]) {
    assert.ok(
      source.includes(`'${chemin}'`),
      `Le chemin protégé ${chemin} a disparu de la liste du middleware.`
    );
  }
});

test('★ ACQUIS — les routes API restent identifiées', () => {
  // Elles portent leur propre vérification, mais elles sont aussi le seul
  // endroit qui sache RÉÉCRIRE les cookies : un composant serveur ne le peut
  // pas. Les en sortir casserait le rafraîchissement du jeton.
  assert.match(
    source,
    /chemin\.startsWith\('\/api\/'\)/,
    "Les routes /api ne demandent plus l'identité : le jeton de session ne " +
      'peut plus être rafraîchi nulle part.'
  );
});

test('★ ACQUIS — le verrou de l administration n a pas bougé', () => {
  // Le contrôle admin doit rester en place ET porter sur l'utilisateur
  // réellement retenu après la vérification des 24 h, jamais sur autre chose.
  assert.match(
    source,
    /startsWith\('\/admin'\)[\s\S]{0,200}estAdmin\(activeUser\?\.email\)/,
    "Le contrôle d'accès à l'administration a été modifié ou déplacé."
  );

  // Et la session de 24 h doit toujours être invalidée au-delà du délai.
  assert.match(
    source,
    /MAX_SESSION_AGE_MS/,
    'La limite de 24 h sur la session a disparu.'
  );
});
