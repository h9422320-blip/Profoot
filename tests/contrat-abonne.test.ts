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

test("CONTRAT — le taux d'échec est surveillé et remonte tout seul", () => {
  const source = lire('src/lib/entretien-quotidien.ts');

  // Le 21 août, trois pannes distinctes ont été découvertes de la même façon :
  // le propriétaire lançait une analyse et voyait « ANALYSE INTERROMPUE ». Les
  // journaux disaient tout, mais personne n'avait de raison de les regarder.
  //
  // Le cadenas empêche les régressions du code. Il ne peut rien contre une
  // panne extérieure — modèle saturé, règle de routage changée, quota atteint.
  // Le seul remède est de mesurer, et de le dire.
  assert.ok(
    /Surveiller le taux d[’']échec/.test(source),
    "La surveillance du taux d'échec a disparu de l'entretien : une panne extérieure " +
      "redeviendrait invisible jusqu'à ce qu'un client la découvre."
  );

  const seuil = source.match(/const SEUIL = (\d+)/)?.[1];
  assert.ok(seuil, 'Le seuil d’alerte est introuvable.');
  assert.ok(
    Number(seuil) <= 10,
    `Seuil d'alerte à ${seuil} % : une analyse sur dix en échec passerait inaperçue.`
  );

  // L'alerte doit dire POURQUOI, sinon elle oblige à tout reprendre à zéro.
  assert.ok(
    /délai dépassé/.test(source) && /JSON illisible/.test(source),
    "L'alerte ne détaille plus les causes : elle signalerait un problème sans dire lequel."
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  LA REPRISE AUTOMATIQUE — CE QUE LE CLIENT NE DOIT PLUS VOIR
// ═══════════════════════════════════════════════════════════════════════════
//
//  Une analyse en échec affichait « ANALYSE INTERROMPUE » et laissait la
//  personne devant un bouton « Réessayer ». Beaucoup ne cliquent pas : ils
//  concluent que l'application ne marche pas, et s'en vont.

test('CONTRAT — une analyse en échec est reprise automatiquement', () => {
  const source = lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx');

  assert.ok(
    /const RELANCES_MAX = (\d+)/.test(source),
    "La reprise automatique a disparu : un échec redeviendrait visible pour le client."
  );

  const max = Number(source.match(/const RELANCES_MAX = (\d+)/)?.[1]);
  assert.ok(max >= 1, 'Aucune reprise : le client verra de nouveau « ANALYSE INTERROMPUE ».');
  assert.ok(
    max <= 2,
    `${max} reprises : au-delà de deux, l'attente dépasse deux minutes et répète la même erreur.`
  );

  assert.ok(
    /return handleAnalyze\(activeT1, activeT2, tentative \+ 1\)/.test(source),
    "La reprise ne rappelle plus l'analyse : elle ne sert à rien."
  );

  // La reprise doit signaler au serveur qu'elle en est une, sinon celui-ci
  // repart avec le budget long et le même modèle défaillant.
  assert.ok(
    /reprise: tentative > 0/.test(source),
    "La reprise ne se signale plus au serveur : budget long et modèle fautif conservés."
  );
});

test("CONTRAT — une reprise repart plus vite et sur un autre modèle", () => {
  const source = lire('src/app/api/analyze/route.ts');

  assert.ok(
    /const reprise = Math\.min\(3, Math\.max\(0, Number\(reqPayload\.reprise\)/.test(source),
    "Le serveur ne lit plus le signal de reprise, ou ne le borne plus."
  );

  assert.ok(
    /Math\.min\(\s*25000,/.test(source),
    "Le budget raccourci de la reprise a disparu : l'attente repasserait à deux minutes trente."
  );

  assert.ok(
    /decalage: reprise/.test(source),
    "La reprise n'écarte plus le modèle qui vient d'échouer : elle répétera la même erreur."
  );
});

test("CONTRAT — un modèle écarté reste disponible en dernier recours", async () => {
  const source = lire('src/lib/analyse-modele.ts');

  // Les modèles écartés passent EN FIN de liste, jamais à la poubelle : si
  // tous les suivants échouent aussi, mieux vaut retenter le premier que ne
  // rien rendre du tout.
  assert.ok(
    /\[\.\.\.base\.slice\(n\), \.\.\.base\.slice\(0, n\)\]/.test(source),
    "Les modèles écartés sont supprimés au lieu d'être déplacés : la cascade perd des filets."
  );

  const { MODELES_OPENROUTER } = await import('../src/lib/openrouter');
  assert.ok(
    MODELES_OPENROUTER.length >= 3,
    `Seulement ${MODELES_OPENROUTER.length} modèle(s) : une reprise n'aurait presque rien à essayer.`
  );
});

test("CONTRAT — les preuves du jour passent en tête du mur public", () => {
  const source = lire('src/lib/preuves.ts');

  // Un visiteur doit voir en premier ce que l'IA avait annoncé pour les matchs
  // DE CE JOUR — ceux dont il connaît déjà le résultat. C'est la preuve la plus
  // convaincante : « ce match d'hier soir, il l'avait dit ». Une réussite d'il
  // y a trois semaines ne prouve pas que l'outil marche aujourd'hui.
  assert.ok(
    /const estDuJour = /.test(source),
    "Le critère « match du jour » a disparu du tri : les preuves fraîches retomberaient " +
      "derrière des affiches anciennes."
  );

  // Il doit passer AVANT la notoriété : une affiche du jour entre équipes
  // modestes vaut mieux qu'un grand club d'il y a dix jours.
  const posJour = source.indexOf('if (jourA !== jourB)');
  const posNotoriete = source.indexOf('const poidsA = poidsAffiche(a, grandsClubs)');
  assert.ok(posJour > 0 && posNotoriete > 0, 'Le tri du mur a été réécrit.');
  assert.ok(
    posJour < posNotoriete,
    "La notoriété repasse devant la fraîcheur : un match du jour serait relégué derrière " +
      "une vieille affiche de grand club."
  );

  // Et un raté ne doit jamais être publié, quelle que soit sa date.
  assert.ok(
    /valeurs\.publiee = issueCorrecte &&/.test(source),
    "La publication n'est plus conditionnée à la justesse du pronostic."
  );
});

test("CONTRAT — les échecs d'analyse sont visibles dans l'administration", () => {
  const page = lire('src/app/admin/page.tsx');
  const panneau = lire('src/app/admin/_components/EchecsAnalyse.tsx');

  // Le bilan des échecs était calculé depuis longtemps et affiché nulle part.
  // Chaque panne se découvrait de la même façon : le propriétaire lançait une
  // analyse et voyait « ANALYSE INTERROMPUE ». Trois fois le 21 août.
  assert.ok(
    /<EchecsAnalyse \/>/.test(page),
    "Le panneau des échecs a disparu de la page d'administration : les pannes " +
      "redeviendraient invisibles jusqu'à ce qu'un client les découvre."
  );

  // Le chiffre qui compte : les cas où l'abonné n'a RIEN reçu.
  assert.ok(
    /sansReponse/.test(panneau),
    "Le compteur « sans réponse » a disparu — c'est le seul qui signale un client " +
      "qui a payé et n'a rien reçu."
  );

  // Le pays : une panne ne frappe pas partout de la même façon.
  assert.ok(
    /e\.pays/.test(panneau),
    "Le pays n'est plus affiché : dix échecs venant tous du même endroit ne se " +
      "distingueraient plus de dix échecs répartis."
  );
});
