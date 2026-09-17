/**
 * ★ ACQUIS — LE CALIBRAGE D'UN CHAMPIONNAT N'EST APPRIS QUE SUR LUI-MÊME.
 *
 * Relevé le 17 septembre 2026 sur les 4 242 jugements du moteur : la ligne
 * « Premier League » contenait 370 matchs anglais ET ~130 venus de Russie, de
 * Biélorussie, du pays de Galles, d'Ukraine, d'Arménie, d'Égypte, du Bhoutan,
 * de l'Ouganda… « Serie A » portait 15 matchs brésiliens, « Bundesliga » 18
 * autrichiens, « Cup » les coupes de neuf pays, « Super League » cinq
 * championnats de cinq pays.
 *
 * Les facteurs de buts appris sur ces mélanges étaient appliqués à chacune de
 * ces compétitions — jusqu'à 0,87 sur les buts du recevant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cleDeCompetition, nommerCompetition } from '../src/lib/nom-de-competition';

test('★ ACQUIS — la clé d’une compétition porte toujours son pays', () => {
  assert.equal(cleDeCompetition('Premier League', 'England'), 'Premier League (England)');
  assert.equal(cleDeCompetition('Premier League', 'Russia'), 'Premier League (Russie)');
  assert.equal(cleDeCompetition('Cup', 'Greece'), 'Cup (Grèce)');
  assert.equal(cleDeCompetition('Super League', 'Switzerland'), 'Super League (Suisse)');
  // Les coupes d'Europe n'ont pas de pays : leur nom est déjà unique.
  assert.equal(cleDeCompetition('UEFA Champions League', 'World'), 'UEFA Champions League');
  assert.equal(cleDeCompetition('Serie A', null), 'Serie A');
  assert.equal(cleDeCompetition('', 'Italy'), null);
});

test('★ ACQUIS — le nom AFFICHÉ, lui, ne s’alourdit pas sans raison', () => {
  // Deux fonctions, deux usages : la carte du mur reste lisible.
  assert.equal(nommerCompetition('Premier League', 'England'), 'Premier League');
  assert.equal(nommerCompetition('Serie A', 'Brazil'), 'Serie A (Brésil)');
});

test('★ ACQUIS — le jugement et le moteur emploient la MÊME clé', () => {
  const calibrage = fs.readFileSync('src/lib/calibrage.ts', 'utf8');
  assert.match(calibrage, /ligue: cleDeCompetition\(f\.league\?\.name, f\.league\?\.country\)/,
    'Le jugement range de nouveau sous un nom sans pays.');
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(route, /facteursPour\(\s*await lireCalibrages\(\),\s*cleDeCompetition\(/,
    'Le moteur cherche de nouveau son calibrage sous un nom sans pays.');
});
