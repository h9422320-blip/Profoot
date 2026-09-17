/**
 * ★ ACQUIS — LA SECONDE GRILLE CHOISIT LE SCORE, ET RIEN D'AUTRE.
 *
 * Attaques et défenses ajustées par maximum de vraisemblance (`forces-poisson`),
 * calculées chaque nuit par le challenger. Elles départagent les scores DE
 * L'ISSUE DÉJÀ RETENUE : le vainqueur annoncé, les probabilités et la confiance
 * ne bougent pas d'un centième.
 *
 * Mesuré le 17 septembre 2026 sur 5 756 rencontres du périmètre suivi, face au
 * témoin exact (même chemin, part nulle) :
 *
 *     couche éteinte ....... 443 scores exacts (7,70 %)   1-0 à 21,2 %
 *     part 0,5 ............. 572 (9,94 %)  +129            1-0 à 30,0 %
 *     part 0,75 ............ 585 (10,16 %) +142            1-0 à 30,0 %
 *
 * Positif dans les trois périodes (+81, +12, +36), et 0 vainqueur changé.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreProbable } from '../src/lib/score-probable';
import { ajusterPoisson, butsAttendusPoisson, PART_GRILLE_SCORE } from '../src/lib/forces-poisson';

const dom = { butsMarques: 30, butsEncaisses: 18, matchsJoues: 15 };
const ext = { butsMarques: 18, butsEncaisses: 24, matchsJoues: 15 };
const occ = { domicile: 1.7, exterieur: 1.0 };
const appel = (grille?: { domicile: number; exterieur: number; poids: number } | null) =>
  calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ, null, null, null, null, grille);

test('★ ACQUIS — sans seconde grille, le moteur rend exactement ce qu’il rendait', () => {
  const reference = calculerScoreProbable(dom, ext, true, false, undefined, null, undefined, false, 1, occ);
  for (const g of [undefined, null, { domicile: 1.8, exterieur: 1.4, poids: 0 }])
    assert.deepEqual(appel(g as any), reference, 'Une grille absente ou de part nulle change le moteur.');
});

test('★ ACQUIS — la grille ne touche NI les probabilités, NI la confiance, NI le vainqueur', () => {
  const sans = appel(null);
  const avec = appel({ domicile: 1.85, exterieur: 1.49, poids: PART_GRILLE_SCORE });
  assert.equal(avec.probaVictoire1, sans.probaVictoire1);
  assert.equal(avec.probaNul, sans.probaNul);
  assert.equal(avec.probaVictoire2, sans.probaVictoire2);
  assert.equal(avec.confiance, sans.confiance);
  const issue = (r: { buts1: number; buts2: number }) => (r.buts1 > r.buts2 ? 1 : r.buts1 === r.buts2 ? 0 : -1);
  assert.equal(issue(avec), issue(sans), 'La grille a changé le vainqueur annoncé : elle ne doit jamais le faire.');
});

test('★ ACQUIS — le 2-1 reste exclu, même relu par la grille', () => {
  // Le « fléau du 2-1 » : 82 % des analyses le servaient avant le calcul.
  for (const poids of [0.5, 1]) {
    const r = appel({ domicile: 1.6, exterieur: 1.35, poids });
    assert.ok(!(r.buts1 === 2 && r.buts2 === 1), 'Le 2-1 est revenu par la grille.');
    assert.ok(!(r.buts1 === 1 && r.buts2 === 2), 'Le 1-2 est revenu par la grille.');
  }
});

test('★ ACQUIS — l’ajustement se tait sans matière, et la lecture aussi', () => {
  assert.equal(ajusterPoisson([], Date.now()), null);
  assert.equal(butsAttendusPoisson(null, 1, 2), null, 'Un relevé absent produit quand même des buts attendus.');
  const force = { clubs: { '1': { attaque: 0.2, defense: 0.1 } }, terrain: 0.2, base: 0.3, rencontres: 400 };
  assert.equal(butsAttendusPoisson(force, 1, 2), null, 'Un club inconnu ne fait plus taire la grille.');
});

test('★ ACQUIS — les chiffres de buts sont relus par la grille mêlée, les issues non', () => {
  // Mesuré le 17 septembre 2026 sur 4 444 rencontres des sept grands
  // championnats : Brier « plus de 2,5 buts » 0,2533 → 0,2472, « les deux
  // marquent » 0,2538 → 0,2495, dans les trois périodes de contrôle.
  const sans: any = appel(null);
  // Un modèle qui voit BEAUCOUP plus de buts que le moteur.
  const avec: any = appel({ domicile: 2.6, exterieur: 2.2, poids: 0.5 });
  assert.ok(
    avec.probaPlusDe.deuxCinq > sans.probaPlusDe.deuxCinq + 3,
    'La grille mêlée ne change plus les probabilités de buts.'
  );
  assert.ok(avec.probaLesDeuxMarquent > sans.probaLesDeuxMarquent, 'Le « les deux marquent » n’est plus relu.');
  // Et les issues, elles, n'ont pas bougé d'un centième.
  assert.equal(avec.probaVictoire1, sans.probaVictoire1);
  assert.equal(avec.probaNul, sans.probaNul);
  assert.equal(avec.probaVictoire2, sans.probaVictoire2);
  assert.equal(avec.confiance, sans.confiance);
});

test('★ ACQUIS — en coupe d’Europe, la grille vient du modèle GLOBAL', async () => {
  // 858 matchs de coupe d'Europe : 63 scores exacts au moteur seul, 64 avec le
  // modèle de la coupe seule, 75 avec le modèle global (17 septembre 2026).
  const { butsAttendusPourLeMatch } = await import('../src/lib/forces-poisson');
  const club = (a: number, d: number) => ({ attaque: a, defense: d });
  const forces = {
    calculeLe: new Date().toISOString(),
    ligues: {
      '2': { clubs: { '1': club(0.9, 0), '2': club(-0.9, 0) }, terrain: 0.2, base: 0.2, rencontres: 300 },
      '39': { clubs: { '1': club(0.3, 0.1) }, terrain: 0.2, base: 0.2, rencontres: 400 },
      global: { clubs: { '1': club(0.1, 0), '2': club(0.05, 0) }, terrain: 0.2, base: 0.2, rencontres: 9000 },
    },
  };
  const coupe = butsAttendusPourLeMatch(forces as any, 2, 1, 2)!;
  const global = butsAttendusPourLeMatch({ ...forces, ligues: { global: forces.ligues.global } } as any, 3, 1, 2)!;
  assert.ok(Math.abs(coupe.domicile - global.domicile) < 1e-9, 'En coupe d’Europe, la grille ne vient plus du modèle global.');
  // En championnat, le modèle du championnat… et le global en secours si un club y manque.
  const secours = butsAttendusPourLeMatch(forces as any, 39, 1, 2);
  assert.ok(secours, 'Un club absent du championnat fait taire la grille au lieu de passer au modèle global.');
});
