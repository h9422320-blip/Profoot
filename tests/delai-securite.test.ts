/**
 * ★ ACQUIS — UNE BASE LENTE NE TUE PLUS LE SITE.
 *
 * ── LA NUIT DU 25 AOÛT 2026 ───────────────────────────────────────────────
 *
 * Le serveur Supabase a saturé — processeur à 100 %, plan gratuit, serveur
 * `nano`. Ça, c'était son problème. Ce qui a suivi était le nôtre :
 *
 *     /pricing   DÉPASSEMENT 30 s
 *     /matches   DÉPASSEMENT 30 s
 *     /preuves   6,4 s
 *
 * Aucun appel à la base ne portait de limite de temps. Les pages n'étaient pas
 * cassées : elles ATTENDAIENT, jusqu'à ce que le navigateur abandonne. Et
 * pendant qu'elles attendaient, chaque visiteur occupait un serveur — ce qui
 * aggravait la saturation qu'on subissait déjà.
 *
 * Un influenceur a signalé « ça bloque encore comme ce matin », et la page de
 * connexion répondait « une erreur inattendue est survenue ».
 *
 * ── CE QUE CES TESTS PROTÈGENT ────────────────────────────────────────────
 *
 * Deux choses, et elles vont ensemble :
 *
 *   1. le garde-fou rend la main VITE, et rend toujours quelque chose ;
 *   2. il est réellement BRANCHÉ là où ça compte — un garde-fou parfait qui
 *      ne tourne nulle part ne protège de rien. C'est l'angle mort qui nous a
 *      déjà échappé deux fois cette nuit-là, sur le filtre de vocabulaire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { avecDelai, DELAIS } from '../src/lib/delai-securite';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const dort = <T>(ms: number, v: T): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

// ── LE COMPORTEMENT ────────────────────────────────────────────────────────

test('★ ACQUIS — un travail lent rend la main vite, avec le repli', async () => {
  // Le cas de la panne : la base met neuf secondes. On ne doit PAS attendre.
  const debut = Date.now();
  const r = await avecDelai(dort(9000, 'TROP TARD'), 300, 'REPLI', 'test');
  const ecoule = Date.now() - debut;

  assert.equal(r, 'REPLI', "Le repli n'a pas été servi.");
  assert.ok(
    ecoule < 1000,
    `On a attendu ${ecoule} ms au lieu de rendre la main sous la seconde. ` +
      "C'est exactement le défaut qui a fait passer /pricing à trente secondes."
  );
});

test('★ ACQUIS — un travail rapide rend sa VRAIE valeur', async () => {
  // Un garde-fou qui servirait toujours le repli serait pire que pas de
  // garde-fou : le site afficherait en permanence des données figées.
  const r = await avecDelai(dort(20, 'VRAIE VALEUR'), 1000, 'REPLI', 'test');
  assert.equal(r, 'VRAIE VALEUR', 'Le repli a été servi alors que la base avait répondu.');
});

test('★ ACQUIS — une erreur ne remonte jamais à la page', async () => {
  // La base peut refuser, pas seulement tarder. L'appelant ne doit jamais
  // avoir à envelopper l'appel dans un `try` : c'est tout l'intérêt.
  const r = await avecDelai(Promise.reject(new Error('base morte')), 1000, 'REPLI', 'test');
  assert.equal(r, 'REPLI');
});

test('★ ACQUIS — « la base répond null » ne se confond pas avec « la base ne répond pas »', async () => {
  // Le piège subtil. Une lecture peut légitimement rendre `null` — la clé
  // n'existe pas en réserve, par exemple. Si le garde-fou employait `null`
  // comme marqueur interne, il servirait le repli dans ce cas parfaitement
  // normal, et masquerait la vérité. D'où le `Symbol`.
  const r = await avecDelai(dort(10, null), 1000, 'REPLI', 'test');
  assert.equal(r, null, "Une réponse `null` légitime a été prise pour un dépassement.");
});

test('★ ACQUIS — les délais restent courts', () => {
  // Un délai de dix secondes ne protégerait de rien : le visiteur est déjà
  // parti. Ces bornes sont le cœur de la protection.
  assert.ok(DELAIS.middleware <= 2000, `Délai du middleware trop long : ${DELAIS.middleware} ms`);
  assert.ok(DELAIS.page <= 3000, `Délai des pages trop long : ${DELAIS.page} ms`);
  assert.ok(DELAIS.secondaire <= 2000, `Délai secondaire trop long : ${DELAIS.secondaire} ms`);

  // Et le middleware, qui s'exécute sur CHAQUE requête, doit être le plus
  // serré de tous.
  assert.ok(
    DELAIS.middleware <= DELAIS.page,
    "Le middleware tolère plus d'attente qu'une page, alors qu'il les bloque toutes."
  );
});

// ── LE BRANCHEMENT ─────────────────────────────────────────────────────────

test('★ ACQUIS — le garde-fou est branché sur les chemins qui sont tombés', () => {
  // Chacun de ces trois fichiers correspond à une page qui a dépassé trente
  // secondes cette nuit-là.
  const points: [string, string, string][] = [
    [
      'src/lib/app-settings.ts',
      'DELAIS.middleware',
      'le middleware — il s’exécute sur CHAQUE requête, un blocage ici arrête tout le site',
    ],
    [
      'src/lib/offres.ts',
      'DELAIS.page',
      'les tarifs — LA page où se décide un achat',
    ],
    [
      'src/lib/api-football.ts',
      'DELAIS.secondaire',
      'la réserve partagée — matchs, preuves, classements, fiches de club',
    ],
  ];

  for (const [fichier, delai, role] of points) {
    const source = lire(fichier);
    assert.match(
      source,
      /avecDelai/,
      `${fichier} n'appelle plus le garde-fou. C'est ${role}.`
    );
    assert.ok(
      source.includes(delai),
      `${fichier} n'emploie plus ${delai}.`
    );
  }
});

test('★ ACQUIS — les pages les plus visitées ne se régénèrent pas toutes les cinq minutes', () => {
  // Chaque régénération relit la base et écrit dans le cache de l'hébergeur :
  // les deux se facturent. Passer de cinq à quinze minutes fait tomber le
  // compte de 288 à 96 par jour et par page.
  //
  // Sans risque : une modification de tarif depuis l'administration appelle
  // `revalidatePath`, qui vide le cache à la seconde même. Le délai n'est
  // qu'un filet pour les changements venus d'ailleurs.
  for (const page of ['src/app/(dashboard)/pricing/page.tsx', 'src/app/page.tsx']) {
    const m = lire(page).match(/export const revalidate = (\d+)/);
    assert.ok(m, `${page} n'a plus de durée de cache.`);
    assert.ok(
      Number(m![1]) >= 900,
      `${page} se régénère toutes les ${m![1]} s — trop souvent, chaque passage coûte une lecture en base et une écriture de cache.`
    );
  }
});
