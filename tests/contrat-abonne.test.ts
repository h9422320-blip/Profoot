/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LE CONTRAT — CE QU'UN ABONNÉ REÇOIT, ET QUI NE SE NÉGOCIE PLUS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * POURQUOI CE FICHIER REMPLACE UNE MÉTHODE QUI NE MARCHAIT PAS
 *
 * Jusqu'ici, chaque fois qu'un défaut était corrigé, un test était ajouté pour
 * ce défaut-là. Le propriétaire validait, on verrouillait ce point précis — et
 * quelques heures plus tard un point VOISIN cassait, celui auquel personne
 * n'avait pensé.
 *
 *   Le 20 août : le score était toujours 2-1. Verrouillé.
 *   Le 21 août au matin : le gratuit voyait tout. Verrouillé.
 *   Le 21 août à midi : le scénario tombait à un mot — « Beti ».
 *   Le 21 août à 18 h : le résumé tombait à une ligne.
 *
 * À chaque fois un test existait, à chaque fois il regardait ailleurs. Pire :
 * celui écrit à midi AUTORISAIT la régression, parce que son seuil avait été
 * choisi en même temps que la modification qu'il devait surveiller.
 *
 * CE QUI CHANGE ICI
 *
 * Ce fichier ne teste pas des causes connues. Il décrit L'ÉCRAN COMPLET que
 * doit recevoir quelqu'un qui a payé, bloc par bloc, avec pour chacun ce qui
 * fait qu'il est réellement présent — pas juste non vide.
 *
 * Une régression peut venir de n'importe où : un plafond de jetons, un délai,
 * un changement de modèle, une consigne réécrite, un affichage modifié. Peu
 * importe la cause : si UN SEUL bloc du contrat tombe, la compilation est
 * refusée et rien ne part en ligne.
 *
 * COMMENT MODIFIER CE FICHIER
 *
 * Les seuils ci-dessous viennent de ce que le propriétaire a VALIDÉ. Ils ne se
 * baissent pas pour faire passer une modification. Si une modification les
 * casse, c'est la modification qui est fausse.
 *
 * On n'ajoute une exigence que lorsqu'un nouveau défaut a été constaté en
 * production. On n'en retire jamais.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const racine = path.join(import.meta.dirname, '..');
const lire = (p: string) => fs.readFileSync(path.join(racine, p), 'utf8');

/**
 * Les cinq blocs, et ce qui prouve que chacun est vraiment là.
 *
 * Chaque seuil correspond à un défaut RÉELLEMENT servi à un abonné payant.
 */
const CONTRAT = [
  {
    bloc: 'Résumé rapide',
    minimum: 200,
    defautConstate:
      "« Napoli s'appuie sur un pressing haut et une attaque efficace pour arracher la " +
      "victoire 1-0 contre un Genoa fragile en défense. » — une phrase, le 21 août à 18 h",
  },
  {
    bloc: 'Scénario #1',
    minimum: 120,
    defautConstate: '« Beti » — un mot, le 21 août à 16 h',
  },
] as const;

test('CONTRAT — le prompt exige un résumé substantiel', () => {
  const source = lire('src/app/api/analyze/route.ts');
  assert.ok(
    /QUATRE À CINQ PHRASES/.test(source),
    `Le prompt ne demande plus quatre phrases. Défaut déjà servi : ${CONTRAT[0].defautConstate}`
  );
});

test('CONTRAT — un résumé trop court est remplacé avant d\'atteindre l\'abonné', () => {
  const source = lire('src/app/api/analyze/route.ts');
  const seuil = source.match(/const RESUME_MINIMUM = (\d+)/)?.[1];

  assert.ok(seuil, "Le filet du résumé a disparu.");
  assert.ok(
    Number(seuil) >= CONTRAT[0].minimum,
    `Le filet accepte ${seuil} caractères alors que le contrat en exige ${CONTRAT[0].minimum}. ` +
      `Défaut déjà servi : ${CONTRAT[0].defautConstate}`
  );
});

test('CONTRAT — la réponse du modèle ne peut pas être tronquée', async () => {
  const { JETONS_REPONSE } = await import('../src/lib/openrouter');
  assert.ok(
    JETONS_REPONSE >= 6000,
    `JETONS_REPONSE vaut ${JETONS_REPONSE}. Sous 6 000, la réponse est coupée en pleine ` +
      `phrase. Défaut déjà servi : ${CONTRAT[1].defautConstate}`
  );
});

test('CONTRAT — le scénario de secours est complet et nomme les deux clubs', async () => {
  const { scenarioGabarit } = await import('../src/lib/apercu-ia');

  const PROFILS = [
    { recentMatches: ['W','W','W','D','L'], goalsScored: 74, goalsConceded: 42, cleanSheets: 13, avgPossession: 56, played: 38 },
    { recentMatches: ['L','L','D','L','W'], goalsScored: 30, goalsConceded: 70, cleanSheets: 2, avgPossession: 38, played: 38 },
    { recentMatches: ['W'], goalsScored: 2, goalsConceded: 1, cleanSheets: 0, avgPossession: 0, played: 1 },
    {},
  ];

  for (const a of PROFILS)
    for (const b of PROFILS) {
      const t = scenarioGabarit('Napoli', 'Genoa', a as any, b as any);
      assert.ok(
        t.length >= CONTRAT[1].minimum,
        `Scénario de ${t.length} caractères : « ${t} ». Contrat : ${CONTRAT[1].minimum}.`
      );
      assert.ok(
        t.includes('Napoli') && t.includes('Genoa'),
        `Une équipe n'est pas nommée : « ${t.slice(0, 100)} »`
      );
    }
});

