/**
 * ★ ACQUIS — LES MATCHS MIS EN AVANT SONT CLASSÉS PAR LES DEUX LECTURES.
 *
 * Le moteur désigne le vainqueur ; pour choisir QUELLES rencontres mettre en
 * avant, on prend la moyenne de sa conviction et de celle du modèle de Poisson
 * pour ce même vainqueur. Mesuré le 18 septembre 2026 sur 5 756 rencontres
 * (grands championnats et coupes d'Europe, Ligue des champions d'abord), face
 * au classement par fiabilité : 3 par jour 65,4 % → 66,8 %, 5 par jour
 * 64,3 % → 66,2 %, positif dans les trois périodes
 * (`scripts/_classement-mis-en-avant.mts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avisPourLeMatch } from '../src/lib/forces-poisson';

test('★ ACQUIS — la sélection classe par la moyenne des deux lectures', () => {
  const s = fs.readFileSync('src/lib/selection-du-jour.ts', 'utf8');
  assert.match(s, /avisPourLeMatch\(forcesPoisson, f\?\.league\?\.id, f\?\.teams\?\.home\?\.id, f\?\.teams\?\.away\?\.id\)/,
    'La sélection ne lit plus la seconde lecture.');
  assert.match(s, /noteDe\.set\(Number\(f\.fixture\.id\), \(moteur \+ modele\) \/ 2\)/, 'La note n’est plus la moyenne des deux lectures.');
  // La Ligue des champions passe toujours devant : décision du propriétaire, 10 septembre 2026.
  const tri = s.slice(s.indexOf('retenus.sort('), s.indexOf('retenus.sort(') + 400);
  assert.ok(tri.indexOf('rangDeCompetition') < tri.indexOf('noteDe'), 'La note passe avant la règle « Ligue des champions d’abord ».');
  // Le seuil de fiabilité reste le filtre d'entrée.
  assert.match(s, /if \(!fiab \|\| fiab\.taux < FIABILITE_MINIMUM\) continue;/);
});

test('★ ACQUIS — en coupe d’Europe, l’avis vient du modèle global', () => {
  const club = (a: number, d: number) => ({ attaque: a, defense: d });
  const forces: any = {
    calculeLe: new Date().toISOString(),
    ligues: { global: { clubs: { '1': club(0.4, 0.1), '2': club(-0.2, -0.1) }, terrain: 0.2, base: 0.2, rencontres: 9000 } },
  };
  const a = avisPourLeMatch(forces, 2, 1, 2);
  assert.ok(a && a.dom > a.ext, 'En coupe d’Europe, le modèle global n’est plus lu.');
  assert.equal(avisPourLeMatch(null, 39, 1, 2), null);
});
