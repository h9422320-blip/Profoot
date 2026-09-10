/**
 * ★ ACQUIS — LE CALCUL DES FORCES AUX OCCASIONS EST UNE FONCTION PURE,
 * ET LA CONSTRUCTION L'APPELLE AU MÊME ENDROIT.
 *
 * ── POURQUOI CETTE SÉPARATION EXISTE ──────────────────────────────────────
 *
 * Le 10 septembre 2026, le calcul des forces a été sorti de
 * `construireForces`, où il était pris entre le téléchargement des
 * rencontres et l'écriture du relevé. Il en est sorti tel quel, pour une
 * seule raison : pouvoir rejouer le relevé à une date passée avec le VRAI
 * calcul, et non avec une copie qui finit toujours par dériver.
 *
 * ── CE QUE CES ASSERTIONS GARANTISSENT ────────────────────────────────────
 *
 *   1. la construction appelle toujours le calcul, avec son rang de reprise ;
 *   2. le calcul ne touche ni au réseau ni à la réserve ;
 *   3. il rend le même relevé pour les mêmes rencontres ;
 *   4. il range un club plus dangereux devant un club qui l'est moins ;
 *   5. une coupe d'Europe ne devient toujours pas le championnat d'un club.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { forcesDepuisRencontres, type RencontreTirs } from '../src/lib/forme-occasions';

const lire = () => fs.readFileSync('src/lib/forme-occasions.ts', 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Un petit championnat : quatre clubs, trente rencontres, A tire deux fois plus. */
function championnat(): RencontreTirs[] {
  const paires: [string, string][] = [['A', 'B'], ['C', 'D'], ['A', 'C'], ['B', 'D'], ['A', 'D'], ['B', 'C']];
  const out: RencontreTirs[] = [];
  const t0 = Date.parse('2026-01-01T15:00:00Z');
  for (let k = 0; k < 30; k++) {
    const [dom, ext] = k % 2 === 0 ? paires[k % 6] : [paires[k % 6][1], paires[k % 6][0]];
    const tirsDe = (club: string) => (club === 'A' ? 8 : 4);
    out.push({
      ligue: 'Premier League',
      date: t0 + k * 86_400_000,
      dom,
      ext,
      cadresD: tirsDe(dom),
      surfaceD: tirsDe(dom) + 2,
      cadresE: tirsDe(ext),
      surfaceE: tirsDe(ext) + 2,
      butsD: dom === 'A' ? 2 : 1,
      butsE: ext === 'A' ? 2 : 1,
    });
  }
  return out;
}

test('★ ACQUIS — la construction appelle le calcul, avec son rang de reprise', () => {
  const s = sansCommentaires(lire());
  const construction = s.slice(
    s.indexOf('export async function construireForces'),
    s.indexOf('export function forcesDepuisRencontres')
  );
  assert.match(
    construction,
    /forcesDepuisRencontres\(rencontres, arreteA\)/,
    'La construction ne passe plus par le calcul extrait, ou perd son rang de reprise.'
  );
  assert.match(construction, /if \(!releve\) return null;/, 'Un calcul impossible ne fait plus sortir la construction.');
  // Le calcul ne doit exister qu'une fois : une copie restée dans la
  // construction divergerait de celle qu'on rejoue.
  assert.equal((s.match(/const TOURS = 8;/g) ?? []).length, 1, 'Le calcul des forces existe en double.');
});

test('★ ACQUIS — le calcul ne touche ni au réseau ni à la réserve', () => {
  const s = sansCommentaires(lire());
  const debut = s.indexOf('export function forcesDepuisRencontres');
  const corps = s.slice(debut, s.indexOf('\n}\n', debut));
  for (const interdit of ['await ', 'apiFootball', 'ecrireReserve', 'lireReserve', 'lireForces', 'fetch('])
    assert.ok(!corps.includes(interdit), `Le calcul appelle « ${interdit} » : il n’est plus rejouable à une date passée.`);
});

test('★ ACQUIS — mêmes rencontres, même relevé', () => {
  const a = forcesDepuisRencontres(championnat(), 7, '2026-02-01T00:00:00.000Z');
  const b = forcesDepuisRencontres(championnat(), 7, '2026-02-01T00:00:00.000Z');
  assert.ok(a && b, 'Le calcul ne rend rien sur un championnat pourtant complet.');
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'Deux calculs sur les mêmes rencontres divergent.');
  assert.equal(a!.prochainDepart, 7, 'Le rang de reprise n’est plus transmis.');
  assert.equal(a!.construitLe, '2026-02-01T00:00:00.000Z', 'La date de construction n’est plus transmise.');
});

test('★ ACQUIS — le club le plus dangereux passe devant', () => {
  const r = forcesDepuisRencontres(championnat());
  assert.ok(r, 'Aucun relevé.');
  assert.equal(Object.keys(r!.clubs).length, 4, 'Des clubs vus quinze fois ont disparu du relevé.');
  for (const autre of ['B', 'C', 'D'])
    assert.ok(
      r!.clubs.A.attaque > r!.clubs[autre].attaque,
      `A tire deux fois plus que ${autre} et n’est pas jugé plus dangereux.`
    );
});

test('★ ACQUIS — une coupe d’Europe ne devient pas le championnat d’un club', () => {
  const avecCoupe = [
    ...championnat(),
    ...[0, 1].map((k) => ({
      ligue: 'Ligue des champions',
      date: Date.parse('2026-03-01T20:00:00Z') + k * 86_400_000,
      dom: 'A',
      ext: 'Z',
      cadresD: 6, surfaceD: 8, cadresE: 3, surfaceE: 4, butsD: 1, butsE: 0,
    })),
  ];
  const r = forcesDepuisRencontres(avecCoupe);
  assert.equal(r?.clubs.A.ligue, 'Premier League', 'Deux matchs de coupe ont changé le championnat de A.');
});
