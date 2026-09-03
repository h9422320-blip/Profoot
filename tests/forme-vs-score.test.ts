/**
 * ★ ACQUIS — L'ÉCRAN NE SE CONTREDIT PAS SUR LA FORME.
 *
 * ── CE QU'UN CLIENT LISAIT LE 3 SEPTEMBRE 2026 ────────────────────────────
 *
 * Sur quinze analyses réellement servies, deux affichaient une équipe « EN
 * GRANDE FORME » et la donnaient perdante, sans un mot d'explication :
 *
 *     Real Madrid 2-1 Real Betis    le Betis : 5 victoires sur 5
 *     Ipswich 1-2 Liverpool FC      Ipswich  : 4 victoires sur 5
 *
 * ── LES DEUX CHIFFRES SONT JUSTES ─────────────────────────────────────────
 *
 * Ils ne mesurent simplement pas la même chose. `dynamique()` compte les
 * victoires des cinq derniers matchs, TOUTES COMPÉTITIONS, sans jamais
 * regarder contre qui. Le score vient des buts attendus, eux ajustés à la
 * qualité de l'adversaire.
 *
 * Une équipe qui gagne cinq fois contre des adversaires modestes affiche donc
 * « grande forme » et reste en dessous au calcul. Ce n'est pas une erreur du
 * moteur — c'est une erreur d'AFFICHAGE, parce que rien ne l'explique.
 *
 * ── POURQUOI CE TEST EXISTE ───────────────────────────────────────────────
 *
 * Un client qui lit « 5 victoires » au-dessus d'une défaite annoncée conclut
 * que l'application se contredit. Il a raison tant que personne ne lui dit
 * pourquoi. Le propriétaire l'a signalé quatre fois avant que ce soit mesuré.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ecran = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(dashboard)/analyze/AnalyzeClient.tsx'),
  'utf8'
);

test('★ ACQUIS — une forme qui contredit le score est expliquée', () => {
  assert.match(
    ecran,
    /enchaîne les victoires/,
    'Le rapprochement entre la série de victoires et le score annoncé a disparu : ' +
      'l’écran peut de nouveau afficher « 5 victoires » au-dessus d’une défaite ' +
      'sans un mot.'
  );
  assert.match(
    ecran,
    /tient compte du niveau des adversaires rencontrés/,
    'La raison de la divergence n’est plus donnée. Sans elle, le rapprochement ' +
      'ne fait que souligner la contradiction.'
  );
});

test('★ ACQUIS — l’explication porte les chiffres, pas seulement des mots', () => {
  // « Le niveau des adversaires » sans chiffre est une affirmation. Avec les
  // buts attendus des deux équipes, c'est une justification vérifiable.
  assert.match(
    ecran,
    /les buts attendus ressortent à/,
    'L’explication ne cite plus les buts attendus : elle redevient invérifiable.'
  );
  assert.match(ecran, /lese\.sien\.toFixed\(2\)/);
  assert.match(ecran, /lese\.autre\.toFixed\(2\)/);
});

test('★ ACQUIS — le message ne s’affiche QUE sur une vraie divergence', () => {
  // Affiché partout, il deviendrait un avertissement de fond d'écran que
  // personne ne lit — et il inquiéterait sur des analyses parfaitement
  // cohérentes.
  assert.match(
    ecran,
    /buts1 < buts2 && enForme\(d1\) && !enForme\(d2\)/,
    'La condition de divergence a changé : vérifier qu’elle ne se déclenche pas ' +
      'quand les deux équipes sont dans le même état de forme.'
  );
  assert.match(ecran, /if \(!lese\) return null;/);
});
