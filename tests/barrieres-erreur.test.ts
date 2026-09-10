/**
 * ★ ACQUIS — UNE PAGE QUI TOMBE N'EMPORTE PAS L'APPLICATION, ET LE BOUTON
 * « RÉESSAYER » FAIT QUELQUE CHOSE.
 *
 * ── CE QU'UN CLIENT PAYANT A PHOTOGRAPHIÉ LE 10 SEPTEMBRE 2026 À 11 H 46 ──
 *
 * Un écran noir plein cadre, « Un souci est survenu », plus de menu, plus de
 * logo. Et le bouton « Réessayer » ne faisait rien.
 *
 * ── LES DEUX CAUSES ──────────────────────────────────────────────────────
 *
 *   1. `global-error.tsx` était la SEULE barrière d'erreur du projet. Elle
 *      remplace le gabarit racine : tout ce qui échouait, n'importe où,
 *      remontait jusqu'à elle et emportait l'écran entier. Une lecture de
 *      base qui abandonne sur une fiche de club coûtait l'application.
 *
 *   2. Le bouton appelait `reset()`. La documentation de CETTE version du
 *      cadre est explicite : `reset()` « efface l'état d'erreur et re-rend
 *      les enfants SANS aller rechercher le contenu ». Sur une panne côté
 *      serveur, il ne pouvait donc produire que le même écran. C'est
 *      `retry()` qui redemande au serveur.
 *
 * ── ET UN TROISIÈME MANQUE, PLUS SOURNOIS ────────────────────────────────
 *
 * En production, le message d'une erreur venue du serveur est volontairement
 * générique : il ne dit rien de la cause. Seul `error.digest` permet de
 * retrouver la trace serveur. Il n'était affiché nulle part — une capture
 * d'écran de client ne servait donc qu'à deviner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const existe = (p: string) => fs.existsSync(path.join(process.cwd(), p));
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const GLOBALE = 'src/app/global-error.tsx';
const PARTAGE = 'src/components/EcranErreurSegment.tsx';
const PUBLIQUE = 'src/app/error.tsx';
const ABONNE = 'src/app/(dashboard)/error.tsx';

test('★ ACQUIS — l’espace abonné et les pages publiques ont leur propre barrière', () => {
  // Sans elles, TOUT remonte à `global-error`, qui remplace le gabarit racine :
  // l'abonné perd la barre latérale, la navigation, et se retrouve enfermé.
  assert.ok(existe(ABONNE), 'L’espace abonné n’a plus de barrière : une page qui tombe emporte tout.');
  assert.ok(existe(PUBLIQUE), 'Les pages publiques n’ont plus de barrière.');
  assert.ok(existe(PARTAGE), 'L’écran partagé a disparu : les barrières vont diverger.');

  // Une barrière DOIT être un composant client, sinon le cadre la refuse.
  for (const f of [GLOBALE, PUBLIQUE, ABONNE, PARTAGE]) {
    assert.match(lire(f), /^'use client';/m, `${f} n’est plus un composant client.`);
  }
});

test('★ ACQUIS — « Réessayer » redemande au serveur, jamais un simple re-rendu', () => {
  for (const f of [GLOBALE, PARTAGE]) {
    const s = sansCommentaires(lire(f));

    // `retry` doit être tenté EN PREMIER.
    assert.match(
      s,
      /typeof retry === 'function'[\s\S]{0,80}retry\(\)/,
      `${f} : le bouton n’essaie plus « retry », qui est le seul à rechercher le contenu.`
    );

    // Et il doit rester un recours quand `retry` n'est pas fourni.
    assert.match(
      s,
      /window\.location\.reload\(\)/,
      `${f} : plus aucun recours si « retry » manque — le bouton peut redevenir inerte.`
    );

    // `reset()` ne doit JAMAIS être la seule action du bouton : il re-rend
    // sans rechercher, donc rejoue l'échec à l'identique.
    assert.doesNotMatch(
      s,
      /onClick=\{\(\) => reset\(\)\}/,
      `${f} : le bouton rejoue le rendu qui vient d’échouer.`
    );
  }
});

test('★ ACQUIS — l’identifiant de l’erreur est affiché', () => {
  // C'est lui qui transforme une photo d'écran en diagnostic.
  for (const f of [GLOBALE, PARTAGE]) {
    const s = lire(f);
    assert.match(s, /error\?\.digest/, `${f} : l’identifiant n’est plus affiché.`);
    assert.match(s, /réf\./, `${f} : l’identifiant n’est plus présenté au client.`);
  }
});

test('★ ACQUIS — une coupure réseau se répare toute seule', () => {
  // Sur un téléphone en 3G, ce n'est pas toujours le morceau de code qui
  // manque : c'est la requête qui n'aboutit pas. Le navigateur dit alors
  // « Failed to fetch », « Load failed » (Safari) ou « NetworkError ».
  // Sans ces signes, le visiteur restait bloqué sur un écran définitif alors
  // qu'un rechargement suffisait.
  const s = sansCommentaires(lire(GLOBALE));
  for (const signe of ['ChunkLoadError', 'Loading chunk', 'Failed to fetch', 'NetworkError', 'Load failed']) {
    assert.ok(s.includes(signe), `Le signe « ${signe} » n’est plus reconnu comme réparable.`);
  }

  // Le rechargement automatique reste limité à UNE fois : une page qui se
  // recharge en boucle est pire qu'une page en erreur.
  assert.match(s, /sessionStorage\.getItem\(CLE_RECHARGE\)/, 'Le garde-fou anti-boucle a sauté.');
});
