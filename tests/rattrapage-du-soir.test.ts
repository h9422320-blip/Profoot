/**
 * ★ ACQUIS — LE MATCH DU SOIR PARAÎT SUR LE MUR LE SOIR MÊME.
 *
 * ── CE QUI S'EST PASSÉ ───────────────────────────────────────────────────
 *
 * Le 12 septembre 2026, l'entretien quotidien est passé à 18 h 40. Real Madrid
 * — Rayo Vallecano a débuté à 19 h 00, s'est terminé 4-1 — exactement le score
 * annoncé — et n'a pas paru sur le mur public. La règle de fraîcheur étant de
 * vingt heures, le passage suivant ne pouvait pas avoir lieu avant 14 h 40 le
 * lendemain : le plus beau résultat de la journée était invisible.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Une seconde couche existe, avec sa PROPRE clé et son PROPRE verrou : elle
 *    ne peut pas interférer avec l'entretien quotidien.
 * 2. Le réglage des vingt heures de l'entretien quotidien n'est pas touché.
 * 3. Le rattrapage couvre la tranche du soir, minuit compris.
 * 4. Il ne fait que deux choses — confronter les pronostics, reconstruire le
 *    mur. Pas de paiements, pas de cotes, pas d'apprentissage : l'entretien
 *    quotidien garde sa charge entière.
 * 5. La page du mur déclenche les DEUX, l'une après l'autre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ENTRE_PASSAGES_MS,
  HEURE_DEBUT,
  HEURE_FIN,
  LOT,
  dansLaTrancheDuSoir,
} from '../src/lib/rattrapage-du-soir';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const aUneHeure = (h: number) => new Date(Date.UTC(2026, 8, 12, h, 30, 0));

test('★ ACQUIS — la tranche du soir couvre les matchs européens, minuit compris', () => {
  // 19 h 00 UTC : l'heure exacte du Real Madrid — Rayo Vallecano manqué.
  assert.equal(dansLaTrancheDuSoir(aUneHeure(19)), true, 'Un match de 19 h doit être rattrapé le soir même.');
  assert.equal(dansLaTrancheDuSoir(aUneHeure(16)), true);
  assert.equal(dansLaTrancheDuSoir(aUneHeure(23)), true);
  // La tranche franchit minuit : le dernier coup de sifflet tombe vers 23 h, et
  // le fournisseur met un moment à publier le score définitif.
  assert.equal(dansLaTrancheDuSoir(aUneHeure(0)), true, 'La tranche doit franchir minuit.');
  assert.equal(dansLaTrancheDuSoir(aUneHeure(1)), true);
  // Et elle s'arrête : en pleine journée, l'entretien quotidien suffit.
  assert.equal(dansLaTrancheDuSoir(aUneHeure(2)), false);
  assert.equal(dansLaTrancheDuSoir(aUneHeure(9)), false);
  assert.equal(dansLaTrancheDuSoir(aUneHeure(15)), false);

  assert.equal(HEURE_DEBUT, 16);
  assert.equal(HEURE_FIN, 2);
});

test('★ ACQUIS — le passage revient assez souvent pour attraper un match, sans brûler le quota', () => {
  // Deux heures : la durée d'un match. Plus court gaspillerait le quota du
  // fournisseur, plus long raterait à nouveau les matchs de 21 h.
  assert.equal(ENTRE_PASSAGES_MS, 2 * 60 * 60 * 1000);
  // Au plus cinq passages sur la tranche de dix heures.
  assert.ok((10 * 3600 * 1000) / ENTRE_PASSAGES_MS <= 5);
  // Un lot plus petit que les deux mille de l'entretien : ce passage ne
  // rattrape pas un arriéré, il attrape les matchs qui viennent de finir.
  assert.ok(LOT > 0 && LOT < 2000, 'Le lot du soir doit rester plus léger que celui de l’entretien quotidien.');
});

test('★ ACQUIS — la couche du soir ne touche à rien de l’entretien quotidien', () => {
  const soir = sansCommentaires(fs.readFileSync('src/lib/rattrapage-du-soir.ts', 'utf8'));
  const jour = sansCommentaires(fs.readFileSync('src/lib/entretien-quotidien.ts', 'utf8'));

  // Le réglage validé de l'entretien quotidien reste à vingt heures.
  assert.match(
    jour,
    /FRAICHEUR_MAX_MS\s*=\s*20\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    'Le réglage des vingt heures de l’entretien quotidien ne doit pas bouger : on ajoute une couche, on ne modifie pas l’existant.'
  );

  // Des clés DISTINCTES, sinon les deux mécanismes s'éteignent mutuellement.
  assert.match(soir, /'rattrapage-soir:dernier'/);
  assert.match(soir, /'rattrapage-soir:verrou'/);
  assert.doesNotMatch(soir, /'entretien:dernier'/, 'Le rattrapage ne doit pas lire la clé de l’entretien quotidien.');
  assert.doesNotMatch(soir, /'entretien:verrou'/, 'Le rattrapage ne doit pas poser le verrou de l’entretien quotidien.');

  // Et il ne fait QUE les deux étapes du mur.
  assert.match(soir, /verifierPronostics/);
  assert.match(soir, /construirePreuves/);
  for (const horsSujet of ['rattraperAccesManquants', 'releverCotes', 'rafraichirStatutsPaiement', 'apprendre'])
    assert.doesNotMatch(
      soir,
      new RegExp(horsSujet),
      `Le rattrapage du soir ne doit pas reprendre « ${horsSujet} » : l’entretien quotidien s’en charge déjà.`
    );
});

test('★ ACQUIS — la page du mur déclenche l’entretien ET le rattrapage', () => {
  const page = sansCommentaires(fs.readFileSync('src/app/(dashboard)/preuves/page.tsx', 'utf8'));
  assert.match(page, /entretenirSiNecessaire\(\)/, 'Le déclencheur historique doit rester en place.');
  assert.match(page, /rattraperLeSoir\(\)/, 'Le rattrapage du soir doit être déclenché par la visite du mur.');
  // Dans `after`, donc après la réponse : le visiteur n'attend jamais. Sur une
  // plateforme sans serveur, une promesse laissée de côté est tuée sans un mot.
  assert.match(page, /after\(async \(\) => \{/, 'Le travail de fond doit passer par `after`.');
});

test('★ ACQUIS — le rattrapage ne travaille jamais pendant une construction', () => {
  // Le 13 septembre 2026, une construction est tombée parce que l'entretien
  // quotidien s'est déclenché pendant le prérendu de /preuves et a dépassé le
  // temps imparti : « Failed to build /preuves after 3 attempts ». Une mise en
  // ligne ne doit pas dépendre de l'heure à laquelle on la lance.
  const soir = sansCommentaires(fs.readFileSync('src/lib/rattrapage-du-soir.ts', 'utf8'));
  assert.match(
    soir,
    /NEXT_PHASE === 'phase-production-build'/,
    'Le rattrapage doit refuser de travailler pendant la construction.'
  );
});
