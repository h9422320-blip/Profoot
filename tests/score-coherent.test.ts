import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreProbable } from '../src/lib/score-probable';

/**
 * ★ ACQUIS — LE SCORE AFFICHÉ ET LA CAGE INVIOLÉE.
 *
 * ── CE QUI A ÉTÉ MESURÉ LE 24 AOÛT 2026 ───────────────────────────────────
 *
 * Les buts attendus de chaque analyse sont conservés en base. On a donc pu
 * reconstruire la grille de Poisson de 344 rencontres vérifiées à
 * l'identique, et confronter plusieurs règles au score réellement tombé :
 *
 *   seuil │ score exact │ scores diff. │ le plus servi │ contradictoires
 *       8 │    14,5 %   │      11      │   2-1 · 25 %  │      9 %
 *       4 │    15,4 %   │      11      │   2-1 · 25 %  │      3 %
 *       0 │    16,6 %   │      10      │   2-1 · 25 %  │      0 %
 *
 * « Contradictoires » : des analyses affichant un score de parité sous un
 * texte annonçant une victoire. Le seuil est passé de huit à quatre — le plus
 * bas qui laisse encore sortir un 1-1 entre deux équipes égales.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * Que le resserrement ne parte pas plus loin qu'il ne doit, que la cage
 * inviolée reste cohérente avec le reste de la grille, et qu'elle ne devienne
 * jamais une invention : c'est une colonne d'un calcul déjà fait, pas une
 * donnée de plus demandée au fournisseur.
 */

const stats = (marques: number, encaisses: number, joues = 30) => ({
  butsMarques: Math.round(marques * joues),
  butsEncaisses: Math.round(encaisses * joues),
  matchsJoues: joues,
});

test('★ ACQUIS — un gros favori ne se voit pas annoncer 2-1', () => {
  // La plainte d'origine : « 2-1 en boucle ». Le moteur doit élargir le score
  // quand l'écart de force s'élargit, sans qu'on lui ajoute le moindre bonus.
  const serre = calculerScoreProbable(stats(1.3, 1.3), stats(1.3, 1.3), true);
  const favori = calculerScoreProbable(stats(2.0, 0.9), stats(1.0, 1.6), true);
  const ecrasant = calculerScoreProbable(stats(2.4, 0.7), stats(0.9, 1.9), true);

  const ecart = (r: { buts1: number; buts2: number }) => r.buts1 - r.buts2;

  assert.ok(
    ecart(favori) > ecart(serre),
    `Match serré ${serre.buts1}-${serre.buts2}, favori net ${favori.buts1}-${favori.buts2} : ` +
      `l'écart annoncé doit grandir avec l'écart de force.`
  );
  assert.ok(
    ecart(ecrasant) >= ecart(favori),
    `Favori net ${favori.buts1}-${favori.buts2}, écrasant ${ecrasant.buts1}-${ecrasant.buts2} : ` +
      `le score doit continuer de s'élargir.`
  );
  assert.ok(
    ecrasant.buts1 >= 3 || ecrasant.buts2 === 0,
    `Un gros favori annoncé ${ecrasant.buts1}-${ecrasant.buts2} : trop étroit pour ` +
      `2,4 buts marqués contre une défense à 1,9 encaissé.`
  );
});

test('★ ACQUIS — la cage inviolée sort de la grille, pas de nulle part', () => {
  const r = calculerScoreProbable(stats(2.0, 0.6), stats(0.9, 1.8), true);

  // Une équipe garde sa cage inviolée quand l'autre ne marque pas. Les deux
  // marquent, ou l'une des deux reste muette, ou aucune : ces cas se
  // recouvrent exactement.
  assert.ok(
    r.probaCageInviolee1 >= 0 && r.probaCageInviolee1 <= 100,
    `Cage inviolée équipe 1 : ${r.probaCageInviolee1} %, hors bornes.`
  );
  assert.ok(
    r.probaCageInviolee2 >= 0 && r.probaCageInviolee2 <= 100,
    `Cage inviolée équipe 2 : ${r.probaCageInviolee2} %, hors bornes.`
  );

  // La somme des deux ne peut pas dépasser 100 + la probabilité du 0-0, qui
  // est comptée des deux côtés. Une somme très au-delà signalerait un double
  // comptage.
  assert.ok(
    r.probaCageInviolee1 + r.probaCageInviolee2 <= 120,
    `Les deux cages inviolées totalisent ${r.probaCageInviolee1 + r.probaCageInviolee2} % : ` +
      `au-delà du 0-0 compté des deux côtés, c'est un double comptage.`
  );

  // La défense la plus solide face à l'attaque la plus faible doit avoir la
  // meilleure chance de rester muette.
  assert.ok(
    r.probaCageInviolee1 > r.probaCageInviolee2,
    `Équipe 1 (0,6 encaissé) à ${r.probaCageInviolee1} % contre équipe 2 (1,8 encaissé) à ` +
      `${r.probaCageInviolee2} % : la meilleure défense doit tenir plus souvent.`
  );
});

test('★ ACQUIS — cage inviolée et « les deux marquent » ne se contredisent pas', () => {
  for (const [m1, e1, m2, e2] of [
    [1.3, 1.3, 1.3, 1.3],
    [2.4, 0.6, 0.8, 2.0],
    [0.7, 0.6, 0.8, 0.7],
    [2.2, 1.8, 2.1, 1.9],
  ] as const) {
    const r = calculerScoreProbable(stats(m1, e1), stats(m2, e2), true);

    // Si les deux équipes marquent, aucune des deux ne garde sa cage inviolée.
    // Les trois mentions viennent de la même grille : leur somme ne peut pas
    // franchir 100 de plus que le 0-0, compté dans les deux cages.
    const total = r.probaLesDeuxMarquent + r.probaCageInviolee1 + r.probaCageInviolee2;
    assert.ok(
      total <= 125,
      `Cas ${m1}/${e1} vs ${m2}/${e2} : « les deux marquent » ${r.probaLesDeuxMarquent} % + ` +
        `cages ${r.probaCageInviolee1} % et ${r.probaCageInviolee2} % = ${total} %. ` +
        `Ces mentions sortent de la même grille et ne peuvent pas se contredire.`
    );
  }
});

test('★ ACQUIS — deux équipes identiques peuvent encore finir à égalité', () => {
  // Le garde-fou qui a refusé le seuil zéro. Il est répété ici parce que la
  // règle du score et celle de la parité se règlent au même endroit : celui
  // qui touche à l'une doit voir échouer les deux.
  let nuls = 0;
  for (const m of [0.9, 1.1, 1.3, 1.5])
    for (const e of [0.9, 1.1, 1.3, 1.5]) {
      const r = calculerScoreProbable(stats(m, e), stats(m, e), true);
      if (r.buts1 === r.buts2) nuls++;
    }

  assert.ok(
    nuls > 0,
    'Aucun score de parité sur seize affiches entre équipes identiques. Le seuil de ' +
      'domination est descendu trop bas : mesuré le 24 août 2026, quatre est le plus ' +
      'petit qui laisse encore sortir un 1-1.'
  );
});
