/**
 * ★ ACQUIS — LES DEUX CAMPS DU SCORE NE PORTENT PAS LA MÊME ÉTIQUETTE.
 *
 * ── CE QU'UN CLIENT A VU, DEUX FOIS ───────────────────────────────────────
 *
 * Sur la carte de score de Real Betis contre Real Madrid :
 *
 *     [logo Betis]  REA   1 - 3   REA  [logo Real]
 *
 * Il l'a signalé le 2 septembre 2026. C'était encore là en production le
 * 4 septembre, vérifié sur ce match précis.
 *
 * ── LA CAUSE, ET POURQUOI ELLE A TENU SI LONGTEMPS ───────────────────────
 *
 * Le séparateur des mots s'écrivait « [s.'’-] » au lieu de « [\s.'’-] ». Un
 * antislash. La classe découpait donc sur la LETTRE « s » et jamais sur
 * l'espace : « Real Betis » ne faisait plus deux mots mais un seul, « Real
 * Beti », qui ne correspond à aucun mot commun. Tout le tri devenait
 * inopérant et le sigle retombait sur les trois premières lettres du nom
 * entier — REA des deux côtés.
 *
 * Ces fonctions vivaient dans un composant de cinq mille lignes qu'aucun test
 * ne pouvait charger. Rien ne les exécutait. Elles vivent maintenant dans
 * `src/lib/sigles.ts`, et ce fichier les fait tourner pour de vrai.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sigleClub, siglesDuMatch } from '../src/lib/sigles.ts';

test('★ ACQUIS — le nom se découpe sur les ESPACES', () => {
  // Le cas exact du signalement. Si l'antislash disparaît de nouveau, les deux
  // rendent « REA » et cette ligne tombe.
  assert.deepEqual(siglesDuMatch('Real Betis', 'Real Madrid'), ['BET', 'MAD']);
});

test('★ ACQUIS — le mot qui distingue l’emporte sur le premier mot', () => {
  assert.equal(sigleClub('Real Sociedad'), 'SOC');
  assert.equal(sigleClub('Atlético Madrid'), 'MAD');
  assert.equal(sigleClub('Olympique Marseille'), 'MAR');
  assert.equal(sigleClub('Toulouse FC'), 'TOU');
});

test('★ ACQUIS — deux clubs d’une même ville restent distincts', () => {
  const [a, b] = siglesDuMatch('Manchester United', 'Manchester City');
  assert.notEqual(a, b, 'Les deux Manchester portent le même sigle.');
  assert.deepEqual([a, b], ['MUN', 'MCI']);
});

test('★ ACQUIS — sur UNE rencontre, jamais deux sigles identiques', () => {
  // La seule contrainte qui compte : que la carte se lise. On balaie les
  // paires qui se ressemblent le plus, celles où le défaut se voyait.
  const paires: [string, string][] = [
    ['Real Betis', 'Real Madrid'],
    ['Real Madrid', 'Real Sociedad'],
    ['Real Betis', 'Real Sociedad'],
    ['Manchester United', 'Manchester City'],
    ['Bayer Leverkusen', 'Bayern Munich'],
    ['Atlético Madrid', 'Athletic Bilbao'],
    ['Sporting CP', 'Sporting Gijón'],
    ['Deportivo Alavés', 'Deportivo La Coruña'],
    ['AC Milan', 'AS Monaco'],
    ['Inter Milan', 'AC Milan'],
    ['LOSC Lille', 'Lille OSC'],
  ];
  for (const [n1, n2] of paires) {
    const [a, b] = siglesDuMatch(n1, n2);
    assert.notEqual(a, b, `« ${n1} » et « ${n2} » portent tous deux « ${a} ».`);
    assert.ok(a.length >= 2 && b.length >= 2, `Sigle trop court : ${a} / ${b}`);
  }
});

test('★ ACQUIS — un nom absent ou vide ne casse rien', () => {
  // Le nom vient d'une source extérieure : il peut manquer.
  assert.equal(typeof sigleClub(null), 'string');
  assert.equal(typeof sigleClub(undefined), 'string');
  assert.equal(typeof sigleClub(''), 'string');
  const [a, b] = siglesDuMatch(null, 'Real Madrid');
  assert.equal(typeof a, 'string');
  assert.equal(b, 'MAD');
});

test('★ ACQUIS — un nom fait uniquement de mots communs garde un sigle', () => {
  // « Sporting Club » : tout est écarté. Mieux vaut retomber sur ses propres
  // mots que d'afficher « ??? » sous un logo.
  assert.notEqual(sigleClub('Sporting Club'), '???');
  assert.notEqual(sigleClub('Racing Club'), '???');
});
