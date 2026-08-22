import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * LA RECETTE D'UN PARTENAIRE SE CALCULE SUR L'ARGENT REÇU.
 *
 * Le 22 août 2026, la page des partenaires affichait 343 000 FCFA du 16 au 22
 * août là où la boutique en avait encaissé 323 000. Kader touche 35 % : il
 * était payé sur 20 000 FCFA qui n'étaient jamais entrés.
 *
 * La cause tenait en une ligne : le montant venait de `PLANS[cle].amountXof`,
 * le tarif AFFICHÉ AUJOURD'HUI, et non de ce qui avait été facturé.
 *
 * Ce fichier existe pour que cette ligne ne revienne pas.
 */
test('CONTRAT — la recette partenaire lit le montant encaissé, jamais le catalogue', () => {
  const src = lire('src/lib/partenaires.ts');

  // Le corps de la fonction qui produit les recettes mois par mois.
  const recettes = src.slice(src.indexOf('async function recettesParMois'));

  assert.ok(
    /select\([^)]*\bamount\b/.test(recettes),
    "La requête ne lit plus `amount` : la recette repartirait du prix catalogue, " +
      "et un tarif qui change réécrirait rétroactivement des ventes déjà encaissées."
  );

  assert.ok(
    /montantEncaisse\(/.test(recettes),
    "`montantEncaisse` n'est plus appelée. C'est elle qui distingue l'argent reçu " +
      "du prix affiché."
  );

  assert.ok(
    !/montantAbonnement\(/.test(recettes),
    "`montantAbonnement` — le prix catalogue — est de retour dans le calcul des " +
      "recettes. C'est exactement la faute qui a fait surpayer un partenaire de " +
      "7 000 FCFA sur une seule semaine."
  );
});

test('CONTRAT — un abonnement sans paiement ne compte pour rien', () => {
  const src = lire('src/lib/partenaires.ts');
  const fonction = src.slice(src.indexOf('function montantEncaisse'));

  assert.ok(
    /chariow_sale_id\s*&&\s*!\w*\.?moneroo_payment_id|!ligne\.chariow_sale_id\s*&&\s*!ligne\.moneroo_payment_id/.test(
      fonction.slice(0, 900)
    ),
    "Un abonnement sans référence de vente — accès offert, compte de test — " +
      "redevient une recette. `offrir-acces.mjs` en crée : la part du partenaire " +
      "grossirait sans qu'un centime soit entré."
  );
});

test('CONTRAT — une même vente ne peut pas être comptée deux fois', () => {
  const src = lire('src/lib/partenaires.ts');
  assert.ok(
    /ventesVues/.test(src),
    "Le garde-fou contre les doublons a disparu. Un webhook Chariow rejoué " +
      "compterait la vente deux fois, et la part du partenaire avec."
  );
});
