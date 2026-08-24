import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerSuivi, lundiDe } from '../src/lib/suivi-precision';

/**
 * ★ ACQUIS — LE SUIVI DE PRÉCISION COMPTE DES MATCHS, PAS DES ANALYSES.
 *
 * ── LE PIÈGE QUE CES ÉPREUVES FERMENT ─────────────────────────────────────
 *
 * Dix-sept abonnés analysent la même affiche. Au 24 août 2026, 7 626 analyses
 * vérifiées ne recouvraient que 358 rencontres réelles. Compter les analyses
 * ferait passer une seule affiche pour un échantillon de dix-sept, et un
 * match très demandé pèserait dix-sept fois plus qu'un match rare — alors que
 * le moteur n'a fait qu'un seul pronostic dans les deux cas.
 *
 * ── ET LA SEGMENTATION EST LE CŒUR DU PANNEAU ─────────────────────────────
 *
 * Un taux global de 53 % cachait 57 % entre équipes d'un même championnat et
 * 43 % entre championnats différents. C'est cet écart qui a désigné le défaut
 * à corriger ; le perdre reviendrait à redevenir aveugle.
 */

const ligne = (o: Partial<Parameters<typeof calculerSuivi>[0][number]> = {}) => ({
  fixture_id: null,
  team1_name: 'A',
  team2_name: 'B',
  team1_league: 'epl',
  team2_league: 'epl',
  competition: 'Premier League',
  confidence: 80,
  score: '2 - 1',
  real_score: '2 - 1',
  real_winner: 'team1',
  winner_correct: true,
  verified_at: '2026-08-17T12:00:00.000Z',
  ...o,
});

test('★ ACQUIS — dix-sept analyses du meme match comptent pour une', () => {
  const analyses = Array.from({ length: 17 }, () => ligne({ fixture_id: 1234 }));
  const s = calculerSuivi(analyses);

  assert.equal(s.analysesLues, 17, 'Le nombre d’analyses lues doit rester visible.');
  assert.equal(
    s.ensemble.matchs,
    1,
    `${s.ensemble.matchs} matchs comptes pour 17 analyses du meme fixture. Une affiche ` +
      'tres demandee pesait alors dix-sept fois plus qu’une affiche rare, alors que le ' +
      'moteur n’a fait qu’un seul pronostic.'
  );
});

test('★ ACQUIS — sans identifiant de match, le dedoublonnage tient quand meme', () => {
  // Les analyses anciennes n’ont pas toujours d’identifiant : le repli sur le
  // couple d’equipes et la competition doit continuer a les regrouper.
  const s = calculerSuivi([
    ligne({ fixture_id: null, team1_name: 'Lyon', team2_name: 'Nice' }),
    ligne({ fixture_id: null, team1_name: 'Lyon', team2_name: 'Nice' }),
    // Saisi dans l’autre sens : c’est la meme affiche.
    ligne({ fixture_id: null, team1_name: 'Nice', team2_name: 'Lyon' }),
  ]);
  assert.equal(s.ensemble.matchs, 1, 'Le meme match saisi dans les deux sens ne fait qu’un.');
});

test('★ ACQUIS — les deux segments restent separes', () => {
  const analyses = [
    // Huit matchs internes, tous justes.
    ...Array.from({ length: 8 }, (_, i) => ligne({ fixture_id: 100 + i })),
    // Huit matchs croises, tous faux.
    ...Array.from({ length: 8 }, (_, i) =>
      ligne({ fixture_id: 200 + i, team2_league: 'laliga', winner_correct: false, real_score: '0 - 3' })
    ),
  ];
  const s = calculerSuivi(analyses);

  assert.equal(s.memeChampionnat.matchs, 8);
  assert.equal(s.championnatsCroises.matchs, 8);
  assert.equal(s.memeChampionnat.vainqueur, 100, 'Le segment interne doit ressortir a 100 %.');
  assert.equal(s.championnatsCroises.vainqueur, 0, 'Le segment croise doit ressortir a 0 %.');
  assert.equal(s.ensemble.vainqueur, 50, 'La moyenne des deux vaut 50 % — et ne dit rien de l’ecart.');
});

test('★ ACQUIS — sous huit matchs, aucun pourcentage n’est publie', () => {
  const s = calculerSuivi(Array.from({ length: 7 }, (_, i) => ligne({ fixture_id: 300 + i })));
  assert.equal(
    s.ensemble.vainqueur,
    null,
    'Sept matchs ne decrivent pas une performance, ils decrivent le hasard. ' +
      'Publier « 100 % » sur cet echantillon tromperait dans les deux sens.'
  );
  assert.equal(s.ensemble.matchs, 7, 'Le nombre de matchs, lui, doit rester affiche.');
});

test('★ ACQUIS — l’ecart de confiance dit si la promesse est tenue', () => {
  // Confiance annoncee 80 %, une seule reussite sur huit : le moteur promet
  // beaucoup plus qu’il ne tient, et le panneau doit le montrer.
  const analyses = Array.from({ length: 8 }, (_, i) =>
    ligne({ fixture_id: 400 + i, confidence: 80, winner_correct: i === 0 })
  );
  const s = calculerSuivi(analyses);

  assert.equal(s.ensemble.vainqueur, 12.5);
  assert.equal(s.ensemble.confiance, 80);
  assert.equal(
    s.ensemble.ecartConfiance,
    67.5,
    'L’ecart doit valoir la confiance moins la reussite. Positif, il signale ' +
      'que le moteur promet plus qu’il ne tient — c’est le defaut qui coute la ' +
      'confiance d’un abonne.'
  );
});

test('★ ACQUIS — les semaines commencent le lundi', () => {
  assert.equal(lundiDe('2026-08-24T10:00:00.000Z'), '2026-08-24', 'Un lundi reste son propre lundi.');
  assert.equal(lundiDe('2026-08-23T10:00:00.000Z'), '2026-08-17', 'Un dimanche appartient a la semaine precedente.');
  assert.equal(lundiDe('2026-08-19T10:00:00.000Z'), '2026-08-17');
  assert.equal(lundiDe('pas une date'), '', 'Une date illisible ne doit pas fabriquer une semaine.');
});

test('★ ACQUIS — aucune analyse ne fait un suivi vide, pas un suivi faux', () => {
  const s = calculerSuivi([]);
  assert.equal(s.vide, true);
  assert.equal(s.ensemble.vainqueur, null);
  assert.deepEqual(s.semaines, []);
});
