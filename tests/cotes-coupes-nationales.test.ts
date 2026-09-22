/**
 * ★ ACQUIS — LES COUPES NATIONALES SONT COTÉES.
 *
 * Plus de 1 100 analyses par mois en coupe nationale, et aucune cote relevée
 * jusqu'au 21 septembre 2026 : le moteur y restait seul, à 52,6 % de
 * vainqueurs justes (1 560 matchs rejoués), 56 % seulement quand il se disait
 * sûr de lui. La couche du marché s'applique partout où une cote est relevée ;
 * il ne lui manquait que les cotes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COUPES_NATIONALES_COTEES } from '../src/lib/cotes-marche';

test('★ ACQUIS — les coupes nationales font partie du relevé des cotes', () => {
  for (const [id, nom] of [[45, 'FA Cup'], [48, 'League Cup'], [143, 'Copa del Rey'], [137, 'Coppa Italia'], [81, 'DFB Pokal'], [66, 'Coupe de France']] as [number, string][]) {
    assert.ok(COUPES_NATIONALES_COTEES.includes(id), `${nom} n’est plus relevée : le moteur y redevient seul.`);
  }
  const s = fs.readFileSync('src/lib/cotes-marche.ts', 'utf8');
  assert.match(s, /const NOS_LIGUES = new Set<number>\(\[[^\]]*\.\.\.COUPES_NATIONALES_COTEES,?[^\]]*\]\)/, 'Les coupes nationales ne sont plus dans la liste du relevé.');
});

test('★ ACQUIS — la hiérarchie en ligne se calcule exactement comme avant', async () => {
  // Les deux paramètres ajoutés (coupes en plus, championnats figés) sont vides
  // par défaut : rien ne doit bouger dans la hiérarchie publiée.
  const { apprendre } = await import('../src/lib/forces-championnats');
  const r = (d: string, l: number, a: number, b: number, x: number, y: number) => ({ date: d, ligue: l, dom: a, ext: b, butsDom: x, butsExt: y });
  const rencontres = [
    r('2025-08-01', 39, 1, 2, 2, 0), r('2025-08-02', 40, 3, 4, 1, 1), r('2025-08-03', 39, 2, 1, 1, 2),
    r('2025-08-04', 40, 4, 3, 0, 1), r('2025-09-01', 2, 1, 3, 3, 0), r('2025-09-02', 2, 4, 2, 1, 2),
  ];
  assert.deepEqual(apprendre(rencontres).coefficients, apprendre(rencontres, [], {}).coefficients);
  const fige = apprendre(rencontres, [], { '39': 1.5 });
  assert.equal(fige.coefficients['39'], 1.5, 'Un championnat figé a bougé.');
});
