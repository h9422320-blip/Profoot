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

test('★ ACQUIS — la fiabilité affichée est cherchée sous la clé qui porte le pays', async () => {
  // Le relevé est bâti sur les jugements, renommés le 17 septembre 2026. Sans
  // le pays, la recherche par championnat échouait et retombait sur le chiffre
  // global : « Premier League » y valait 67 %, mélangée à la Russie et à
  // l'Ukraine ; la Premier League anglaise seule vaut 50 %.
  const { fiabilitePour } = await import('../src/lib/fiabilite-apprise');
  const releve: any = {
    parLigue: {
      'Premier League (England)|nette': { justes: 50, total: 100 },
      'Premier League|nette': { justes: 67, total: 100 },
    },
    global: {},
  };
  const f = fiabilitePour(releve, 62, 22, 16, 'Premier League', 'England');
  if (f) assert.equal(f.ligue, 'Premier League (England)', 'La fiabilité ne vient plus du championnat de ce pays.');
  for (const fichier of ['src/app/api/analyze/route.ts', 'src/lib/selection-du-jour.ts', 'src/lib/grands-matchs-du-jour.ts']) {
    const s = fs.readFileSync(fichier, 'utf8');
    const appel = s.slice(s.indexOf('fiabilitePour('), s.indexOf('fiabilitePour(') + 500);
    assert.match(appel, /country|paysDuChampionnat/, `${fichier} appelle la fiabilité sans le pays : elle retombe sur le chiffre global.`);
  }
});
