import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apprendre,
  coefficientDe,
  rapportEntreChampionnats,
  saisonsRecentes,
  type ForcesChampionnats,
} from '../src/lib/forces-championnats';
import { calculerScoreProbable } from '../src/lib/score-probable';

/**
 * ★ ACQUIS — LES CHAMPIONNATS SONT RAMENÉS SUR UNE ÉCHELLE COMMUNE.
 *
 * ── LE DÉFAUT RÉPARÉ ──────────────────────────────────────────────────────
 *
 * Le moteur note chaque équipe À L'INTÉRIEUR de son championnat. Confronter
 * la note d'un club belge à celle d'un club kazakh revient à comparer deux
 * notes sur vingt données par deux professeurs différents.
 *
 * Constaté en production le 24 août 2026 : 57 % de réussite entre équipes du
 * même championnat, 43 % entre championnats différents.
 *
 * ── LA MESURE QUI A JUSTIFIÉ LE CORRECTIF ─────────────────────────────────
 *
 * 22 443 rencontres réelles des saisons 2024 et 2025, rejouées dans l'ordre
 * du calendrier — chaque match prédit avec le seul passé, jamais avec son
 * propre résultat. Sur les 10 157 matchs postérieurs à la coupure :
 *
 *     Championnats différents  42,5 %  →  50,1 %   (+7,6 points)
 *     Coupes européennes       48,6 %  →  55,9 %   (+7,3 points)
 *     Même championnat         49,5 %  →  49,7 %   (inchangé)
 *
 * Vérifié sur les deux moitiés du jeu de test prises séparément : +10,7 et
 * +4,4 points. Le gain ne tient pas au découpage.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * 1. Un championnat inconnu ne coûte ni ne rapporte rien.
 * 2. Deux équipes du même championnat ne sont JAMAIS ajustées.
 * 3. L'amortissement reste appliqué — sans lui, une hiérarchie apprise sur
 *    trop peu de confrontations serait crue sur parole.
 * 4. La hiérarchie apprise ressemble à celle que tout le monde connaît.
 * 5. Trois saisons sont demandées : deux ne suffisent pas en début d'exercice.
 */

/** Une hiérarchie fabriquée, pour que les épreuves ne dépendent d'aucun réseau. */
const FORCES: ForcesChampionnats = {
  coefficients: { '39': 1.45, '140': 1.44, '116': 0.77, '61': 1.19 },
  calculeLe: '2026-08-24T00:00:00.000Z',
  matchsUtilises: 17938,
  confrontations: 2030,
};

test('★ ACQUIS — un championnat inconnu ne change rien', () => {
  assert.equal(coefficientDe(FORCES, 9999), 1, 'Un championnat absent doit valoir 1.');
  assert.equal(coefficientDe(FORCES, null), 1);
  assert.equal(coefficientDe(null, 39), 1, 'Sans hiérarchie calculée, le moteur doit se comporter comme avant.');

  assert.equal(
    rapportEntreChampionnats(FORCES, 39, 9999),
    1,
    'Un adversaire de championnat inconnu ne doit ni avantager ni pénaliser : ' +
      'inventer un rapport reviendrait à parier sur une ignorance.'
  );
  assert.equal(rapportEntreChampionnats(null, 39, 116), 1);
});

test('★ ACQUIS — deux equipes du meme championnat ne sont jamais ajustees', () => {
  for (const l of [39, 140, 116, 61]) {
    assert.equal(
      rapportEntreChampionnats(FORCES, l, l),
      1,
      `Le rapport vaut ${rapportEntreChampionnats(FORCES, l, l)} pour deux clubs du championnat ${l}. ` +
        'À l’intérieur d’un même vivier, les notes sont déjà comparables : les ' +
        'ajuster ajouterait du bruit à un calcul juste. Mesuré : les matchs ' +
        'internes ne bougent pas d’un dixième de point.'
    );
  }
});

test('★ ACQUIS — le rapport suit la hierarchie, dans les deux sens', () => {
  const fort = rapportEntreChampionnats(FORCES, 39, 116);
  const faible = rapportEntreChampionnats(FORCES, 116, 39);

  assert.ok(fort > 1.3, `Angleterre contre Bielorussie donne ${fort} : le fort doit etre nettement avantage.`);
  assert.ok(faible < 0.8, `Bielorussie contre Angleterre donne ${faible} : le faible doit etre desavantage.`);
  assert.ok(
    Math.abs(fort * faible - 1) < 0.001,
    'Le rapport doit etre exactement inverse quand on echange les deux equipes, ' +
      'sinon l’ordre de saisie changerait le pronostic.'
  );

  const voisins = rapportEntreChampionnats(FORCES, 39, 140);
  assert.ok(
    voisins > 0.98 && voisins < 1.02,
    `Angleterre contre Espagne donne ${voisins} : deux championnats de meme niveau ` +
      'ne doivent presque rien se devoir.'
  );
});

