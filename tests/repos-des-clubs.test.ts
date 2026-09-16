import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  correctionRepos,
  derniereRencontreAvant,
  sommeDesCorrections,
  POIDS_REPOS,
  PLAFOND_JOURS,
} from '../src/lib/repos-des-clubs';

const JOUR = 86_400_000;
const LE_MATCH = Date.parse('2026-09-16T18:00:00Z');
const ilYA = (jours: number) => LE_MATCH - jours * JOUR;

const lire = (p: string) => fs.readFileSync(p, 'utf8');

test('le repos ne dit rien quand les deux clubs sont également reposés', () => {
  // Ce qui compte est la DIFFÉRENCE. Deux équipes qui ont joué le même jour ne
  // doivent rien changer au pronostic : sans cela, la couche déplacerait tous
  // les matchs d'une journée dans le même sens, ce qui n'a aucun sens.
  assert.equal(correctionRepos(LE_MATCH, ilYA(3), ilYA(3)), null);
  assert.equal(correctionRepos(LE_MATCH, ilYA(9), ilYA(9)), null);
});

test('le club le plus reposé est celui qu’on avantage', () => {
  // Celui qui reçoit a eu neuf jours, le visiteur trois : c'est le recevant
  // qu'il faut pousser vers le haut.
  const c = correctionRepos(LE_MATCH, ilYA(9), ilYA(3));
  assert.ok(c, 'la correction devrait exister');
  assert.ok(c!.domicile > 0, `le recevant reposé doit être avantagé (reçu ${c!.domicile}).`);
  assert.ok(c!.exterieur < 0, 'le visiteur fatigué doit être pénalisé.');
  assert.equal(c!.domicile, -c!.exterieur, 'la correction doit être symétrique.');

  // Et dans l'autre sens, exactement l'inverse.
  const inverse = correctionRepos(LE_MATCH, ilYA(3), ilYA(9));
  assert.equal(inverse!.domicile, -c!.domicile);
});

test('★ ACQUIS — la correction du repos reste plafonnée', () => {
  // Au-delà de deux semaines, un jour de plus ne dit plus rien — et une
  // coupure de trêve internationale fausserait tout si rien ne bornait.
  const enorme = correctionRepos(LE_MATCH, ilYA(200), ilYA(0));
  const auPlafond = correctionRepos(LE_MATCH, ilYA(PLAFOND_JOURS), ilYA(0));
  assert.equal(
    enorme!.domicile,
    auPlafond!.domicile,
    'Deux cents jours de repos pèsent plus que quatorze : le plafond a sauté.'
  );
  assert.ok(
    Math.abs(enorme!.domicile) <= POIDS_REPOS + 1e-9,
    `La correction dépasse son poids (${enorme!.domicile} pour un poids de ${POIDS_REPOS}).`
  );
});

test('le repos se tait plutôt que d’inventer', () => {
  assert.equal(correctionRepos(LE_MATCH, null, ilYA(3)), null);
  assert.equal(correctionRepos(LE_MATCH, ilYA(3), null), null);
  assert.equal(correctionRepos(null, ilYA(3), ilYA(9)), null);
  assert.equal(correctionRepos(Number.NaN, ilYA(3), ilYA(9)), null);
});

test('la dernière rencontre ne retient que les matchs terminés, et jamais l’avenir', () => {
  const fixtures = {
    response: [
      { fixture: { date: new Date(ilYA(2)).toISOString(), status: { short: 'NS' } } }, // à venir
      { fixture: { date: new Date(ilYA(5)).toISOString(), status: { short: 'FT' } } },
      { fixture: { date: new Date(ilYA(12)).toISOString(), status: { short: 'FT' } } },
      { fixture: { date: new Date(LE_MATCH + JOUR).toISOString(), status: { short: 'FT' } } }, // après
    ],
  };
  const d = derniereRencontreAvant(fixtures, LE_MATCH);
  assert.equal(
    d,
    Date.parse(new Date(ilYA(5)).toISOString()),
    'La dernière rencontre doit être la plus récente TERMINÉE et antérieure au match.'
  );
  assert.equal(derniereRencontreAvant({ response: [] }, LE_MATCH), null);
  assert.equal(derniereRencontreAvant(null, LE_MATCH), null);
});

test('les corrections s’additionnent, et se taisent ensemble', () => {
  assert.deepEqual(
    sommeDesCorrections({ domicile: 0.1, exterieur: -0.1 }, { domicile: 0.05, exterieur: -0.05 }),
    { domicile: 0.15000000000000002, exterieur: -0.15000000000000002 }
  );
  assert.equal(sommeDesCorrections(null, undefined), null);
  // Une valeur illisible ne doit pas empoisonner la somme.
  assert.deepEqual(
    sommeDesCorrections({ domicile: Number.NaN, exterieur: 1 }, { domicile: 0.2, exterieur: -0.2 }),
    { domicile: 0.2, exterieur: -0.2 }
  );
});

test('★ ACQUIS — les corrections en buts sont rangées dans le sens de CELUI QUI REÇOIT', () => {
  // ── CE QUE CE GARDE-FOU A COÛTÉ AVANT D'EXISTER ─────────────────────────
  //
  // `calculerScoreProbable` attend ce point d'entrée du point de vue du club
  // qui REÇOIT et de celui qui se DÉPLACE : il les remet lui-même dans l'ordre
  // des deux équipes selon `equipe1Recoit`.
  //
  // Or la couche élan + terrain, mise en ligne le 14 septembre 2026, recevait
  // `team1` et `team2` sans regarder qui recevait. L'abonné saisit les équipes
  // dans l'ordre qui lui chante : une fois sur deux il commence par le
  // visiteur, et la correction était alors appliquée À L'ENVERS — le club en
  // forme se voyait retirer ce qu'il fallait lui ajouter.
  //
  // Le relevé des occasions faisait déjà le bon aiguillage depuis toujours.
  const s = lire('src/app/api/analyze/route.ts');

  assert.match(
    s,
    /correctionElanTerrain\(\s*await lireElanEtTerrain\(\),\s*equipe1AJoueADomicile === true \? team1\.name : team2\.name,\s*equipe1AJoueADomicile === true \? team2\.name : team1\.name,/,
    'L’élan et le terrain ne sont plus rangés selon qui reçoit : la correction ' +
      'repartira à l’envers une analyse sur deux.'
  );

  assert.match(
    s,
    /derniereRencontreAvant\(\s*equipe1AJoueADomicile === true \? t1Recent : t2Recent,/,
    'Le repos n’est plus rangé selon qui reçoit.'
  );
  assert.match(
    s,
    /derniereRencontreAvant\(\s*equipe1AJoueADomicile === true \? t2Recent : t1Recent,/,
    'Le repos n’est plus rangé selon qui reçoit.'
  );
});

test('★ ACQUIS — le repos garde les réglages qui ont passé la porte', () => {
  // Mesuré le 16 septembre 2026 sur 16 588 rencontres, banc aligné sur la
  // production en six points : +8 et +5 vainqueurs justes, Brier égal ou
  // meilleur, matchs mis en avant de 70,5 % à 71,8 % et 71,3 %. Seize réglages
  // essayés de 0,03 à 0,12 et de 7 à 16 jours : pas un seul perdant.
  assert.equal(POIDS_REPOS, 0.05, 'Le poids du repos a changé sans nouvelle mesure.');
  assert.equal(PLAFOND_JOURS, 14, 'Le plafond du repos a changé sans nouvelle mesure.');
});
