/**
 * ★ ACQUIS — DEUX ÉCRANS, DEUX RÔLES.
 *
 * ── CE QUE CHACUN MONTRE ──────────────────────────────────────────────────
 *
 * La page d'analyse ouvre avec ce qu'il y a de plus difficile à faire : le
 * score trouvé AU BUT PRÈS. Quarante cartes, en frise, du plus récent au plus
 * ancien. Rien d'autre.
 *
 * La page dédiée répond à « et tout le reste ? » : les 211 réussites, issues
 * justes comprises.
 *
 * ── CE QUI NE DOIT JAMAIS ÊTRE FILTRÉ ─────────────────────────────────────
 *
 * Le bandeau de chiffres. Il compte le palmarès entier — 61 scores exacts,
 * 211 analyses réussies, 50 compétitions — même quand la liste en dessous n'en
 * montre que quarante. Filtrer le décompte avec la liste ferait afficher
 * « 40 analyses réussies » et diviserait par cinq la preuve la plus vendeuse
 * du site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const LIB = 'src/lib/preuves.ts';
const SECTION = 'src/components/preuves/SectionPreuves.tsx';
const PAGE = 'src/app/(dashboard)/preuves/page.tsx';

test('★ ACQUIS — la page d’analyse ne montre que des scores exacts', () => {
  const s = sansCommentaires(lire(SECTION));
  assert.match(s, /scoresExactsSeuls = true/, 'La page d’analyse remontre les issues justes.');
  assert.match(s, /uniquementScoresExacts: scoresExactsSeuls/);
  assert.match(s, /ordreChronologique: scoresExactsSeuls/, 'L’ordre chronologique a sauté.');
});

test('★ ACQUIS — quarante cartes, ni huit ni seize', () => {
  const s = sansCommentaires(lire(SECTION));
  const m = s.match(/limite = (\d+)/);
  assert.ok(m, 'La limite a disparu.');
  assert.equal(Number(m![1]), 40);
});

test('★ ACQUIS — le bandeau compte TOUT, la liste seule est filtrée', () => {
  // Relevé le 29 août 2026 : 61 scores exacts, 211 réussites, 50 compétitions.
  // Ces trois nombres doivent survivre au filtre de la liste.
  const s = sansCommentaires(lire(LIB));
  assert.match(s, /const montrees = options\.uniquementScoresExacts/, 'Le filtre a disparu.');
  assert.match(s, /preuves: liste\.slice\(0, limite\)/, 'La liste n’est plus tirée du filtre.');
  assert.match(s, /reussites: ordonnees\.length/, 'Le bandeau est filtré avec la liste.');
  assert.match(
    s,
    /scoresExacts: ordonnees\.filter\(\(p\) => p\.scoreExact\)\.length/,
    'Le décompte des scores exacts est filtré avec la liste.'
  );
});

test('★ ACQUIS — le plafond de lecture ne ment plus sur le nombre de réussites', () => {
  // Il était à 200 alors que la base en comptait 211 : onze réussites réelles
  // disparaissaient du bandeau, et le bouton promettait « 200 preuves »
  // quand il y en avait davantage.
  // Le fichier contient plusieurs plafonds : on ne lit QUE celui de la
  // fonction qui alimente le mur public, sinon le test surveille une autre
  // requête et devient un décor.
  const s = sansCommentaires(lire(LIB));
  const debut = s.indexOf('export async function getPreuvesPubliques');
  const fin = s.indexOf('export async function getToutesPreuves');
  assert.ok(debut > 0 && fin > debut, 'La fonction du mur public est introuvable.');

  const m = s.slice(debut, fin).match(/\.limit\((\d+)\)/);
  assert.ok(m, 'Le plafond de lecture du mur a disparu.');
  assert.ok(Number(m![1]) >= 1000, `Plafond trop bas : ${m![1]} — des réussites seraient perdues.`);
});

test('★ ACQUIS — la page dédiée montre tout le palmarès', () => {
  // Le bouton promet « voir les 211 preuves ». Elle en montrait soixante.
  const s = sansCommentaires(lire(PAGE));
  const m = s.match(/getPreuvesPubliques\((\d+)\)/);
  assert.ok(m, 'L’appel a disparu.');
  assert.ok(Number(m![1]) >= 1000, `La page dédiée n’en montre que ${m![1]}.`);
});
