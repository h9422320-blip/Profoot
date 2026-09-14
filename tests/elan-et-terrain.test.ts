/**
 * ★ ACQUIS — LA PREMIÈRE COUCHE QUI AIT PASSÉ LA PORTE DU BANC D'ESSAI.
 *
 * ── CE QUE LA MESURE DIT ─────────────────────────────────────────────────
 *
 * Rejouée sur 17 985 rencontres, chacune avec seulement ce qui était connu la
 * veille : +16 vainqueurs justes sur la première moitié, +35 sur la seconde —
 * cinquante et un de plus — et un Brier MEILLEUR que le moteur actuel
 * (0,6183 contre 0,6184 ; 0,6003 contre 0,6003).
 *
 * La porte du challenger exige strictement plus de vainqueurs justes dans LES
 * DEUX moitiés, un Brier qui ne se dégrade pas, et une précision sur les
 * matchs sûrs qui ne recule pas de plus d'un point. Les trois sont tenues
 * sans qu'on ait touché à la porte.
 *
 * ── CE QUI EST GARANTI ICI ───────────────────────────────────────────────
 *
 * 1. Un club sans dix rencontres n'a pas d'élan : on n'invente rien.
 * 2. Un championnat peu fourni garde l'avantage moyen.
 * 3. Un relevé absent ou périmé rend `null` : le calcul redevient exactement
 *    celui d'avant. C'est la seule façon d'ajouter une couche sans risque.
 * 4. La lecture ne passe pas QUE par la réserve, qui renonce en une seconde et
 *    demie — le piège qui avait déjà rendu inopérants l'ancrage de la mémoire
 *    et le relevé de fiabilité.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COURT,
  LONG,
  MIN_RENCONTRES_LIGUE,
  PART_ELAN,
  PART_TERRAIN,
  calculerElanEtTerrain,
  correctionElanTerrain,
  type ElanEtTerrain,
} from '../src/lib/elan-et-terrain';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Fabrique n rencontres d'un club, avec les occasions voulues. */
const serie = (club: string, produits: number[], ligue = 39) =>
  produits.map((p, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}T18:00:00Z`,
    ligue,
    nomDom: club,
    nomExt: `Adversaire ${i}`,
    bd: 1,
    be: 1,
    produitDom: p,
    produitExt: 10,
  }));

test('★ ACQUIS — l’élan compare les cinq dernières rencontres aux dix dernières', () => {
  assert.equal(COURT, 5);
  assert.equal(LONG, 10);

  // Dix rencontres : cinq à 10 d'occasions, puis cinq à 20. L'élan doit valoir
  // la différence entre la moyenne des 5 dernières (20) et celle des 10 (15).
  const r = calculerElanEtTerrain(serie('Club qui monte', [10, 10, 10, 10, 10, 20, 20, 20, 20, 20]));
  assert.ok(r.elan['Club qui monte'], 'Le club doit avoir un élan.');
  assert.equal(Math.round(r.elan['Club qui monte'].attaque * 100) / 100, 5);
});

test('★ ACQUIS — sans dix rencontres, aucun élan n’est inventé', () => {
  const r = calculerElanEtTerrain(serie('Club neuf', [10, 12, 14, 16, 18, 20, 22, 24, 26]));
  assert.equal(r.elan['Club neuf'], undefined, 'Neuf rencontres ne suffisent pas.');
  assert.equal(r.clubs, 0);
});

test('★ ACQUIS — un championnat peu fourni n’a pas son propre avantage de terrain', () => {
  // Vingt rencontres, très en dessous du minimum.
  const r = calculerElanEtTerrain(serie('X', Array(20).fill(10), 999));
  assert.equal(r.terrain['999'], undefined, `Sous ${MIN_RENCONTRES_LIGUE} rencontres, on garde la moyenne.`);
});

test('★ ACQUIS — un relevé absent ou périmé laisse le calcul EXACTEMENT comme avant', () => {
  assert.equal(correctionElanTerrain(null, 'A', 'B', 39), null);
  assert.equal(correctionElanTerrain(undefined, 'A', 'B', 39), null);

  const vieux: ElanEtTerrain = {
    elan: { A: { attaque: 5, defense: 0 } },
    terrain: { '39': 0.5 },
    // Onze jours : au-delà de dix, les formes du mois dernier ne disent plus rien.
    calculeLe: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
    clubs: 1,
    championnats: 1,
  };
  assert.equal(correctionElanTerrain(vieux, 'A', 'B', 39), null, 'Un relevé périmé ne doit plus agir.');

  const frais: ElanEtTerrain = { ...vieux, calculeLe: new Date().toISOString() };
  const c = correctionElanTerrain(frais, 'A', 'B', 39);
  assert.ok(c, 'Un relevé frais doit agir.');
  // (part × élan attaque) / 2 + (part × terrain) / 2 = (0,2×5)/2 + (0,2×0,5)/2
  assert.equal(Math.round(c!.domicile * 1000) / 1000, 0.55);
  assert.equal(Math.round(c!.exterieur * 1000) / 1000, -0.05);
});

test('★ ACQUIS — deux clubs inconnus du relevé ne déplacent presque rien', () => {
  const r: ElanEtTerrain = {
    elan: {},
    terrain: { '39': 0 },
    calculeLe: new Date().toISOString(),
    clubs: 0,
    championnats: 1,
  };
  assert.equal(correctionElanTerrain(r, 'Inconnu 1', 'Inconnu 2', 39), null);
});

test('★ ACQUIS — les parts sont celles jugées gagnantes sur le banc, pas d’autres', () => {
  // Le banc a essayé 0,15, 0,20, 0,25 et 0,30 pour l'élan. Seul le MÉLANGE à
  // 0,20 + 0,20 a passé la porte ; les élans seuls ont tous été refusés sur le
  // Brier. Changer ces valeurs sans repasser le banc casse la preuve.
  assert.equal(PART_ELAN, 0.2);
  assert.equal(PART_TERRAIN, 0.2);
});

test('★ ACQUIS — la lecture ne se fie pas à la seule réserve, qui renonce en 1,5 s', () => {
  const source = sansCommentaires(fs.readFileSync('src/lib/elan-et-terrain.ts', 'utf8'));
  assert.match(source, /lireReserve/, 'Le chemin rapide doit rester en premier.');
  assert.match(
    source,
    /from\('cache_api'\)/,
    'Une relecture directe doit exister : sans elle la couche ne se serait JAMAIS appliquée en ligne.'
  );
  assert.match(source, /LIMITE_RELECTURE_MS/);
});

test('★ ACQUIS — rien ne passe au moteur tant que le banc ne le confirme pas', () => {
  // Retirée le 14 septembre 2026, quelques heures après sa mise en ligne.
  //
  // Le mélange élan + terrain avait bien passé la porte sur 17 985 rencontres.
  // Mais c'est la VARIANTE DU BANC qui avait gagné, pas cette implémentation.
  // Rejouée à l'identique, celle-ci PERD contre elle : −11 vainqueurs justes
  // sur la première moitié, −63 sur la seconde, sur 15 625 rencontres. Et ce
  // n'est pas le repli sur les buts — la version sans repli perd tout autant.
  //
  // Une couche qu'on ne sait pas reproduire sur le banc n'est pas prouvée.
  const route = sansCommentaires(fs.readFileSync('src/app/api/analyze/route.ts', 'utf8'));
  assert.doesNotMatch(
    route,
    /correctionElanTerrain\(/,
    "Tant que l'écart avec le banc n'est pas compris, la correction ne doit pas atteindre le moteur."
  );

  const donnees = sansCommentaires(fs.readFileSync('scripts/challenger/donnees.mts', 'utf8'));
  assert.match(donnees, /rangerElanEtTerrain/, 'Le challenger doit ranger le relevé chaque nuit.');
  // Et jamais sur une collecte refusée : une coupure réseau ne doit pas ranger
  // un relevé bâti sur du vide.
  assert.match(donnees, /if \(!pourLaMemoire\.length\)/);
});
