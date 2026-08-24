import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreProbable } from '../src/lib/score-probable';

/**
 * ★ ACQUIS — LA CONFIANCE NE MENT PLUS SUR LES MATCHS ENTRE CHAMPIONNATS.
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 24 AOÛT 2026 ─────────────────────────────────
 *
 * Sur 353 rencontres vérifiées, le moteur réussissait 57 % de ses pronostics
 * entre équipes d'un même championnat, et 43 % entre championnats différents.
 * La confiance affichée, elle, restait la même : 81 % contre 76 %.
 *
 * Pire, sur les matchs croisés elle était RETOURNÉE — 70 % de réussite quand
 * elle annonçait 70-74 %, mais 24 % quand elle annonçait 85-89 %. Une grosse
 * confiance sur un match croisé signalait un artefact de calcul, pas une
 * certitude : les forces sont mesurées à l'intérieur de chaque championnat, et
 * l'écart apparaît d'autant plus grand qu'il est illusoire.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * 1. Le plafond s'applique bien quand les deux équipes viennent d'ailleurs.
 * 2. Il ne s'applique PAS quand elles jouent dans le même championnat.
 * 3. Le pronostic lui-même reste rigoureusement identique — c'est la promesse
 *    qui baisse, pas l'analyse. Trois correctifs du pronostic ont été mesurés
 *    et rejetés ; les réintroduire sans mesure casserait cette épreuve.
 * 4. Le plancher de 70 tient : une analyse de coupe reste une vraie analyse.
 */

const PLAFOND_CROISE = 72;
const PLANCHER = 70;

/**
 * Deux équipes très déséquilibrées : de quoi produire une forte confiance.
 *
 * Les statistiques attendues sont des TOTAUX DE SAISON, pas des moyennes par
 * match. Passer 2,6 au lieu de 78 écrase les buts attendus sur leur plancher
 * de 0,25 et rend toutes les affiches identiques : l'épreuve passait encore,
 * mais elle ne mesurait plus rien. Corrigé le 24 août 2026, après que la
 * sonde du moteur eut sorti neuf fois le même 0-0.
 */
const MATCHS = 30;
const parSaison = (marques: number, encaisses: number) => ({
  butsMarques: Math.round(marques * MATCHS),
  butsEncaisses: Math.round(encaisses * MATCHS),
  matchsJoues: MATCHS,
});

const ECRASANTE = {
  equipe1: parSaison(2.6, 0.5),
  equipe2: parSaison(0.7, 2.2),
};

test('★ ACQUIS — championnats différents : la confiance est plafonnée à 72', () => {
  const croise = calculerScoreProbable(
    ECRASANTE.equipe1,
    ECRASANTE.equipe2,
    true,
    false,
    undefined,
    null,
    null,
    true // comparaison croisée
  );

  assert.ok(
    croise.confiance <= PLAFOND_CROISE,
    `Confiance ${croise.confiance} % sur un match entre championnats différents : ` +
      `le plafond de ${PLAFOND_CROISE} % a sauté. Mesuré le 24 août 2026 : le moteur ` +
      `n'y tient que 43 % de ses pronostics, et se trompe d'autant plus qu'il est sûr.`
  );

  assert.ok(
    croise.confiance >= PLANCHER,
    `Confiance ${croise.confiance} % : sous le plancher de ${PLANCHER} %. Un match de ` +
      `coupe est imprévisible, ce n'est pas une mauvaise analyse.`
  );
});

test('★ ACQUIS — même championnat : rien ne change, la confiance peut monter', () => {
  const interne = calculerScoreProbable(
    ECRASANTE.equipe1,
    ECRASANTE.equipe2,
    true,
    false,
    undefined,
    null,
    null,
    false // même championnat
  );

  assert.ok(
    interne.confiance > PLAFOND_CROISE,
    `Confiance ${interne.confiance} % sur un match entre deux équipes du même ` +
      `championnat : le plafond des matchs croisés a débordé sur les rencontres ` +
      `internes. Elles réussissent à 57 %, elles n'ont rien à se reprocher.`
  );
});

test('★ ACQUIS — le pronostic lui-même est intact : seule la promesse baisse', () => {
  const croise = calculerScoreProbable(
    ECRASANTE.equipe1, ECRASANTE.equipe2, true, false, undefined, null, null, true
  );
  const interne = calculerScoreProbable(
    ECRASANTE.equipe1, ECRASANTE.equipe2, true, false, undefined, null, null, false
  );

  // Trois correctifs du pronostic ont été mesurés le 24 août 2026 sur les
  // 116 matchs croisés vérifiés, et tous rejetés : pousser le nul du facteur
  // mesuré perdait 8,6 points sur une moitié de l'échantillon pour en gagner
  // 3,4 sur l'autre ; rapprocher ou aplatir les probabilités n'avait aucun
  // effet, un mélange linéaire ne changeant jamais l'issue la plus probable.
  //
  // Tant qu'aucune mesure ne le justifie, le drapeau ne doit toucher à RIEN
  // d'autre que la confiance.
  assert.equal(croise.buts1, interne.buts1, 'Le score annoncé a changé.');
  assert.equal(croise.buts2, interne.buts2, 'Le score annoncé a changé.');
  assert.equal(croise.probaVictoire1, interne.probaVictoire1, 'Les probabilités ont changé.');
  assert.equal(croise.probaNul, interne.probaNul, 'La probabilité de nul a changé.');
  assert.equal(croise.probaVictoire2, interne.probaVictoire2, 'Les probabilités ont changé.');
});

test('★ ACQUIS — un amical entre deux pays cumule les deux plafonds', () => {
  const amicalCroise = calculerScoreProbable(
    ECRASANTE.equipe1,
    ECRASANTE.equipe2,
    true,
    true, // peu fiable : plafond 80
    undefined,
    null,
    null,
    true // croisé : plafond 72
  );

  assert.ok(
    amicalCroise.confiance <= PLAFOND_CROISE,
    `Confiance ${amicalCroise.confiance} % : c'est le plafond le plus BAS qui doit ` +
      `l'emporter. Un amical entre deux clubs de pays différents cumule les deux ` +
      `raisons de se méfier.`
  );
});

test('★ ACQUIS — sans drapeau, le calcul est celui d’avant', () => {
  const sansDrapeau = calculerScoreProbable(ECRASANTE.equipe1, ECRASANTE.equipe2, true);
  const avecFaux = calculerScoreProbable(
    ECRASANTE.equipe1, ECRASANTE.equipe2, true, false, undefined, null, null, false
  );

  assert.equal(
    sansDrapeau.confiance,
    avecFaux.confiance,
    'Ne pas passer le drapeau doit rendre exactement ce que rendait le moteur avant ' +
      'son existence. Un championnat introuvable ne doit rien coûter à personne.'
  );
});
