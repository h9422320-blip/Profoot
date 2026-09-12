/**
 * ★ ACQUIS — LA MÉMOIRE DES CLUBS NE PARLE QUE LÀ OÙ LE MOTEUR EST AVEUGLE.
 *
 * ── POURQUOI ELLE EXISTE ─────────────────────────────────────────────────
 *
 * Le relevé des tirs ne couvre que les sept grands championnats. Dès qu'un
 * club en sort, `butsAttendusOccasions` rend `null` et le moteur perd TOUTE la
 * moitié occasions de son calcul : 50 % des matchs de Ligue des champions,
 * 41 % de l'Europa League (mesuré le 12 septembre 2026). Manchester United a
 * ainsi été annoncé perdant à 66 % contre Sabah, pour finir 4-0.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Sans mémoire, ou mémoire périmée, ou club inconnu, ou club à moins de
 *    cinq matchs : `avisDeLaMemoire` rend `null` et le moteur rend EXACTEMENT
 *    ce qu'il rendait.
 * 2. Le moteur ne bouge pas d'un centième quand l'avis est nul.
 * 3. Les deux appels de production ne passent la mémoire que lorsque les
 *    occasions manquent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avisDeLaMemoire, calculerMemoireClubs, PART_MEMOIRE, type MemoireClubs } from '../src/lib/memoire-clubs';
import { calculerScoreProbable } from '../src/lib/score-probable';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const jouees = (n: number) => {
  // Deux clubs qui s'affrontent n fois : 1 gagne toujours, 2 perd toujours.
  const l = [];
  for (let i = 0; i < n; i++)
    l.push({ date: `2026-0${1 + (i % 9)}-1${i % 9}T12:00:00+00:00`, dom: 1, ext: 2, bd: 2, be: 0 });
  return l;
};

test('★ ACQUIS — sans mémoire, la mémoire se tait', () => {
  assert.equal(avisDeLaMemoire(null, 1, 2), null);
  assert.equal(avisDeLaMemoire(undefined, 1, 2), null);
  assert.equal(avisDeLaMemoire({ notes: {}, joues: {}, calculeLe: new Date().toISOString(), rencontres: 0, clubs: 0 }, 1, 2), null);
});

test('★ ACQUIS — un club inconnu, un club trop peu vu, ou une mémoire périmée : elle se tait', () => {
  const memoire = calculerMemoireClubs(jouees(10));
  assert.ok(avisDeLaMemoire(memoire, 1, 2), 'Deux clubs bien connus devraient donner un avis.');
  assert.equal(avisDeLaMemoire(memoire, 1, 999), null, 'Un club inconnu doit faire taire la mémoire.');

  const maigre = calculerMemoireClubs(jouees(3));
  assert.equal(avisDeLaMemoire(maigre, 1, 2), null, 'Moins de cinq matchs : la mémoire ne décrit rien.');

  const vieille: MemoireClubs = { ...memoire, calculeLe: new Date(Date.now() - 60 * 24 * 3600_000).toISOString() };
  assert.equal(avisDeLaMemoire(vieille, 1, 2), null, 'Une mémoire de deux mois ne parle plus des équipes d’aujourd’hui.');
});

test('★ ACQUIS — la mémoire voit bien qui est le plus fort', () => {
  const memoire = calculerMemoireClubs(jouees(10));
  const avis = avisDeLaMemoire(memoire, 1, 2)!;
  assert.ok(avis.dom > avis.ext, 'Le club qui gagne toujours doit être donné favori.');
  assert.ok(Math.abs(avis.dom + avis.nul + avis.ext - 1) < 1e-9, 'Les trois parts doivent faire 100 %.');
  assert.equal(avis.poids, PART_MEMOIRE);
});

test('★ ACQUIS — le moteur ne bouge pas d’un centième quand la mémoire est absente', () => {
  const s1 = { butsMarques: 20, butsEncaisses: 12, matchsJoues: 10 };
  const s2 = { butsMarques: 14, butsEncaisses: 16, matchsJoues: 10 };
  const avant: any = calculerScoreProbable(s1 as any, s2 as any, true, false, undefined, null, undefined, false, 1, null);
  const apres: any = calculerScoreProbable(s1 as any, s2 as any, true, false, undefined, null, undefined, false, 1, null, null, null);
  assert.equal(apres.buts1, avant.buts1);
  assert.equal(apres.buts2, avant.buts2);
  assert.equal(apres.probaVictoire1, avant.probaVictoire1);
  assert.equal(apres.probaNul, avant.probaNul);
  assert.equal(apres.probaVictoire2, avant.probaVictoire2);
});

test('★ ACQUIS — la production ne consulte la mémoire que si les occasions manquent', () => {
  for (const f of ['src/app/api/analyze/route.ts', 'src/lib/precalcul-selection.ts']) {
    const s = sansCommentaires(fs.readFileSync(f, 'utf8'));
    assert.match(s, /avisDeLaMemoire/, `${f} ne consulte plus la mémoire des clubs.`);
    assert.match(
      s,
      /occasionsDuMatch\s*\r?\n?\s*\?\s*null\s*\r?\n?\s*:\s*avisDeLaMemoire|occasionsDuMatch \? null : avisDeLaMemoire/,
      `${f} doit passer la mémoire UNIQUEMENT quand les occasions manquent : sinon elle dégrade le pronostic (couche Elo refusée le 11 septembre 2026).`
    );
  }
});
