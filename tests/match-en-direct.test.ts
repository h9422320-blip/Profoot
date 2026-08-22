import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { predireIssueFinale } from '../src/lib/score-probable';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * UN PRONOSTIC QUI CHANGE N'EST PLUS UN PRONOSTIC.
 *
 * Le 22 août 2026, Espanyol — Real Madrid. Avant le coup d'envoi, le pronostic
 * figé annonçait 1-2 pour le Real. À la 74ᵉ minute, sur un score de 1-1, une
 * nouvelle analyse affichait « 1-1 » : le calcul du direct avait pris toute la
 * place. Deux personnes regardant le même match recevaient deux pronostics
 * contraires selon l'heure à laquelle elles avaient cliqué.
 *
 * La cause tenait en un seul mot : `figeable` servait à la fois à LIRE et à
 * ÉCRIRE le pronostic, et excluait les matchs en direct. Le pronostic était
 * donc bien en base, mais jamais relu une fois le match commencé.
 */
test('★ ACQUIS — le pronostic d avant-match est relu même en plein match', () => {
  const src = lire('src/app/api/analyze/route.ts');

  assert.ok(
    /const lisible = !!idRencontre;/.test(src),
    "La lecture du pronostic figé est redevenue conditionnée au fait que le match " +
      "n'a pas commencé. Une analyse en direct réafficherait un pronostic recalculé, " +
      "et deux abonnés du même match verraient deux réponses contraires."
  );

  assert.ok(
    /matchDirect\?\.fixtureId/.test(src),
    "L'identifiant de la rencontre en direct n'est plus utilisé pour retrouver le " +
      "pronostic : en plein match il n'existe pas de « prochain match », et la " +
      "lecture échouerait silencieusement."
  );

  // L'écriture, elle, doit rester interdite pendant le match.
  assert.ok(
    /const enregistrable = [^;]*!matchDirect;/.test(src),
    "L'enregistrement d'un pronostic n'est plus interdit pendant le match. Un " +
      "« pronostic » calculé après le coup d'envoi connaît déjà des buts : il " +
      "fausserait le mur de preuves, qui juge l'application sur ses annonces."
  );
});

test('★ ACQUIS — le bloc du direct n écrase plus le pronostic affiché', () => {
  const src = lire('src/app/api/analyze/route.ts');
  // L'ancre est `donnees.live = matchDirect;`, propre au bloc du direct situé
  // DANS `imposerChiffresCalcules`. Un simple `if (matchDirect) {` apparaît
  // aussi plus haut dans le fichier, et la découpe engloberait alors les
  // écritures normales d'avant-match — le test échouerait sans rien signaler
  // de vrai.
  const bloc = src.slice(
    src.indexOf('donnees.live = matchDirect;'),
    src.indexOf('verifierCoherence(donnees')
  );

  assert.ok(
    !/donnees\.predictedScore\s*=/.test(bloc),
    "Le bloc du direct réécrit `predictedScore`. Le pronostic redeviendrait mouvant : " +
      "1-2 avant le match, 1-1 à la 74ᵉ."
  );

  assert.ok(
    !/donnees\.winProb\s*=/.test(bloc) && !/donnees\.quickSummary\s*=/.test(bloc),
    "Les probabilités ou le résumé sont de nouveau remplacés par ceux de la " +
      "projection : ils décriraient une autre issue que le score affiché juste " +
      "au-dessus."
  );
});

/**
 * LA PRÉVISION DU DIRECT SE CALCULE, ELLE NE SE RECOPIE PAS.
 *
 * On ne peut pas exiger qu'elle diffère du score en cours : à la 88ᵉ minute
 * d'un 1-1, le nul vaut 94 % et annoncer autre chose serait mentir. Ce qui se
 * vérifie, c'est la COHÉRENCE — l'issue la plus probable et le score annoncé
 * doivent raconter la même chose — et le fait que la prévision BOUGE quand le
 * temps restant change.
 */
test('★ ACQUIS — la prévision en direct suit le temps restant, elle ne copie pas', () => {
  // Même score, deux moments : à la mi-temps le Real reste favori, en fin de
  // match le nul l'emporte. Une recopie donnerait 1-1 dans les deux cas.
  const pause = predireIssueFinale(1.05, 1.95, 1, 1, 45, 'Espanyol', 'Real Madrid');
  const fin = predireIssueFinale(1.05, 1.95, 1, 1, 80, 'Espanyol', 'Real Madrid');

  assert.notDeepEqual(
    [pause.scoreFinal1, pause.scoreFinal2],
    [1, 1],
    "À la mi-temps sur 1-1, avec un favori net et 45 minutes à jouer, la prévision " +
      "rend le score en cours : c'est une recopie, pas un calcul."
  );

  assert.ok(
    pause.probaVictoire2 > pause.probaNul,
    'À la mi-temps, le favori doit rester devant le nul.'
  );

  assert.ok(
    fin.probaNul > pause.probaNul,
    'Le nul doit devenir plus probable à mesure que le temps restant diminue.'
  );
});

test('★ ACQUIS — le score annoncé ne contredit jamais les probabilités', () => {
  const cas: [number, number, number, number, number][] = [
    [1.05, 1.95, 1, 1, 45],
    [1.05, 1.95, 1, 1, 74],
    [1.05, 1.95, 0, 1, 60],
    [1.8, 1.2, 2, 0, 30],
    [1.4, 1.4, 0, 0, 10],
    [2.2, 0.9, 1, 2, 55],
  ];

  for (const [x1, x2, b1, b2, minute] of cas) {
    const p = predireIssueFinale(x1, x2, b1, b2, minute, 'A', 'B');
    const maxi = Math.max(p.probaVictoire1, p.probaNul, p.probaVictoire2);

    const issueDuScore =
      p.scoreFinal1 > p.scoreFinal2 ? 'v1' : p.scoreFinal1 === p.scoreFinal2 ? 'nul' : 'v2';
    const issueDesProbas =
      p.probaNul === maxi ? 'nul' : p.probaVictoire1 === maxi ? 'v1' : 'v2';

    assert.equal(
      issueDuScore,
      issueDesProbas,
      `À la ${minute}ᵉ sur ${b1}-${b2} : le score annoncé (${p.scoreFinal1}-${p.scoreFinal2}) ` +
        `dit « ${issueDuScore} » alors que les pourcentages disent « ${issueDesProbas} ». ` +
        "Deux affirmations contraires sur le même écran : l'utilisateur cesse de croire les deux."
    );

    assert.equal(
      p.probaVictoire1 + p.probaNul + p.probaVictoire2,
      100,
      'Les trois pourcentages affichés doivent totaliser exactement 100.'
    );
  }
});

test('★ ACQUIS — un compte gratuit ne reçoit jamais le pronostic figé', () => {
  const src = lire('src/lib/analysis-teaser.ts');
  const liste = src.slice(src.indexOf('const TEASER_FIELDS'), src.indexOf('];', src.indexOf('const TEASER_FIELDS')));

  for (const champ of ['pronosticFige', 'finalPrediction', 'predictedScore', 'winProb']) {
    assert.ok(
      !new RegExp(`'${champ}'`).test(liste),
      `« ${champ} » est entré dans la liste des champs offerts. C'est une prédiction : ` +
        "un visiteur non abonné la recevrait dans son navigateur, et l'abonnement " +
        "perdrait sa raison d'être."
    );
  }
});
