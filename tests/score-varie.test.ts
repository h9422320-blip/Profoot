/**
 * ★ ACQUIS — LE SCORE SUIT LE MATCH, ET NON UNE LISTE ÉCRITE D'AVANCE.
 *
 * ── DEUX RÉPÉTITIONS, L'UNE APRÈS L'AUTRE ─────────────────────────────────
 *
 * D'abord le 2-1, servi sur un tiers des analyses, jusqu'à ce que le
 * propriétaire l'interdise le 3 septembre 2026.
 *
 * Puis les paliers censés le remplacer. Leur premier rang contient 3-0, 3-1,
 * 4-1 et 4-0, et l'on n'en descend que si aucun n'est plausible : toute
 * victoire un peu nette y tombait. Mesuré sur 2 305 rencontres — huit scores
 * en tout, 3-1 à 23,6 %, les deux premiers à 43 %.
 *
 * Le propriétaire l'a constaté le 5 septembre sur neuf analyses du jour : le
 * vainqueur marquait trois buts dans les neuf cas. Manchester City à 85 % et
 * Brentford à 60 % recevaient le même 3-0 — deux dominations sans rapport,
 * un seul score.
 *
 * ── CE QUI TIENT MAINTENANT ───────────────────────────────────────────────
 *
 * Chaque score compatible avec l'issue reçoit le poids que la loi de Poisson
 * lui donne pour CE match, aplati à la puissance 0,5 pour resserrer les
 * écarts sans inverser l'ordre. Trente-six scores, le plus servi à 12,8 %.
 *
 * L'issue, elle, est décidée AVANT : la justesse du résultat annoncé ne bouge
 * pas d'un dixième (50,1 % dans les deux cas), et un favori ne peut pas
 * recevoir un score perdant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const src = sansCommentaires(lire('src/lib/score-probable.ts'));

test('★ ACQUIS — le score est tiré dans la grille, pas dans une liste écrite', () => {
  assert.match(
    src,
    /const CHOIX_DU_SCORE = process\.env\.BANC_CHOIX_SCORE \|\| 'grille'/,
    'Le moteur est revenu à la liste de paliers : la répétition reviendra avec elle.'
  );
});

test('★ ACQUIS — l’aplatissement reste à la valeur mesurée', () => {
  /*
   * Six réglages essayés sur 2 305 rencontres avec le vrai moteur :
   *
   *     1     1-0 16,4 %   score exact 7,4 %
   *     0,8   1-0 14,8 %               7,2 %
   *     0,65  1-0 14,0 %               6,9 %
   *     0,5   1-0 12,8 %               6,8 %   <-- retenu
   *     0,35  1-0 11,7 %               6,2 %
   *     0,2   2-0 10,5 %               5,7 %
   *
   * 0,5 est le meilleur rapport : 3,6 points de concentration en moins pour
   * 0,6 point de précision. En dessous on paie deux fois plus cher, et à 0,35
   * une domination à 77 % rend des 3-2.
   */
  assert.match(
    src,
    /const APLATISSEMENT = Number\(process\.env\.BANC_APLATISSEMENT\) \|\| 0\.5/,
    'L’aplatissement a bougé — le remesurer sur le banc avant de le changer.'
  );
});

test('★ ACQUIS — le tirage du score est déterministe', () => {
  // Un abonné qui rouvre son analyse doit y retrouver le score qu'il a lu. Une
  // graine tirée du hasard le ferait changer à chaque affichage.
  assert.doesNotMatch(
    src,
    /Math\.random\(\)/,
    'Un tirage au hasard est apparu : le score changerait d’un affichage à l’autre.'
  );
  assert.match(
    src,
    /const graine =/,
    'La graine a disparu : le score cesse d’être stable d’un affichage à l’autre.'
  );
  assert.match(
    src,
    /butsAttendus1 \* 10_000/,
    'La graine ne vient plus des buts attendus du match.'
  );
});

test('★ ACQUIS — le 2-1 et son miroir restent hors du tirage', () => {
  /*
   * Décision du propriétaire, réaffirmée le 5 septembre 2026 : « on ne
   * réautorise pas le 2-1 ni le 1-2, l'interdiction reste en place, c'est ma
   * décision ».
   *
   * Elle a un coût mesuré et accepté : 1,1 point de score exact, et sur une
   * victoire extérieure serrée le moteur saute à 0-1 faute de pouvoir dire
   * 1-2 — Espanyol 0-1 Barcelone alors que le calcul attend 2,69 buts pour
   * Barcelone. Signalé, et laissé tel quel. Ne rien changer ici sans son
   * accord explicite.
   */
  assert.match(
    src,
    /if \(SANS_DEUX_UN && \(\(i === 2 && j === 1\) \|\| \(i === 1 && j === 2\)\)\) continue;/,
    'Le 2-1 est de nouveau tirable.'
  );
  assert.match(
    src,
    /const SANS_DEUX_UN = process\.env\.BANC_AVEC_DEUX_UN !== 'oui'/,
    'L’interdiction du 2-1 n’est plus active par défaut.'
  );
});

test('★ ACQUIS — l’issue est décidée AVANT le score', () => {
  // C'est ce qui garantit qu'aucun réglage de variété ne peut faire perdre un
  // favori. Le bug du 3 septembre — « Real Betis 2-1 Real Madrid » sur des
  // probabilités donnant Madrid gagnant — venait de l'ordre inverse.
  const posIssue = src.indexOf('const issueVisee:');
  const posTirage = src.indexOf("if (CHOIX_DU_SCORE === 'grille')");
  assert.ok(posIssue > 0 && posTirage > 0, 'Repères introuvables dans le moteur.');
  assert.ok(
    posIssue < posTirage,
    'Le score est choisi avant l’issue : un favori pourrait recevoir un score perdant.'
  );
});