test('★ ACQUIS — l’amortissement est bien applique', () => {
  // Le coefficient brut vaut 1,45 ; élevé à la puissance 0,7 il tombe vers 1,30.
  // Sans amortissement, une hiérarchie apprise sur trop peu de confrontations
  // serait crue sur parole — or elle ne se reproduit qu’à 0,62 de corrélation
  // d’une période à l’autre.
  const utilise = coefficientDe(FORCES, 39);
  assert.ok(
    utilise < 1.45 && utilise > 1.25,
    `Coefficient utilise ${utilise} pour un brut de 1,45. En dehors de cette plage, ` +
      'l’amortissement a saute ou a ete pousse trop loin.'
  );
});

test('★ ACQUIS — le moteur applique le rapport aux buts attendus', () => {
  const equipe = (marques: number, encaisses: number) => ({
    butsMarques: Math.round(marques * 30),
    butsEncaisses: Math.round(encaisses * 30),
    matchsJoues: 30,
  });

  const neutre = calculerScoreProbable(
    equipe(1.5, 1.2), equipe(1.4, 1.3), true, false, undefined, null, null, true, 1
  );
  const avantage = calculerScoreProbable(
    equipe(1.5, 1.2), equipe(1.4, 1.3), true, false, undefined, null, null, true, 1.5
  );

  assert.ok(
    avantage.butsAttendus1 > neutre.butsAttendus1,
    'Un rapport favorable doit relever les buts attendus de la premiere equipe.'
  );
  assert.ok(
    avantage.butsAttendus2 < neutre.butsAttendus2,
    'Et abaisser ceux de la seconde : ce qui avantage l’une desavantage l’autre.'
  );
  assert.ok(
    avantage.probaVictoire1 > neutre.probaVictoire1,
    'La probabilite de victoire doit suivre les buts attendus.'
  );
});

test('★ ACQUIS — sans rapport, le moteur rend exactement ce qu’il rendait avant', () => {
  const equipe = { butsMarques: 45, butsEncaisses: 36, matchsJoues: 30 };
  const autre = { butsMarques: 42, butsEncaisses: 39, matchsJoues: 30 };

  const sans = calculerScoreProbable(equipe, autre, true);
  const avecUn = calculerScoreProbable(equipe, autre, true, false, undefined, null, null, false, 1);

  assert.deepEqual(
    [sans.buts1, sans.buts2, sans.probaVictoire1, sans.probaNul, sans.probaVictoire2, sans.confiance],
    [avecUn.buts1, avecUn.buts2, avecUn.probaVictoire1, avecUn.probaNul, avecUn.probaVictoire2, avecUn.confiance],
    'Un rapport de 1 doit etre rigoureusement neutre. Sans quoi, tout match ' +
      'interne — la grande majorite — serait modifie par un correctif qui ne le ' +
      'concerne pas.'
  );
});

test('★ ACQUIS — trois saisons sont demandees, pas deux', () => {
  // En aout 2026, la saison 2026 vient de commencer : « la courante et la
  // precedente » ne reunissait plus que 1 046 confrontations au lieu de 2 030,
  // et la hierarchie devenait fausse — la Pologne ressortait au-dessus de la
  // France et de l’Allemagne.
  const enAout = saisonsRecentes(new Date('2026-08-24T00:00:00Z'));
  assert.equal(enAout.length, 3, 'Il faut trois saisons pour garder deux exercices complets toute l’annee.');
  assert.deepEqual(enAout, [2024, 2025, 2026]);

  // Avant juillet, on est encore dans la saison de l’annee precedente.
  const enFevrier = saisonsRecentes(new Date('2026-02-10T00:00:00Z'));
  assert.deepEqual(enFevrier, [2023, 2024, 2025]);
});

test('★ ACQUIS — la hierarchie apprise ressemble a la realite du football', () => {
  // Deux championnats fabriqués : l'un où les équipes marquent beaucoup contre
  // l'étranger, l'autre où elles encaissent. La coupe les met face à face.
  const rencontres: Parameters<typeof apprendre>[0] = [];
  let jour = 0;
  const date = () => new Date(2025, 0, 1 + jour++).toISOString();

  // De quoi établir les forces internes de chacun, dans son championnat.
  for (let i = 0; i < 60; i++) {
    rencontres.push({ date: date(), ligue: 100, dom: 1, ext: 2, butsDom: 2, butsExt: 1 });
    rencontres.push({ date: date(), ligue: 200, dom: 3, ext: 4, butsDom: 2, butsExt: 1 });
  }
  // Puis la coupe : le championnat 100 écrase systématiquement le 200.
  for (let i = 0; i < 40; i++) {
    rencontres.push({ date: date(), ligue: 2, dom: 1, ext: 3, butsDom: 4, butsExt: 0 });
  }

  const forces = apprendre(rencontres);

  assert.ok(
    forces.coefficients['100'] > forces.coefficients['200'],
    `Championnat 100 : ${forces.coefficients['100']}, championnat 200 : ${forces.coefficients['200']}. ` +
      'Celui qui gagne 4-0 quarante fois de suite doit ressortir devant.'
  );
  assert.equal(forces.confrontations, 40, 'Seuls les matchs entre championnats doivent nourrir la hierarchie.');
});
