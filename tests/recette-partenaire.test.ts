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

/**
 * LE CHIFFRE VIENT DE LA CAISSE, PAS DE SON REFLET.
 *
 * La table des abonnements est un reflet de la boutique. Une vente payée dont
 * le compte ne s'est jamais créé n'y figure pas. Du 16 au 22 août 2026 :
 * 99 ventes encaissées chez Chariow, 95 abonnements en base.
 */
test('CONTRAT — la recette part de la boutique Chariow, la base n est qu un secours', () => {
  const src = lire('src/lib/partenaires.ts');
  const recettes = src.slice(src.indexOf('async function recettesParMois'));

  assert.ok(
    /recettesParJour\(\)/.test(recettes),
    "La boutique n'est plus interrogée : la recette repartirait de la table des " +
      "abonnements, qui ignore les ventes payées sans compte créé."
  );

  assert.ok(
    recettes.indexOf('recettesParJour()') < recettes.indexOf('from(\'subscriptions\')'),
    "La base est consultée avant la boutique. L'ordre compte : le secours ne doit " +
      "servir que si la caisse ne répond pas."
  );
});

test('CONTRAT — la pagination Chariow ne perd pas per_page', () => {
  const src = lire('src/lib/chariow.ts');
  const fonction = src.slice(src.indexOf('export async function listRecentSales'));

  assert.ok(
    /searchParams\.set\('per_page', '100'\)/.test(fonction.slice(0, 2500)),
    "Le lien de page suivante ne reporte pas `per_page` : les pages retombent à " +
      "dix ventes. Avec cinq pages on lisait 140 ventes en croyant tenir toute la " +
      "boutique — on ne voyait que les deux derniers jours, et la recette du 16 au " +
      "19 août était simplement invisible."
  );
});

/**
 * ── UNE SEULE CAISSE, UN SEUL CHIFFRE ────────────────────────────────────
 *
 * Trois pages affichaient de l'argent et chacune le comptait à sa façon. Le
 * 22 août 2026, pour la même semaine : 343 000 côté partenaires, 319 000 côté
 * vue d'ensemble, 325 000 réellement encaissés. C'est sur l'un de ces chiffres
 * qu'on paie quelqu'un.
 */
test('CONTRAT — la vue d ensemble lit la boutique, pas les abonnements', () => {
  const src = lire('src/lib/admin-metrics.ts');
  const bloc = src.slice(src.indexOf('// ── Revenus ──'), src.indexOf('// ── Revenus ──') + 2600);

  assert.ok(
    /recettesParJour\(\)/.test(bloc) && /totalEntre\(/.test(bloc),
    "La vue d'ensemble ne consulte plus la caisse : elle réadditionnerait les " +
      "abonnements et redonnerait un chiffre différent de la page des partenaires " +
      "pour la même semaine."
  );
});

test('CONTRAT — une seule table de taux de change dans toute l application', () => {
  const fichiers = ['src/lib/recettes-boutique.ts', 'src/lib/partenaires.ts', 'src/lib/chariow.ts'];
  const definitions = fichiers.filter((f) => /export const TAUX_XOF\s*:/.test(lire(f)));

  assert.equal(
    definitions.length,
    1,
    `La table de change est définie ${definitions.length} fois (${definitions.join(', ')}). ` +
      "Deux tables finissent toujours par diverger, et c'est sur elles qu'on paie un partenaire."
  );
});

/**
 * ── LA COMMANDE DOIT APPARAÎTRE TOUT DE SUITE ────────────────────────────
 *
 * Les recettes sont gardées quelques minutes en réserve. Sans cet effacement,
 * une vente encaissée resterait invisible jusqu'à expiration.
 */
test('CONTRAT — une vente encaissée efface la réserve des recettes', () => {
  const src = lire('src/app/api/payments/chariow/webhook/route.ts');

  assert.ok(
    /oublierRecettes\(\)/.test(src),
    "Le webhook n'efface plus la réserve : une commande n'apparaîtrait dans " +
      "l'administration qu'au bout de plusieurs minutes."
  );

  // L'ordre est le fond du sujet, pas un détail de style.
  const efface = src.indexOf('oublierRecettes()');
  const abandonSansAcheteur = src.indexOf("status: 'unmatched'");
  assert.ok(
    efface > 0 && efface < abandonSansAcheteur,
    "L'effacement est placé APRÈS l'abandon des ventes sans acheteur identifiable. " +
      "Or ce sont précisément celles que la base ne voit pas — trois sur la seule " +
      "semaine du 16 août 2026. Placé là, il les manquerait toutes."
  );
});
