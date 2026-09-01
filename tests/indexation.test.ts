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

// ── LES TARIFS SE FERMENT ──────────────────────────────────────────────────

test('★ ACQUIS — les tarifs ne s’ouvrent plus à un visiteur sans compte', () => {
  // Décision du propriétaire, le 1er septembre 2026. Une grille de prix vue
  // par quelqu'un qui ignore ce que fait le produit ne vend rien — et c'est
  // par là qu'arrivaient les acheteurs sans compte, ceux dont la vente n'avait
  // ensuite aucun compte à qui se rattacher.
  const s = sansCommentaires(lire('src/utils/supabase/middleware.ts'));
  assert.match(s, /const protectedPaths = \[[^\]]*'\/pricing'/, 'Les tarifs sont de nouveau ouverts à tous.');
});

test('★ ACQUIS — on l’envoie s’INSCRIRE, pas se connecter', () => {
  // Les autres pages protégées appartiennent à quelqu'un qui a déjà un compte.
  // Les tarifs, non : celui qui les regarde n'a par définition rien acheté.
  // Lui demander ses identifiants, c'est lui demander ce qu'il n'a pas — et le
  // 23 août 2026, quelqu'un au Bénin a fait trois allers-retours entre les deux
  // écrans avant d'abandonner en soixante-sept secondes.
  const s = sansCommentaires(lire('src/utils/supabase/middleware.ts'));
  assert.match(s, /const versInscription = \['\/pricing'\]/, 'La liste des pages menant à l’inscription a disparu.');
  assert.match(
    s,
    /versInscription\.some\(\(p\) => chemin === p \|\| chemin\.startsWith\(p \+ '\/'\)\)\s*\?\s*'\/signup'\s*:\s*'\/login'/,
    'Un nouveau visiteur est de nouveau envoyé vers la connexion.'
  );
  // La page demandée reste mémorisée : il revient aux tarifs après s'être
  // inscrit, plutôt que d'atterrir ailleurs et de devoir recommencer.
  assert.match(s, /url\.searchParams\.set\('suite', request\.nextUrl\.pathname\)/, 'La page demandée n’est plus mémorisée.');
});
