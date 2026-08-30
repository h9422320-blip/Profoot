/**
 * ★ ACQUIS — LA MAQUETTE DE L'ACCUEIL NE MONTRE PAS DE DATES PÉRIMÉES.
 *
 * ── CE QUE VOYAIT UN VISITEUR LE 30 AOÛT 2026 ─────────────────────────────
 *
 * La maquette du produit, sur la page d'accueil, annonçait « Prochains
 * matchs » avec deux dates écrites en dur : 03/04 et 08/04. Cinq mois en
 * arrière — et juste à côté d'un badge « Temps Réel » et d'une promesse de
 * « données actualisées en permanence, pas de cache périmé ».
 *
 * L'illustration contredisait l'argument de vente qu'elle est censée porter.
 * C'est la première page que voit un acheteur.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ACCUEIL = 'src/app/LandingClient.tsx';

test('★ ACQUIS — aucune date écrite en dur dans la maquette', () => {
  const s = sansCommentaires(lire(ACCUEIL));
  const dures = s.match(/>\d{2}\/\d{2}<br\/>/g) ?? [];
  assert.equal(dures.length, 0, `Dates figées retrouvées : ${dures.join(', ')}`);
  assert.match(s, /useDateProche/, 'Le calcul de date relative a disparu.');
});

test('★ ACQUIS — la date est calculée dans le navigateur, jamais au rendu', () => {
  // Cette page est mise en cache et servie identique à tout le monde : une date
  // calculée pendant le rendu serait figée au jour de sa fabrication — très
  // exactement le défaut qu'on répare.
  const s = sansCommentaires(lire(ACCUEIL));
  assert.match(
    s,
    /function useDateProche[\s\S]{0,400}useEffect\(\(\) => \{[\s\S]{0,300}setTexte/,
    'La date n’est plus calculée après l’affichage.'
  );
  // Le repli est une chaîne vide, jamais une fausse date : mieux vaut un blanc
  // d'une seconde qu'un mensonge.
  assert.match(s, /useState\(''\)/, 'Le repli n’est plus neutre.');
  assert.match(s, /suppressHydrationWarning/, 'La divergence serveur/navigateur est signalée comme une anomalie.');
});
