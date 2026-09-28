/**
 * ★ ACQUIS — UN RELEVÉ DU BANC NE S'EFFACE PAS TOUT SEUL.
 *
 * ── LE 28 SEPTEMBRE 2026 ──────────────────────────────────────────────────
 *
 * La collecte de nuit a rendu ZÉRO rencontre — la treizième coupure depuis le
 * 16 septembre. Le fichier des rencontres était protégé par une règle simple :
 * on n'écrase que si la nouvelle collecte est au moins aussi fournie que
 * l'ancienne. Il a été conservé.
 *
 * Le relevé des TIRS ne l'était pas. Il a été réécrit avec un tableau vide,
 * effaçant 7 317 rencontres. Le banc a rejoué la nuit entière sur un moteur
 * AVEUGLE AUX TIRS, alors que la production leur accorde 60 % du calcul.
 *
 * Ce que ça coûtait, mesuré le jour même sur les mêmes 1 250 matchs :
 *
 *     moteur réel, tirs compris ....... 653 vainqueurs justes
 *     moteur du banc, sans les tirs .... 637
 *
 * Et les 34 couches essayées cette nuit-là ont été jugées contre ce champion
 * amputé. La couche Elo en ressortait « ✅ gagne » ; remesurée avec les tirs,
 * elle fait PERDRE 15 vainqueurs justes sur les 988 matchs où le moteur voit
 * les deux clubs. Sans ce contrôle, elle passait en ligne.
 *
 * Un relevé effacé ne se voit pas : le banc tourne, le rapport s'écrit, les
 * chiffres semblent normaux. C'est pour cela que la règle vaut désormais pour
 * TOUS les relevés.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('★ ACQUIS — la règle existe, et elle compte les tableaux comme les objets', () => {
  const src = fs.readFileSync('scripts/challenger/commun.mts', 'utf8');
  assert.match(src, /export function ecrireReleve\(/);
  // Les cotes sont un objet indexé par rencontre : les compter comme un
  // tableau rendrait « 0 » et désarmerait le garde-fou là où on croit l'avoir posé.
  assert.match(src, /Array\.isArray\(v\) \? v\.length : v && typeof v === 'object' \? Object\.keys\(v as object\)\.length : 0/);
  assert.match(src, /if \(ancien > 0 && combien < ancien \* 0\.9\)/, 'Le seuil du dixième a sauté.');
  assert.match(src, /ÉCRITURE REFUSÉE/, 'Un refus doit laisser une trace : une panne muette est une panne qui dure.');
});

test('★ ACQUIS — les trois relevés du collecteur sont protégés', () => {
  const src = fs.readFileSync('scripts/challenger/donnees.mts', 'utf8');
  // Les rencontres ont leur propre formulation, antérieure.
  assert.match(src, /COLLECTE REFUSÉE/, 'Le relevé des rencontres n’est plus protégé.');
  assert.match(src, /ecrireReleve\(FICHIER_TIRS, tirs, 'Relevé des tirs'\)/);
  assert.match(src, /ecrireReleve\(FICHIER_COTES, cotes, 'Relevé des cotes'\)/);
  // Plus aucune écriture nue de ces deux relevés.
  assert.doesNotMatch(src, /writeFileSync\(FICHIER_TIRS/);
  assert.doesNotMatch(src, /writeFileSync\(FICHIER_COTES/);
});

test('★ ACQUIS — le banc peut essayer une couche SANS retirer ce que la production pose déjà', () => {
  // `avecElo` remplace l'avis de la production par celui d'Elo : son gain
  // mélange ce qu'Elo apporte et ce que retirer la mémoire coûte. La variante
  // « complément » est celle qu'on peut réellement mettre en ligne.
  const src = fs.readFileSync('scripts/challenger/evaluer.mts', 'utf8');
  assert.match(src, /type: 'elo-complement'/);
  assert.match(src, /const avis = dejaLa \?\? \{ dom: \(1 - NUL_ELO\) \* we/, 'Le complément écrase de nouveau l’avis de la production.');
});
