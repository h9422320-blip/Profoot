/**
 * ★ ACQUIS — L'APPLICATION NE PARLE PLUS À CHARIOW.
 *
 * ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────────
 *
 * Chariow a bloqué la boutique le 27 août 2026. Vérifié le lendemain depuis le
 * poste du propriétaire : `GET /v1/products` répond « 200, data: [] » et le
 * produit Essentiel rend un 404. La vente est passée à MakeTou le 28 août.
 *
 * ── POURQUOI COUPER, ET PAS SEULEMENT CESSER D'UTILISER ───────────────────
 *
 * Six chemins l'appelaient encore, dont un sur la route de CHAQUE page :
 * `acces-immediat` interrogeait la boutique pour toute personne ayant une
 * intention de paiement en attente. Un service mort ne répond pas vite — il
 * fait attendre, puis échoue. Ces appels ne pouvaient plus rien rapporter.
 *
 * ── CE QUE CES TESTS NE PROTÈGENT PAS, ET C'EST VOULU ─────────────────────
 *
 * La colonne `chariow_sale_id` et les 354 abonnements ACTIFS qui s'y
 * rattachent. C'est elle qui porte l'unicité empêchant de créditer deux fois ;
 * la renommer sans précaution couperait l'accès de clients qui ont payé. Le
 * nom d'une colonne n'est pas une dépendance à un service — c'est un héritage,
 * et il ne coûte rien à personne.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const CLIENT = lire('src/lib/chariow.ts');

test('★ ACQUIS — aucune fonction ne peut plus appeler la boutique fermée', () => {
  // Chaque fonction qui sortait sur le réseau doit refuser AVANT de le faire.
  const entrees = [
    'export async function initCheckout',
    'export async function listRecentSales',
    'export async function listSalesEncaissees',
    'export async function listCompletedSalesByEmail',
  ];
  for (const entree of entrees) {
    const i = CLIENT.indexOf(entree);
    assert.ok(i > 0, `${entree} a disparu — vérifier que ses appelants ne l’attendent plus.`);
    const corps = CLIENT.slice(i, i + 2500);
    const iGarde = corps.indexOf('if (BOUTIQUE_FERMEE)');
    const iReseau = corps.indexOf('await fetch(');
    assert.ok(iGarde > 0, `${entree} peut encore appeler Chariow : aucune garde.`);
    if (iReseau > 0) {
      assert.ok(
        iGarde < iReseau,
        `${entree} appelle le réseau avant sa garde : la coupure ne sert à rien.`
      );
    }
  }
});

test('★ ACQUIS — la coupure se lit à un seul endroit', () => {
  // Couper chez chaque appelant obligerait à tous les relire pour savoir si
  // l'application parle encore à Chariow. Ici, une seule ligne répond.
  assert.match(CLIENT, /const BOUTIQUE_FERMEE = true;/);
});

test('★ ACQUIS — une caisse fermée le dit à l’acheteur, pas au technicien', () => {
  // « Réponse invalide de Chariow » ne veut rien dire pour quelqu'un qui
  // voulait payer. Le message doit lui donner une suite.
  assert.match(CLIENT, /contactprofootai@gmail\.com/);
});

test('★ ACQUIS — les lectures rendent une liste vide, jamais une exception', () => {
  // Ces trois lectures s'exécutent sur des pages qui doivent continuer de
  // s'afficher : l'administration, et le filet posé sur le chemin de chaque
  // analyse. Une exception y ferait tomber la page entière.
  for (const entree of [
    'export async function listRecentSales',
    'export async function listSalesEncaissees',
    'export async function listCompletedSalesByEmail',
  ]) {
    const i = CLIENT.indexOf(entree);
    // La fenêtre est large : la signature de `listRecentSales` porte plusieurs
    // paragraphes de commentaire entre son nom et sa première instruction.
    const corps = CLIENT.slice(i, i + 2500);
    assert.match(
      corps,
      /if \(BOUTIQUE_FERMEE\) \{ refusPoli\([^)]*\); return \[\]; \}/,
      `${entree} devrait rendre une liste vide, pas lever.`
    );
  }
});
