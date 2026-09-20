/**
 * ★ ACQUIS — UNE ÉQUIPE QUI VIENT DE CHANGER D'ENTRAÎNEUR EST SURESTIMÉE.
 *
 * Mesuré le 20 septembre 2026 sur 5 679 côtés d'équipe des cinq grands
 * championnats : moins de 30 jours d'ancienneté → 26,0 % de victoires pour
 * 32,8 % annoncés ; 31 à 90 jours → 31,5 % pour 33,5 % ; plus d'un an →
 * 41,6 % pour 40,4 %.
 *
 * Avec la couche des absents, sur 3 553 rencontres : 1 892 → 1 919 bons
 * vainqueurs, positif sur les deux moitiés (+16, +11), les trois périodes
 * (+9, +12, +6) et quatre championnats sur cinq.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  joursDepuisLArrivee,
  partDeLEntraineurNeuf,
  PART_ENTRAINEUR_NEUF,
  JOURS_ENTRAINEUR_NEUF,
} from '../src/lib/entraineurs';
import { composerLaCouche } from '../src/lib/forces-absences';

const entraineurs = {
  calculeLe: '2026-09-20T00:00:00.000Z',
  clubs: {
    '33': '2022-01-01|2026-08-15,2026-08-20|',
    '50': '2016-07-01|',
  },
};

test('★ ACQUIS — on compte les jours depuis la PRISE DE FONCTION en cours', () => {
  assert.equal(joursDepuisLArrivee(entraineurs, 33, '2026-09-20T18:00:00Z'), 32);
  assert.ok((joursDepuisLArrivee(entraineurs, 50, '2026-09-20T18:00:00Z') ?? 0) > 3000, 'Un entraîneur en poste depuis dix ans doit compter des milliers de jours.');
  // Entre les deux passages, personne : on ne sait pas, et on se tait.
  assert.equal(joursDepuisLArrivee(entraineurs, 33, '2026-08-17T18:00:00Z'), null);
  assert.equal(joursDepuisLArrivee(entraineurs, 99, '2026-09-20T18:00:00Z'), null, 'Un club inconnu doit rendre null, jamais 0.');
  assert.equal(joursDepuisLArrivee(null, 33, '2026-09-20T18:00:00Z'), null);
});

test('★ ACQUIS — la correction ne dure que soixante jours, et seulement chez les grands', () => {
  assert.equal(JOURS_ENTRAINEUR_NEUF, 60);
  assert.equal(PART_ENTRAINEUR_NEUF, 0.2);
  // Arsenal (33) en Premier League (39), entraîneur arrivé le 20 août.
  assert.equal(partDeLEntraineurNeuf(entraineurs, 39, 33, '2026-09-20T18:00:00Z'), 0.2);
  // Le même club dans une compétition non couverte : silence.
  assert.equal(partDeLEntraineurNeuf(entraineurs, 203, 33, '2026-09-20T18:00:00Z'), 0);
  // Au-delà de soixante jours : silence.
  assert.equal(partDeLEntraineurNeuf(entraineurs, 39, 33, '2026-11-20T18:00:00Z'), 0);
  // Entraîneur en place depuis dix ans : silence.
  assert.equal(partDeLEntraineurNeuf(entraineurs, 39, 50, '2026-09-20T18:00:00Z'), 0);
});

test('★ ACQUIS — les deux corrections se composent comme au banc d’essai', () => {
  // Absents pesés à 0,25, entraîneur neuf à 0,20, le tout envoyé à part 1.
  const c = composerLaCouche({ domicile: 0.4, exterieur: 0.2, poids: 0.25 }, 0.2, 0)!;
  assert.ok(Math.abs(c.domicile - (0.4 * 0.25 + 0.2)) < 1e-9);
  assert.ok(Math.abs(c.exterieur - 0.2 * 0.25) < 1e-9);
  assert.equal(c.poids, 1);
  // Rien à signaler : la couche n'existe pas, et le moteur ne bouge pas.
  assert.equal(composerLaCouche(null, 0, 0), null);
  assert.equal(composerLaCouche(null, 0.2, 0)?.domicile, 0.2);
});
