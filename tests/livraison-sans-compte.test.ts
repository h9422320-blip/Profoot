/**
 * ★ ACQUIS — ON LIVRE À CELUI QUI A PAYÉ, ON NE L'ATTEND PAS.
 *
 * ── CE QUI NE MARCHAIT PAS ────────────────────────────────────────────────
 *
 * La vitrine de la boutique est publique : on peut y payer sans jamais passer
 * par le site. Ces ventes arrivent sans compte à qui les rattacher, et la
 * réponse était un courriel : « créez votre compte, votre accès s'ouvrira
 * ensuite. »
 *
 * C'était demander à quelqu'un qui a DÉJÀ PAYÉ de faire encore une démarche,
 * et de ne pas se tromper d'un caractère dans son adresse. Le 29 août 2026,
 * deux acheteurs attendaient ainsi depuis un et deux jours. Aucun n'avait créé
 * son compte.
 *
 * Une solution qui dépend d'un geste du client n'est pas une solution : c'est
 * un report du problème sur celui qui a payé.
 *
 * ── LES TROIS FAÇONS DONT CETTE LIVRAISON PEUT NUIRE ──────────────────────
 *
 *   1. créer un compte à quelqu'un qui en a déjà un ;
 *   2. livrer deux fois la même vente — deux abonnements pour un paiement ;
 *   3. créer le compte sans pouvoir prévenir la personne, qui ne saurait ni
 *      qu'il existe, ni comment y entrer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MODULE = 'src/lib/livraison-sans-compte.ts';
const PULSE = 'src/lib/maketou.ts';
const ENTRETIEN = 'src/lib/entretien-quotidien.ts';
const ACTION = 'src/app/admin/users/actions.ts';
const PORTE = 'src/app/api/livraison/route.ts';

test('★ ACQUIS — le compte est créé, l’accès crédité, le lien envoyé', () => {
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /auth\.admin\.createUser/, 'Le compte n’est plus créé.');
  assert.match(s, /from\('subscriptions'\)[\s\S]{0,80}\.upsert/, 'L’accès n’est plus crédité.');
  assert.match(s, /generateLink/, 'Le lien de mot de passe n’est plus généré.');
  assert.match(s, /messageAccesCree/, 'Le message n’est plus envoyé.');
});

test('★ ACQUIS — jamais de compte en double', () => {
  // Les adresses connues sont lues UNE fois et EN ENTIER : près de six mille
  // comptes, et une lecture partielle ferait créer un doublon à quelqu'un qui
  // possède déjà le sien.
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /const adressesConnues = new Set<string>\(\)/);
  assert.match(s, /for \(let page = 1; page <= 60; page\+\+\)/, 'La lecture des comptes n’est plus paginée.');
  assert.match(s, /if \(adressesConnues\.has\(email\)\)/);
  assert.doesNotMatch(s, /perPage: 1000/);
});

test('★ ACQUIS — jamais deux livraisons pour une même vente', () => {
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /const reference = `livraison-\$\{sale\}`/);
  assert.match(s, /\.eq\('delivery_id', reference\)/, 'La trace n’est plus consultée avant de livrer.');
  // L'unicité tient AUSSI en base : la contrainte porte sur la référence de
  // vente, donc un second passage ne peut pas ouvrir un second abonnement.
  assert.match(s, /onConflict: 'chariow_sale_id', ignoreDuplicates: true/);
});

test('★ ACQUIS — pas de compte créé si l’on ne peut prévenir personne', () => {
  // Un compte créé en silence est pire que pas de compte : la personne ne sait
  // ni qu'il existe, ni comment y entrer, et son argent semble perdu.
  const s = sansCommentaires(lire(MODULE));
  assert.match(
    s,
    /if \(!courrielDisponible\(\)\)[\s\S]{0,200}return bilan;/,
    'On peut de nouveau créer un compte sans pouvoir envoyer le lien.'
  );
});

test('★ ACQUIS — la vente est rattachée à son acheteur', () => {
  // Sans cela, le balayage suivant la compterait encore comme perdue, et la
  // livraison recommencerait indéfiniment.
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /from\('payment_intents'\)\s*\.update\(\{ user_id: userId \}\)/);
});

test('★ ACQUIS — la livraison reste bornée', () => {
  const s = sansCommentaires(lire(MODULE));
  const fenetre = s.match(/FENETRE_JOURS = (\d+)/);
  const plafond = s.match(/MAX_PAR_PASSE = (\d+)/);
  assert.ok(fenetre && Number(fenetre[1]) <= 60, 'La fenêtre de rattrapage est trop large.');
  assert.ok(plafond && Number(plafond[1]) <= 50, 'Le plafond par passe est trop haut.');
});

test('★ ACQUIS — les trois chemins mènent à la même fonction', () => {
  // Le pulse pour l'immédiat, l'entretien pour le filet, le bouton pour la
  // main. Trois copies de la règle finiraient par diverger, et la divergence
  // se paierait en abonnements en double.
  assert.match(sansCommentaires(lire(PULSE)), /livrerVentesSansCompte/, 'Le pulse ne livre plus.');
  assert.match(sansCommentaires(lire(ENTRETIEN)), /livrerVentesSansCompte/, 'L’entretien ne livre plus.');
  assert.match(sansCommentaires(lire(ACTION)), /livrerVentesSansCompte/, 'Le bouton ne livre plus.');
});

test('★ ACQUIS — le bouton de livraison est réservé à l’administration', () => {
  const a = lire(ACTION);
  assert.match(
    a,
    /export async function livrerVentesSansCompteMaintenant[\s\S]{0,200}await administrateur\(\)/,
    'La livraison manuelle ne vérifie plus qui la demande.'
  );
});

// ── LA PORTE DE SERVICE ────────────────────────────────────────────────────

test('★ ACQUIS — la porte de livraison exige la clé, dans un en-tête, en POST', () => {
  // Le 29 août 2026, le seul moyen de livrer deux clients qui avaient payé
  // était un bouton perdu dans l'administration. Le propriétaire ne l'a pas
  // trouvé sur son téléphone, et les deux ont attendu une nuit de plus. Cette
  // porte permet de déclencher la même réparation sans chercher d'écran.
  //
  // Trois garde-fous, chacun pour une raison déjà mesurée dans ce projet : la
  // clé voyage dans un en-tête (une adresse s'écrit dans les journaux, dans
  // l'historique et dans le « Referer »), la comparaison est à durée constante
  // (une comparaison naïve livre le secret lettre par lettre), et la méthode
  // est POST (un aperçu de lien suit les GET tout seul — créer des comptes ne
  // doit pas pouvoir arriver parce qu'un lien a été collé quelque part).
  const s = sansCommentaires(lire(PORTE));
  assert.match(s, /export async function POST/, 'La porte de livraison n’est plus en POST.');
  assert.doesNotMatch(s, /export async function GET/, 'Un GET rouvrirait la porte aux robots.');
  assert.match(s, /headers\.get\(['"]authorization['"]\)/, 'La clé ne passe plus par un en-tête.');
  assert.doesNotMatch(s, /searchParams/, 'Un secret dans l’adresse finit dans les journaux.');
  assert.match(s, /cleValide/, 'La comparaison n’est plus à durée constante.');
  assert.match(s, /livrerVentesSansCompte/, 'La porte ne livre plus rien.');
});

test('★ ACQUIS — la livraison lit les DEUX endroits où une vente s’écrit', () => {
  // `payment_intents` ne contient que les achats partis de profootai.com. Un
  // achat fait directement sur la vitrine de la boutique n'y laisse rien : il
  // n'existe que dans le message reçu, rangé dans `webhook_events`.
  //
  // Le 29 août 2026, la livraison a servi les deux acheteurs qu'elle voyait,
  // pendant que deux autres — payés les 20 et 25 août — lui restaient
  // invisibles. Neuf et quatre jours sans rien recevoir, sans que personne ne
  // puisse le savoir depuis l'application.
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /from\(['"]payment_intents['"]\)/, 'La livraison ne lit plus les intentions de paiement.');
  assert.match(s, /from\(['"]webhook_events['"]\)[\s\S]{0,400}payload/, 'La livraison ne lit plus les messages de la boutique.');
  assert.match(s, /planFromAmount/, 'L’offre ne se déduit plus du montant payé.');
});

test('★ ACQUIS — une vente déjà portée par un abonnement n’est jamais reservie', () => {
  // Trois cent soixante-neuf ventes de la boutique dorment dans
  // `webhook_events`. Les relire sans ce filtre offrirait un second abonnement
  // à des gens déjà servis — et un second compte à ceux qui en ont un.
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /chariow_sale_id/, 'Le filtre des ventes déjà servies a sauté.');
  assert.match(s, /servies\.has/, 'Les ventes déjà portées ne sont plus écartées.');
  assert.match(s, /adressesConnues\.has\(email\)/, 'Le garde-fou du compte existant a sauté.');
});

test('★ ACQUIS — une vente de test ne reçoit jamais de compte', () => {
  // Le 29 août 2026, en élargissant la lecture aux messages de la boutique, la
  // livraison est tombée sur les ventes fabriquées par les scripts de test du
  // 8 août. Elle leur a créé des comptes et ouvert des abonnements, qui sont
  // ensuite allés grossir le nombre d'abonnés actifs de l'administration.
  //
  // Une vente de test ressemble à une vraie : même forme, même montant. Ce qui
  // la trahit, c'est le domaine de l'adresse, et l'absence de la boutique et
  // du client dans le message — un vrai message porte toujours les deux.
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /DOMAINES_DE_TEST/, 'Les domaines de test ne sont plus écartés.');
  assert.ok(s.includes('profoot-test'), 'Le domaine des scripts de test n’est plus reconnu.');
  assert.match(s, /!p\?\.store\?\.id \|\| !p\?\.customer\?\.id/, 'Un message sans boutique ni client passe de nouveau.');
});

// ── LA REMISE EN ORDRE ─────────────────────────────────────────────────────

test('★ ACQUIS — un abonnement de test est annulé, jamais supprimé', () => {
  // Un abonnement supprimé ne se retrouve pas. Si le filtre venait à se
  // tromper — une adresse réelle prise pour une adresse de test — l'effacement
  // coûterait son accès à quelqu'un qui a payé, sans moyen de le lui rendre.
  //
  // Le montant tombe à zéro parce qu'aucun argent n'est entré : le laisser à
  // 2 000 gonflerait les recettes du mois et, avec elles, la part due aux
  // partenaires. On paierait quelqu'un sur de l'argent qui n'existe pas.
  const s = sansCommentaires(lire('src/lib/menage-comptes-test.ts'));
  assert.match(s, /status: 'cancelled', amount: 0/, 'L’abonnement de test n’est plus neutralisé.');
  assert.doesNotMatch(s, /\.delete\(\)/, 'La remise en ordre efface désormais des lignes.');
  assert.doesNotMatch(s, /deleteUser/, 'La remise en ordre supprime désormais des comptes.');
  assert.match(s, /DOMAINES_DE_TEST/, 'La liste des domaines de test n’est plus partagée avec la livraison.');
  assert.match(s, /for \(let page = 1; page <= 60; page\+\+\)/, 'La lecture des comptes n’est plus paginée.');
});