test('CONTRAT — le résumé de secours est complet et nomme les deux clubs', async () => {
  const { composerApercu } = await import('../src/lib/apercu-vendeur');

  const A = { recentMatches: ['W','W','W','D','L'], goalsScored: 74, goalsConceded: 42, cleanSheets: 13, avgPossession: 56, played: 38 };
  const B = { recentMatches: ['L','L','D','L','W'], goalsScored: 30, goalsConceded: 70, cleanSheets: 2, avgPossession: 38, played: 38 };

  for (const [x, y] of [[A, B], [B, A], [{}, {}]] as any[]) {
    const t = composerApercu('Napoli', 'Genoa', x, y, { competition: 'Serie A', stade: null });
    assert.ok(
      t.length >= CONTRAT[0].minimum,
      `Résumé de ${t.length} caractères : « ${t} ». Contrat : ${CONTRAT[0].minimum}.`
    );
    assert.ok(t.includes('Napoli') && t.includes('Genoa'), `Une équipe n'est pas nommée : « ${t} »`);
  }
});

test("CONTRAT — l'affichage payant montre les cinq blocs", () => {
  const source = lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx');

  for (const [bloc, motif] of [
    ['Résumé rapide', /Résumé rapide/],
    ['Scénario #1', /Scénario #1/],
    ['Confiance de l\'IA', /Confiance de l/],
    ['Score prédit', /Score prédit/],
  ] as [string, RegExp][])
    assert.ok(motif.test(source), `Le bloc « ${bloc} » a disparu de l'affichage.`);

  // Le découpage doit rester : un compte gratuit ne voit pas le verdict.
  assert.ok(
    /result\.locked \?/.test(source),
    "La séparation gratuit / payant a disparu de l'affichage."
  );
});

test("CONTRAT — un compte gratuit ne reçoit toujours aucun champ du verdict", async () => {
  const { toTeaser } = await import('../src/lib/analysis-teaser');

  const complete = {
    team1: { name: 'Napoli' }, team2: { name: 'Genoa' }, competition: 'Serie A',
    globalForm: {
      team1: { recentMatches: ['W','W','D','L','W'], goalsScored: 74, goalsConceded: 42, cleanSheets: 13, avgPossession: 56, played: 38, name: 'Napoli' },
      team2: { recentMatches: ['D','W','L','L','W'], goalsScored: 44, goalsConceded: 60, cleanSheets: 6, avgPossession: 45, played: 38, name: 'Genoa' },
    },
    quickSummary: 'Napoli gagne 1-0.', predictedScore: '1-0', winner: 'Napoli',
    winProb: 61, drawProb: 24, loseProb: 15, expectedGoals: { team1: 1.8, team2: 0.9 },
    scenarios: ['Lindstrøm ouvre le score à la 30e.'], sections: [1, 2, 3, 4, 5, 6, 7],
  };

  const gratuit = (await toTeaser(complete, 'Napoli', 'Genoa')) as Record<string, unknown>;

  for (const champ of ['predictedScore', 'winner', 'winProb', 'drawProb', 'loseProb', 'expectedGoals', 'scenarios', 'sections', 'quickSummary'])
    assert.ok(!(champ in gratuit), `Le champ « ${champ} » part vers un compte gratuit.`);

  assert.ok(
    String(gratuit.apercuResume ?? '').length >= CONTRAT[0].minimum,
    `L'aperçu gratuit fait ${String(gratuit.apercuResume ?? '').length} caractères.`
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  21 AOÛT, 18 h — UN SEUL MODÈLE LENT BLOQUAIT TOUTE LA CASCADE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Le journal de cascade a montré le même motif, à la milliseconde près, sur
//  quinze échecs consécutifs :
//
//      openai/gpt-oss-120b : délai dépassé (36 001 ms)
//      deepseek-v4-flash   : délai dépassé (14 614 ms)
//
//  Le premier consommait le budget entier sans jamais aboutir ; le suivant
//  héritait des miettes. L'abonné voyait « ANALYSE INTERROMPUE ».

test('CONTRAT — la cascade laisse sa chance à au moins trois modèles', async () => {
  const { MODELES_OPENROUTER } = await import('../src/lib/openrouter');

  assert.ok(
    MODELES_OPENROUTER.length >= 3,
    'Moins de trois modèles : une seule panne suffit à interrompre une analyse.'
  );

  // Le budget réel tourne autour de cinquante secondes. Au-delà de vingt-cinq
  // secondes par tentative, deux modèles épuisent tout et le troisième n'est
  // jamais appelé.
  const source = fs.readFileSync(path.join(racine, 'src/lib/gemini-models.ts'), 'utf8');
  const plafond = source.match(/plafondMs = (\d+)/)?.[1];

  assert.ok(plafond, 'Le plafond par tentative est introuvable.');
  assert.ok(
    Number(plafond) <= 25000,
    `Plafond de ${plafond} ms : avec un budget de cinquante secondes, deux tentatives le ` +
      `consomment entièrement. Mesuré le 21 août — le premier modèle prenait 36 001 ms sans aboutir.`
  );
});

test("CONTRAT — un modèle lent n'occupe pas la première place", async () => {
  const { MODELES_OPENROUTER } = await import('../src/lib/openrouter');

  // gpt-oss-120b : 120 milliards de paramètres, bon marché mais lent. Mesuré à
  // 36 001 ms sans jamais aboutir, quinze fois de suite.
  assert.notEqual(
    MODELES_OPENROUTER[0],
    'openai/gpt-oss-120b',
    "Le modèle mesuré à 36 s sans aboutir est de nouveau en tête : il consommera tout le budget."
  );
});
