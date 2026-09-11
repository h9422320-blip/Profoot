/**
 * ★ ACQUIS — LA COUCHE DU MARCHÉ S'AJOUTE, ELLE NE REMPLACE RIEN.
 *
 * Décision du propriétaire, le 11 septembre 2026 : le moteur ne s'améliore
 * que par couches nouvelles. Sans la couche du marché, le moteur rend
 * EXACTEMENT ce qu'il rendait, au centième près.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculerScoreProbable } from '../src/lib/score-probable';
import { butsAttendusDuMarche } from '../src/lib/couche-marche';

const dom = { butsMarques: 18, butsEncaisses: 24, matchsJoues: 15 };
const ext = { butsMarques: 27, butsEncaisses: 15, matchsJoues: 15 };
const occ = { domicile: 1.0, exterieur: 1.5 };
const appel = (marche?: { dom: number; nul: number; ext: number; poids: number } | null) =>
  calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, marche);

test('★ ACQUIS — sans la couche du marché, le moteur rend exactement ce qu’il rendait', () => {
  const reference = calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ);
  assert.deepEqual(appel(undefined), reference, 'Le moteur a changé alors que la couche est absente.');
  assert.deepEqual(appel(null), reference, 'Une couche nulle change le moteur.');
  assert.deepEqual(appel({ dom: 0.6, nul: 0.25, ext: 0.15, poids: 0 }), reference, 'Une couche de part nulle change le moteur.');
});

test('★ ACQUIS — la couche garde le total du moteur et suit la domination du marché', () => {
  const reference = appel(null);
  // Le moteur voit l'équipe qui se déplace au-dessus ; le marché voit l'inverse.
  const avec = appel({ dom: 0.6, nul: 0.25, ext: 0.15, poids: 1 });
  assert.ok(avec.probaVictoire1 > reference.probaVictoire1, 'L’avis du marché n’a pas été pris en compte.');
  const totalAvant = reference.butsAttendus1 + reference.butsAttendus2;
  const totalApres = avec.butsAttendus1 + avec.butsAttendus2;
  assert.ok(Math.abs(totalAvant - totalApres) < 0.05, 'La couche du marché a changé le total de buts du moteur.');
});

test('★ ACQUIS — la traduction des probabilités en buts est fidèle', () => {
  const egal = butsAttendusDuMarche({ dom: 0.35, nul: 0.3, ext: 0.35 }, 2.6)!;
  assert.ok(Math.abs(egal.dom - egal.ext) < 0.01, 'Un match équilibré n’est pas traduit en buts égaux.');
  const favori = butsAttendusDuMarche({ dom: 0.7, nul: 0.2, ext: 0.1 }, 2.6)!;
  assert.ok(favori.dom > favori.ext + 0.8, 'Un grand favori n’est pas traduit en nette domination.');
  assert.ok(Math.abs(favori.dom + favori.ext - 2.6) < 1e-6, 'Le total demandé n’est pas respecté.');
  assert.equal(butsAttendusDuMarche({ dom: NaN, nul: 0.3, ext: 0.3 }, 2.6), null, 'Des probabilités illisibles produisent une lecture.');
});

test('★ ACQUIS — la couche du marché vient après les autres, en dernier paramètre', () => {
  const s = fs.readFileSync('src/lib/score-probable.ts', 'utf8');
  const iErreurs = s.indexOf('if (correctionErreurs && equipe1AJoueADomicile !== null)');
  const iMarche = s.indexOf('if (marche && equipe1AJoueADomicile !== null)');
  assert.ok(iErreurs > 0 && iMarche > iErreurs, 'La couche du marché n’est plus posée après la couche des erreurs.');
  assert.match(
    s,
    /marche\?: \{ dom: number; nul: number; ext: number; poids: number \} \| null\r?\n\): ScoreProbable \{/,
    'La couche du marché n’est plus le dernier paramètre : un appel existant pourrait changer de sens.'
  );
});
