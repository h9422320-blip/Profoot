import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * ★ VALIDÉ PAR LE PROPRIÉTAIRE LE 22 AOÛT 2026 — NE PLUS Y TOUCHER.
 *
 * Il a ouvert le mur, vérifié l ordre des cartes, et répondu « c est bien ».
 * Ce qui suit décrit exactement ce qu il a vu ce jour-là. Toute modification
 * du tri doit d abord faire échouer ces tests, jamais passer inaperçue.
 *
 * LE MUR DE PREUVES SE LIT DU PLUS RÉCENT AU PLUS ANCIEN.
 *
 * Ce qui ne marchait pas : la notoriété des clubs passait avant la date. Un
 * critère qui vaut cent points face à un écart d'un jour qui n'en vaut aucun,
 * cela revient à trier par célébrité et rien d'autre.
 *
 * Relevé du 22 août 2026 sur les douze premières cartes : Liverpool —
 * Barcelone de MAI 2019, Barcelone — Manchester United de février 2023,
 * Barcelone — Bayern d'octobre 2024. Pendant ce temps, les trente réussites de
 * la veille n'étaient visibles nulle part. Le mur prouvait que l'outil
 * marchait il y a sept ans.
 */
test('★ ACQUIS — le jour est le premier critère de tri du mur', () => {
  const src = lire('src/lib/preuves.ts');
  const tri = src.slice(src.indexOf('const ordonnees = [...toutes].sort'));
  const corps = tri.slice(0, tri.indexOf('});'));

  const posJour = corps.indexOf('jourB.localeCompare(jourA)');
  const posPoids = corps.indexOf('poidsAffiche');
  const posEpingle = corps.indexOf('a.miseEnAvant');

  assert.ok(posJour > 0, 'Le tri par jour a disparu du mur de preuves.');

  assert.ok(
    posJour < posPoids,
    "La notoriété des clubs est repassée avant la date. Le mur remonterait de " +
      "nouveau des victoires de 2019 par-dessus les réussites d'hier, et cesserait " +
      "de prouver que l'outil marche AUJOURD'HUI."
  );

  assert.ok(
    posJour < posEpingle,
    "Une carte épinglée repasse par-dessus des journées entières. Une seule " +
      "épingle suffisait alors à occuper la première place indéfiniment, quel " +
      "que soit l'âge du match."
  );
});

test('★ ACQUIS — les grands clubs et le score exact départagent encore', () => {
  const src = lire('src/lib/preuves.ts');
  const tri = src.slice(src.indexOf('const ordonnees = [...toutes].sort'));
  const corps = tri.slice(0, tri.indexOf('});'));

  assert.ok(
    /poidsAffiche\(a, grandsClubs\)/.test(corps),
    "La notoriété a disparu du tri : à l'intérieur d'une même journée, une " +
      "rencontre que personne ne reconnaît passerait devant Arsenal ou Marseille."
  );

  assert.ok(
    /a\.scoreExact !== b\.scoreExact/.test(corps),
    "Le score exact ne départage plus. C'est pourtant la preuve la plus forte " +
      "du mur, et celle qui porte le badge."
  );
});

/**
 * Le mur se remplit tout seul : la vérification quotidienne juge les matchs
 * terminés, puis reconstruit le mur. Sans cet enchaînement, il faudrait
 * demander la mise à jour à la main chaque jour — ce qui était le cas avant.
 */
test('★ ACQUIS — le mur se reconstruit après chaque vérification quotidienne', () => {
  const entretien = lire('src/lib/entretien-quotidien.ts');

  const posVerif = entretien.indexOf('verifierPronostics');
  const posMur = entretien.indexOf('construirePreuves');

  assert.ok(posVerif > 0 && posMur > 0, "Une des deux étapes du mur a disparu de l'entretien.");
  assert.ok(
    posVerif < posMur,
    "Le mur est reconstruit AVANT que les résultats du jour soient vérifiés : " +
      "les réussites d'aujourd'hui n'apparaîtraient qu'au lendemain."
  );
});
