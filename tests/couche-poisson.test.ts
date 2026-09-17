/**
 * ★ ACQUIS — LE MODÈLE DE POISSON EST CONSTRUIT, MESURÉ, ET ÉTEINT.
 *
 * Attaques et défenses ajustées par maximum de vraisemblance (Dixon-Coles),
 * réestimées chaque mois sur le seul passé. Mesuré le 18 septembre 2026 sur les
 * sept grands championnats :
 *
 *   hors banc, modèle seul contre moteur : 52,46 % contre 51,78 %, +31 justes,
 *   positif dans les trois périodes — le signal existe ;
 *   dans le vrai moteur, mêlé aux probabilités sous 55 % de confiance :
 *   +10/+12 vainqueurs, PASSE la porte, mais TROIS TRANCHES +10/+19/−7 et
 *   matchs mis en avant −1,6 point sur le top 3. Refusé.
 *
 * Tant que la couche est éteinte, le moteur doit rendre exactement ce qu'il
 * rendait.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreProbable } from '../src/lib/score-probable';
import { ajusterPoisson, avisPoisson } from '../src/lib/forces-poisson';

const dom = { butsMarques: 30, butsEncaisses: 18, matchsJoues: 15 };
const ext = { butsMarques: 18, butsEncaisses: 24, matchsJoues: 15 };
const occ = { domicile: 1.6, exterieur: 1.0 };

test('★ ACQUIS — sans second avis, le moteur rend exactement ce qu’il rendait', () => {
  const reference = calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, null, null);
  for (const avis of [undefined, null, { dom: 0.6, nul: 0.25, ext: 0.15, poids: 0 }])
    assert.deepEqual(
      calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, null, null, avis as any),
      reference,
      'Un second avis absent ou de part nulle change le moteur.'
    );
});

test('★ ACQUIS — le second avis est lu du point de vue de celui qui reçoit', () => {
  // L'équipe 1 est ici le VISITEUR : un avis qui donne le domicile gagnant doit
  // donc faire monter l'équipe 2. L'inversion de ce sens est l'erreur qui a
  // duré deux jours sur la couche élan+terrain, le 14 septembre 2026.
  const sansAvis = calculerScoreProbable(dom, ext, false, false, undefined, null, undefined, false, 1, occ, null, null, null);
  const avecAvis = calculerScoreProbable(dom, ext, false, false, undefined, null, undefined, false, 1, occ, null, null, null, { dom: 0.75, nul: 0.15, ext: 0.1, poids: 0.8 });
  assert.ok(avecAvis.probaVictoire2 > sansAvis.probaVictoire2, 'Le second avis est appliqué à l’envers.');
});

test('★ ACQUIS — l’ajustement refuse de parler sans matière', () => {
  const peu = Array.from({ length: 20 }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString(),
    ligue: 39, dom: 1 + (i % 4), ext: 1 + ((i + 1) % 4), bd: i % 3, be: (i + 1) % 3,
  }));
  assert.equal(ajusterPoisson(peu, Date.now()), null, 'Vingt rencontres suffisent à produire un avis : c’est trop peu.');
  assert.equal(avisPoisson(null, 1, 2), null);
});
