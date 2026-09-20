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
import { PART_DES_ABSENCES, CINQ_GRANDS, AUTRES_DU_MARCHE, LIGUES_DES_ABSENCES } from '../src/lib/forces-absences';

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

test('★ ACQUIS — les absents pèsent dans les seize championnats cotés, l’entraîneur dans cinq', () => {
  // Étendue le 20 septembre 2026 aux onze autres championnats cotés : sur
  // 7 742 rencontres, 3 885 → 3 895 bons vainqueurs, positif sur les deux
  // moitiés et les trois périodes. L'entraîneur (−4) et la parole rendue sur
  // les matchs serrés (−11) n'y ont PAS été étendus.
  assert.deepEqual([...CINQ_GRANDS].sort((a, b) => a - b), [39, 61, 78, 135, 140]);
  assert.equal(AUTRES_DU_MARCHE.size, 11);
  assert.equal(LIGUES_DES_ABSENCES.size, 16);
  for (const l of [...CINQ_GRANDS, ...AUTRES_DU_MARCHE]) assert.ok(LIGUES_DES_ABSENCES.has(l));
  const marche = fs.readFileSync('src/lib/couche-marche.ts', 'utf8');
  assert.match(
    marche,
    /CINQ_GRANDS\.has\(Number\(ligue\)\)/,
    'La part réduite du marché doit rester aux cinq grands championnats.'
  );
  const ent = fs.readFileSync('src/lib/entraineurs.ts', 'utf8');
  assert.match(
    ent,
    /if \(!CINQ_GRANDS\.has\(Number\(ligue\)\)\) return 0;/,
    'La couche de l’entraîneur doit rester aux cinq grands championnats.'
  );
  assert.equal(PART_DES_ABSENCES, 0.25);
  const s = fs.readFileSync('src/lib/forces-absences.ts', 'utf8');
  assert.match(
    s,
    /LIGUES_DES_ABSENCES\.has\(Number\(ligue\)\)/,
    'Les absents ne visent plus les seize championnats cotés.'
  );
  assert.match(
    s,
    /tableDeLaSaison\(poids, s - 1\)/,
    'Le poids ne vient plus de la saison PRÉCÉDENTE : la mesure contiendrait l’avenir.'
  );
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(route, /coucheDesAbsences\(/, 'L’analyse ne lit plus les absents.');
  const pre = fs.readFileSync('src/lib/precalcul-selection.ts', 'utf8');
  assert.match(pre, /await coucheDesAbsences\(/, 'La préparation ne lit plus les absents.');
});

test('★ ACQUIS — une couche ne peut JAMAIS faire échouer une analyse', async () => {
  // Le 20 septembre 2026, 21 analyses ont échoué en trois minutes avec
  // « Cannot read properties of undefined » : le relevé des joueurs avait
  // changé de forme avant la version qui sait la lire. Une couche est un
  // confort : elle disparaît sans bruit, elle n'emporte jamais l'analyse.
  const { coucheDesAbsences } = await import('../src/lib/forces-absences');
  // Compétition inconnue, identifiants absurdes : rien ne doit être levé.
  assert.equal(await coucheDesAbsences(null, null, null, null, null), null);
  assert.equal(await coucheDesAbsences(-1, 99999, 'pas une saison', 'x', 'y'), null);
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  assert.match(route, /coucheDesAbsences\(/, 'L’analyse n’appelle plus le point d’entrée protégé.');
  assert.doesNotMatch(route, /absencesPourLeMatch\(/, 'L’analyse appelle encore la lecture NON protégée.');
  const pre = fs.readFileSync('src/lib/precalcul-selection.ts', 'utf8');
  assert.match(pre, /await coucheDesAbsences\(/, 'La préparation n’appelle plus le point d’entrée protégé.');
  assert.doesNotMatch(pre, /absencesPourLeMatch\(/, 'La préparation appelle encore la lecture NON protégée.');
  const lib = fs.readFileSync('src/lib/forces-absences.ts', 'utf8');
  const bloc = lib.slice(lib.indexOf('export async function coucheDesAbsences('));
  assert.match(bloc, /catch \(e: any\) \{[\s\S]{0,200}return null;/, 'Le filet a disparu du point d’entrée.');
});
