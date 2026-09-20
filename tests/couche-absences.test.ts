/**
 * ★ ACQUIS — LA COUCHE DES ABSENTS S'AJOUTE, ELLE NE REMPLACE RIEN.
 *
 * Mesurée le 20 septembre 2026 sur 3 553 rencontres des cinq grands
 * championnats depuis août 2024, avec le marché et la grille de Poisson :
 * part 0,15 → +3 vainqueurs, 0,25 → +12, 0,35 → +13, 0,50 → +4, 1,00 → −31.
 * Retenue à 0,25 : positive sur les deux moitiés, sans période négative, et
 * dans quatre championnats sur cinq.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculerScoreProbable } from '../src/lib/score-probable';
import { PART_DES_ABSENCES, CINQ_GRANDS } from '../src/lib/forces-absences';

const dom = { butsMarques: 22, butsEncaisses: 14, matchsJoues: 12 };
const ext = { butsMarques: 15, butsEncaisses: 18, matchsJoues: 12 };
const occ = { domicile: 1.4, exterieur: 1.1 };
const appel = (absences?: any, equipe1Recoit: boolean | null = true) =>
  calculerScoreProbable(dom, ext, equipe1Recoit as any, false, undefined, null, undefined, false, 1, occ, null, null, false, null, null, null, absences);

test('★ ACQUIS — sans absents, le moteur rend exactement ce qu’il rendait', () => {
  const reference = appel();
  assert.deepEqual(appel(null), reference, 'Une couche nulle change le moteur.');
  assert.deepEqual(appel({ domicile: 0.2, exterieur: 0, poids: 0 }), reference, 'Une part nulle change le moteur.');
  // Lieu inconnu : la couche se tait — on compare au moteur SANS lieu, pas à celui d'à domicile.
  assert.deepEqual(
    appel({ domicile: 0.2, exterieur: 0.1, poids: PART_DES_ABSENCES }, null),
    appel(undefined, null),
    'Lieu inconnu : la couche doit se taire.'
  );
});

test('★ ACQUIS — l’équipe amputée marque moins, et son adversaire davantage', () => {
  const reference = appel();
  const sansTitulaires = appel({ domicile: 0.25, exterieur: 0, poids: PART_DES_ABSENCES });
  assert.ok(sansTitulaires.butsAttendus1 < reference.butsAttendus1, 'L’équipe privée de titulaires marque autant qu’avant.');
  assert.ok(sansTitulaires.butsAttendus2 > reference.butsAttendus2, 'Son adversaire n’en profite pas.');
  assert.ok(sansTitulaires.probaVictoire1 < reference.probaVictoire1, 'Sa probabilité de victoire n’a pas baissé.');
});

test('★ ACQUIS — le lieu décide qui est amputé, jamais l’ordre de saisie', () => {
  // La même rencontre, saisie dans l'autre sens : c'est toujours l'équipe qui
  // REÇOIT qui est privée de ses joueurs.
  const absences = { domicile: 0.25, exterieur: 0, poids: PART_DES_ABSENCES };
  // Équipe 1 à domicile : c'est ELLE qui perd des buts attendus.
  assert.ok(appel(absences, true).butsAttendus1 < appel(undefined, true).butsAttendus1);
  // La même rencontre saisie dans l'autre sens : l'équipe 2 reçoit, et c'est
  // elle qui doit être amputée. L'équipe 1, qui se déplace, en profite.
  assert.ok(
    appel(absences, false).butsAttendus2 < appel(undefined, false).butsAttendus2,
    'Les absents ont changé de camp avec l’ordre de saisie.'
  );
  assert.ok(appel(absences, false).butsAttendus1 > appel(undefined, false).butsAttendus1);
});

test('★ ACQUIS — la couche ne parle que des cinq grands championnats', () => {
  assert.deepEqual([...CINQ_GRANDS].sort((a, b) => a - b), [39, 61, 78, 135, 140]);
  assert.equal(PART_DES_ABSENCES, 0.25);
  const s = fs.readFileSync('src/lib/forces-absences.ts', 'utf8');
  assert.match(s, /minutes\[`\$\{s - 1\}:\$\{idJoueur\}`\]/, 'Le poids ne vient plus de la saison PRÉCÉDENTE : la mesure contiendrait l’avenir.');
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(route, /await absencesPourLeMatch\(/, 'L’analyse ne lit plus les absents.');
  const pre = fs.readFileSync('src/lib/precalcul-selection.ts', 'utf8');
  assert.match(pre, /await absencesPourLeMatch\(/, 'La préparation ne lit plus les absents.');
});
