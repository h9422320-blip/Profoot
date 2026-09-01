/**
 * ★ ACQUIS — LES TARIFS, L'INSCRIPTION ET LA CONNEXION RESTENT HORS DE GOOGLE.
 *
 * ── LA DÉCISION, ET SON MOTIF ─────────────────────────────────────────────
 *
 * Prise par le propriétaire le 1er septembre 2026 : personne ne doit arriver
 * sur ces pages depuis un moteur de recherche. Le parcours voulu part de la
 * page d'accueil, passe par l'inscription, et ne propose l'achat qu'ensuite.
 *
 * Quelqu'un qui tombe sur une grille de tarifs sans avoir rien vu du produit ne
 * sait pas ce qu'il achète — et c'est précisément par là qu'arrivaient les
 * acheteurs sans compte.
 *
 * ── LE PIÈGE QUE CE FICHIER PROTÈGE ───────────────────────────────────────
 *
 * Interdire une adresse dans `robots.txt` NE LA DÉSINDEXE PAS : elle reste
 * dans l'index de Google, marquée « bloquée », et le robot n'a alors même plus
 * le droit de venir lire le `noindex` qui l'en ferait sortir.
 *
 * Les deux mesures se contrarient. C'est le `noindex` de chaque page qui fait
 * le travail ; `robots.txt` doit rester silencieux sur ces adresses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const PAGES: [string, string][] = [
  ['/login', 'src/app/login/layout.tsx'],
  ['/signup', 'src/app/signup/layout.tsx'],
  ['/pricing', 'src/app/(dashboard)/pricing/page.tsx'],
];

test('★ ACQUIS — les trois pages portent un noindex', () => {
  for (const [route, fichier] of PAGES) {
    const s = sansCommentaires(lire(fichier));
    assert.match(
      s,
      /robots: \{ index: false, follow: true \}/,
      `${route} peut de nouveau être indexée par Google.`
    );
  }
});

test('★ ACQUIS — « follow » reste vrai', () => {
  // Un `nofollow` couperait les liens internes de ces pages, et avec eux le
  // référencement des pages qu'elles pointent. On veut les sortir de l'index,
  // pas les isoler du site.
  for (const [route, fichier] of PAGES) {
    const s = sansCommentaires(lire(fichier));
    assert.doesNotMatch(s, /follow: false/, `${route} coupe ses liens internes.`);
  }
});

test('★ ACQUIS — elles ne sont plus déclarées dans le plan du site', () => {
  // Les déclarer tout en leur posant un `noindex` serait se contredire : on
  // demanderait à Google d'indexer une page qui lui dit de ne pas le faire.
  const s = sansCommentaires(lire('src/app/sitemap.ts'));
  for (const route of ['/pricing', '/signup', '/login']) {
    assert.ok(
      !s.includes(`\${SITE_URL}${route}\``),
      `${route} est encore poussée à Google par le plan du site.`
    );
  }
  // Le mur de preuves, lui, RESTE : c'est la seule page qui porte du contenu
  // renouvelé et vérifiable, et c'est elle qui distingue le site.
  assert.ok(s.includes('${SITE_URL}/preuves`'), 'Le mur de preuves a disparu du plan du site.');
});

test('★ ACQUIS — robots.txt ne les interdit PAS', () => {
  // Le piège : une adresse interdite aux robots reste dans l'index, marquée
  // « bloquée », et le robot ne peut plus venir lire le `noindex`.
  const s = sansCommentaires(lire('src/app/robots.ts'));
  const disallow = s.slice(s.indexOf('disallow:'), s.indexOf('],', s.indexOf('disallow:')));
  for (const route of ['/pricing', '/signup', '/login']) {
    assert.ok(
      !disallow.includes(`'${route}'`),
      `${route} est interdite dans robots.txt : le noindex ne pourra jamais être lu, et l’adresse restera dans Google.`
    );
  }
});
