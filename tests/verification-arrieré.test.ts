import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ★ ACQUIS — L'ARRIÉRÉ DE VÉRIFICATION NE PEUT PLUS S'INSTALLER.
 *
 * ── CE QUI S'ÉTAIT PASSÉ ──────────────────────────────────────────────────
 *
 * Au 24 août 2026 : 10 386 analyses produites, 3 045 vérifiées, 7 046 en
 * attente — et l'arriéré GRANDISSAIT de près de deux mille par jour.
 *
 * Trois causes, toutes dans le dimensionnement :
 *
 * 1. LE LOT COMPTAIT DES ANALYSES, PAS DES RENCONTRES. Dix-sept analyses
 *    portent en moyenne sur le même match : un lot de trois cents n'examinait
 *    qu'une vingtaine de rencontres, quand la boutique en produisait deux
 *    mille par jour.
 *
 * 2. L'ARRIÉRÉ ÉTAIT AFFAMÉ. Les analyses étaient prises de la plus récente à
 *    la plus ancienne. Les nouvelles passant devant chaque jour, les 1 871
 *    analyses de plus de trois jours n'avaient aucune chance d'être vues.
 *
 * 3. LE RÉSULTAT ÉTAIT CHERCHÉ PAR PAIRE D'ÉQUIPES, un appel par affiche —
 *    408 appels pour l'arriéré. Or chaque analyse porte l'identifiant de sa
 *    rencontre, et le fournisseur en accepte vingt par appel : 21 appels
 *    suffisaient.
 *
 * Après correction, mesuré le même jour : 4 530 analyses vérifiées d'un coup,
 * puis 2 653 restantes examinées en 6,6 secondes. Ce qui reste porte sur des
 * matchs pas encore joués.
 */

const RACINE = join(process.cwd(), 'src');
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');

const PRECISION = 'lib/precision-reelle.ts';
const CRON_NUIT = 'app/api/cron/refresh/route.ts';
const CRON_MATIN = 'app/api/cron/audit/route.ts';

test('★ ACQUIS — les résultats se lisent par paquets d’identifiants', () => {
  const src = lire(PRECISION);

  assert.ok(
    src.includes('IDENTIFIANTS_PAR_APPEL = 20'),
    'Le regroupement des identifiants a disparu. Sans lui, la vérification ' +
      'repasse à un appel par affiche : 408 appels au lieu de 21 pour le même ' +
      'arriéré, sur la ressource la plus rare du projet.'
  );

  assert.ok(
    src.includes('/fixtures?ids=${paquet.join(\'-\')}'),
    'La lecture groupée des rencontres n’est plus faite. C’est elle qui rend ' +
      'la résorption de l’arriéré possible en un seul passage.'
  );

  assert.ok(
    src.includes('PAQUETS_SIMULTANES'),
    'La limite de paquets simultanés a sauté. Lancer les vingt-et-un appels ' +
      'ensemble a fait refuser plusieurs requêtes le 24 août 2026 — « too many ' +
      'requests per minute » — et volerait le quota d’un abonné qui lance une ' +
      'analyse au même moment.'
  );
});

test('★ ACQUIS — une analyse qui connaît sa rencontre ne cherche pas par paire', () => {
  const src = lire(PRECISION);

  assert.ok(
    src.includes('const connue = rencontresParId.get(String(analyse.fixture_id));') &&
      src.includes('if (!connue) return null;'),
    'Le chemin rapide ne coupe plus court. Retomber sur la recherche par paire ' +
      'quand la rencontre n’est pas terminée relance un appel par affiche pour ' +
      'un résultat qui n’existe pas encore — et risque de ramener le match ' +
      'aller quand c’est le retour qui a été analysé.'
  );
});

test('★ ACQUIS — la lecture des analyses est paginée', () => {
  const src = lire(PRECISION);

  assert.ok(
    src.includes('.range(de, de + taille - 1)'),
    'La lecture n’est plus paginée. Supabase rend mille lignes au maximum et ' +
      'le dit sans erreur : un lot de dix mille en rendrait mille, et neuf ' +
      'dixièmes du travail demandé ne seraient jamais faits.'
  );

  assert.ok(
    !/\.limit\(limite\)/.test(src),
    'La lecture est revenue à « .limit(limite) », qui plafonne silencieusement ' +
      'à mille lignes.'
  );
});

test('★ ACQUIS — les deux tâches quotidiennes traitent des lots larges', () => {
  const nuit = lire(CRON_NUIT);
  const matin = lire(CRON_MATIN);

  const lotDe = (src: string) => {
    const m = src.match(/verifierPronostics\((\d+)\)/);
    return m ? Number(m[1]) : 0;
  };

  assert.ok(
    lotDe(nuit) >= 5000,
    `La tâche de minuit ne traite plus que ${lotDe(nuit)} analyses. En dessous ` +
      'de quelques milliers, l’arriéré grossit plus vite qu’il n’est traité et ' +
      'les analyses anciennes ne sont jamais atteintes.'
  );

  assert.ok(
    lotDe(matin) >= 3000,
    `La tâche de 5 h 37 ne traite plus que ${lotDe(matin)} analyses. Elle est le ` +
      'second filet : si celle de minuit échoue, c’est elle qui rattrape.'
  );
});

test('★ ACQUIS — les écritures partent par paquets de cent', () => {
  const src = lire(PRECISION);

  assert.ok(
    src.includes('TAILLE_PAQUET = 100'),
    'Les écritures sont reparties par vingt. Mesuré le 24 août 2026 : 4 530 ' +
      'analyses vérifiées en 237 secondes, quand la plateforme en accorde 300. ' +
      'Une journée un peu chargée ferait couper la tâche au milieu.'
  );
});
