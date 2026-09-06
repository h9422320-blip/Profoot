import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * LE COMPTEUR DE VISITES NE DOIT PLUS POUVOIR FAIRE TOMBER LA BASE.
 *
 * ── CE QUI S'EST PASSÉ, DEUX FOIS ─────────────────────────────────────────
 *
 * Le 25 août 2026 à 21 h, puis le 5 septembre 2026 de 23 h 01 à 23 h 42, le
 * projet Supabase a cessé de répondre : 522 sur chaque lecture, plus une seule
 * connexion possible, l'application entière inaccessible aux abonnés. La
 * seconde fois, le tableau de bord affichait 525 617 requêtes en vingt-quatre
 * heures pour 0,0 % de réussite, sur un serveur MICRO.
 *
 * La cause, les deux fois, était `/api/mesure` — le compteur de visites. Il
 * part sur CHAQUE page ouverte et CHAQUE page quittée, robots compris, et il
 * coûtait alors, par visite :
 *
 *     3 appels d'authentification  (le portier, deux fois ; la route, une fois)
 *     6 opérations en base         (le compteur anti-abus ×4, l'écriture ×2)
 *
 * Soit, pour environ 45 000 pages vues par jour, à peu près 80 % de tout ce
 * que la base encaissait — pour compter des visites.
 *
 * ── CE QUE CE TEST TIENT ──────────────────────────────────────────────────
 *
 * Les trois économies, séparément. Chacune peut se défaire toute seule d'une
 * modification anodine ailleurs, et aucune ne se voit à la lecture : la panne
 * ne revient qu'au moment où le trafic monte, c'est-à-dire au pire moment.
 *
 * Ce test lit le CODE seul, jamais les commentaires : ceux de ces deux
 * fichiers citent `getUser` et `compterTentative` pour expliquer précisément
 * ce qu'on a retiré. Un test qui lirait les commentaires se validerait sur son
 * propre récit.
 */

/** Le code sans ses commentaires — les `://` des adresses restent intacts. */
const codeSeul = (chemin: string) =>
  fs
    .readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const PORTIER = 'src/utils/supabase/middleware.ts';
const ROUTE = 'src/app/api/mesure/route.ts';

test('★ ACQUIS — le portier n\'authentifie pas le compteur de visites', () => {
  const src = codeSeul(PORTIER);

  assert.ok(
    /SANS_IDENTITE\s*=\s*\[[^\]]*'\/api\/mesure'/.test(src),
    "/api/mesure est retombé dans le contrôle d'identité du portier. Chaque " +
      "page ouverte redéclenche alors un appel réseau à Supabase avant même " +
      "d'entrer dans la route — la cause exacte des pannes du 25 août et du " +
      '5 septembre 2026.'
  );

  assert.ok(
    /!SANS_IDENTITE\.includes\(chemin\)/.test(src),
    'La liste SANS_IDENTITE existe mais ne sert plus à décider. Elle ne ' +
      'protège donc plus rien.'
  );

  // La dispense vaut pour la mesure, et pour elle seule : le portier est la
  // seule barrière qui s'exécute avant tout le reste.
  const liste = src.match(/SANS_IDENTITE\s*=\s*\[([^\]]*)\]/);
  const chemins = (liste?.[1] ?? '').match(/'[^']+'/g) ?? [];
  assert.deepEqual(
    chemins,
    ["'/api/mesure'"],
    'Une route a été ajoutée à SANS_IDENTITE. Chaque ajout retire le contrôle ' +
      "d'identité AVANT l'entrée dans la route : cela se justifie une par une, " +
      'et jamais pour une route qui ouvre un droit ou sert du contenu payant.'
  );
});

test('★ ACQUIS — la mesure lit l\'identité sans appel réseau', () => {
  const src = codeSeul(ROUTE);

  assert.ok(
    /auth\.getClaims\(/.test(src),
    "La route n'utilise plus getClaims(). Les jetons du projet sont signés en " +
      'ES256 : getClaims() en vérifie la signature EN LOCAL, sans traverser le ' +
      'réseau, et refuse un jeton forgé exactement comme getUser().'
  );

  assert.ok(
    !/auth\.getUser\(/.test(src),
    'La route est revenue à getUser() : un aller-retour réseau vers Supabase à ' +
      "chaque page ouverte, pour la seule colonne compte_id."
  );
});

test('★ ACQUIS — la mesure est bornée sans écrire en base à chaque visite', () => {
  const src = codeSeul(ROUTE);

  const memoire = src.indexOf('isRateLimited(');
  const base = src.indexOf("compterTentative('mesure'");
  const ecriture = src.indexOf('.insert(');

  assert.ok(
    memoire !== -1,
    'Le premier palier a disparu. Chaque visiteur ordinaire repart alors compter ' +
      'en base : quatre opérations par visite dans cache_api — la table où vivent ' +
      'la fiabilité apprise et la sélection du jour.'
  );

  assert.ok(
    base !== -1,
    'Le second palier a disparu. Un compteur en mémoire seul repart de zéro à ' +
      'chaque instance neuve, et Vercel en démarre sans arrêt : un script ' +
      'retrouverait le moyen d\'insérer des millions de lignes.'
  );

  assert.ok(
    memoire < base,
    "Le compteur en base passe AVANT celui en mémoire : tout le trafic ordinaire " +
      'le traverse de nouveau, et l\'économie est annulée.'
  );

  assert.ok(
    base < ecriture,
    "La limite arrive APRÈS l'insertion : les lignes seraient écrites avant " +
      "d'être comptées."
  );
});
