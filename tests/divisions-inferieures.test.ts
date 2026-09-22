/**
 * ★ ACQUIS — LES DIVISIONS INFÉRIEURES S'AJOUTENT SANS RIEN DÉPLACER.
 *
 * En ligne depuis le 21 septembre 2026 : la hiérarchie des championnats et la
 * mémoire des clubs connaissent la League One, la 3. Liga, la Serie C, le
 * National… Mesuré : +14 / +2 vainqueurs sur 1 560 matchs de coupe nationale,
 * +12 / +10 sur les 22 674 matchs des compétitions déjà servies, Brier égal.
 *
 * La condition qui rend cette extension acceptable : les championnats déjà en
 * ligne ne bougent PAS. Sans ce verrou, la première version déplaçait la
 * Premiership écossaise de 0,97 à 1,36.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etendreHierarchie } from '../src/lib/forces-championnats';
import { calculerMemoireClubs } from '../src/lib/memoire-clubs';

const r = (d: string, l: number, a: number, b: number, x: number, y: number) => ({ date: d, ligue: l, dom: a, ext: b, butsDom: x, butsExt: y });
// Deux clubs de Premier League (1, 2), deux de League One (3, 4), une League Cup (48) qui les croise.
const rencontres = [
  r('2025-08-01', 39, 1, 2, 2, 0), r('2025-08-02', 41, 3, 4, 1, 1), r('2025-08-03', 39, 2, 1, 1, 2),
  r('2025-08-04', 41, 4, 3, 0, 1), r('2025-08-20', 48, 1, 3, 3, 0), r('2025-08-21', 48, 4, 2, 0, 2),
  r('2025-09-01', 39, 1, 2, 1, 0), r('2025-09-02', 41, 3, 4, 2, 1), r('2025-09-20', 48, 2, 3, 2, 0),
];
const base: any = { coefficients: { '39': 1.563 }, calculeLe: '2026-09-20T12:00:00Z', matchsUtilises: 1, confrontations: 0 };

test('★ ACQUIS — les championnats en ligne ne bougent pas d’un millième', () => {
  const e = etendreHierarchie(base, rencontres, [48]);
  assert.equal(e.coefficients['39'], 1.563, 'La Premier League a bougé pendant l’extension.');
  assert.ok(e.coefficients['41'] !== undefined, 'La League One n’a pas été ajoutée.');
  assert.ok(e.coefficients['41'] < 1.563, 'La League One passe au-dessus de la Premier League.');
  assert.equal(e.coefficients['48'], undefined, 'Une coupe nationale est devenue un championnat.');
});

test('★ ACQUIS — la date de la base est conservée, sinon elle ne serait plus jamais recalculée', () => {
  const e = etendreHierarchie(base, rencontres, [48]);
  assert.equal(e.calculeLe, base.calculeLe);
});

test('★ ACQUIS — ré-étendue la nuit suivante, une division ajoutée continue d’apprendre', () => {
  const premiere = etendreHierarchie(base, rencontres, [48]);
  // Même base étendue, relue le lendemain : seule la Premier League reste figée.
  assert.deepEqual(premiere.championnatsDeBase, ['39']);
  const seconde = etendreHierarchie({ ...premiere, coefficients: { ...premiere.coefficients, '41': 5 } } as any, rencontres, [48]);
  assert.notEqual(seconde.coefficients['41'], 5, 'La League One a été figée à sa valeur de la veille : elle n’apprend plus.');
});

test('★ ACQUIS — une coupe nationale n’est jamais le championnat d’un club', () => {
  // Un club vu surtout en coupe ne doit pas être ancré sur la coupe.
  const matchs = [
    { date: '2025-08-01', ligue: 41, dom: 3, ext: 4, bd: 1, be: 0 },
    { date: '2025-08-10', ligue: 48, dom: 3, ext: 1, bd: 0, be: 2 },
    { date: '2025-08-11', ligue: 48, dom: 3, ext: 2, bd: 0, be: 1 },
    { date: '2025-08-12', ligue: 48, dom: 3, ext: 5, bd: 1, be: 1 },
  ];
  const sans = calculerMemoireClubs(matchs as any, { coefficients: { '41': 0.92, '48': 3 } });
  const avec = calculerMemoireClubs(matchs as any, { coefficients: { '41': 0.92, '48': 3 }, coupesEnPlus: [48] });
  assert.notEqual(sans.notes['3'], avec.notes['3'], 'La coupe définit encore le championnat du club.');
});
