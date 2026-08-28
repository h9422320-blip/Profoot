/**
 * ★ ACQUIS — LE BOUTON D'ACHAT MÈNE À UNE CAISSE QUI EXISTE.
 *
 * ── CE QUI EST EN JEU ─────────────────────────────────────────────────────
 *
 * Le 27 août 2026, Chariow a fermé la boutique. Vérifié le lendemain :
 * `GET /v1/products` répond « 200, data: [] » et le produit Essentiel rend un
 * 404. Le bouton d'achat appelait donc une caisse vide — plus personne ne
 * pouvait payer, et personne ne s'en apercevait depuis l'interface, qui se
 * contentait d'afficher une erreur générique.
 *
 * Ces tests protègent le chemin de remplacement : le départ vers MakeTou, et
 * le retour automatique de l'acheteur sur son analyse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { lienMaketou, offreEnVente } from '../src/lib/maketou-boutique';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const CHECKOUT = lire('src/app/api/paiement/caisse/route.ts');
const ATTENTE = lire('src/app/(dashboard)/payment-success/page.tsx');
const DEPART = lire('src/lib/depart-paiement.ts');

// ── OÙ VA L'ACHETEUR ───────────────────────────────────────────────────────

test('★ ACQUIS — l’offre Essentiel a une caisse, et c’est MakeTou', () => {
  const lien = lienMaketou('essential_monthly');
  assert.ok(lien, 'Plus aucune caisse pour l’offre d’entrée : personne ne peut payer.');
  assert.match(lien!, /^https:\/\/[a-z0-9.-]*maketou/i);
  assert.equal(offreEnVente('essential_monthly'), true);
});

test('★ ACQUIS — les trois offres ont chacune leur caisse', () => {
  // Le 28 août au matin, 26 personnes ont cliqué sur le Pro et 9 sur le VIP
  // sans pouvoir payer : leurs produits n'existaient pas encore sur la
  // boutique, et le bouton retombait sur une caisse fermée.
  for (const [plan, mot] of [
    ['essential_monthly', 'essentiel'],
    ['pro_monthly', 'pro'],
    ['vip_yearly', 'vip'],
  ] as const) {
    const lien = lienMaketou(plan);
    assert.ok(lien, `L'offre ${plan} n'a plus de caisse : personne ne peut l'acheter.`);
    assert.match(lien!, /^https:\/\/[a-z0-9.-]*maketou/i);
    assert.ok(
      lien!.toLowerCase().includes(mot),
      `L'adresse de ${plan} ne mène pas au bon produit : « ${lien} ».`
    );
    assert.equal(offreEnVente(plan), true);
  }
});

test('★ ACQUIS — une offre inconnue de la boutique ne prétend pas être en vente', () => {
  // Le repli honnête doit rester possible : un lien inventé enverrait
  // l'acheteur sur une page d'erreur, et il croirait ProFoot en panne.
  assert.equal(lienMaketou('offre_inexistante' as any), null);
});

test('★ ACQUIS — une adresse non chiffrée n’est jamais servie comme caisse', () => {
  const avant = process.env.MAKETOU_LIEN_PRO;
  process.env.MAKETOU_LIEN_PRO = 'http://boutique-interceptable.example/produit';
  try {
    assert.equal(lienMaketou('pro_monthly'), null, 'Une caisse en clair est acceptée.');
  } finally {
    if (avant) process.env.MAKETOU_LIEN_PRO = avant;
    else delete process.env.MAKETOU_LIEN_PRO;
  }
});

test('★ ACQUIS — chaque offre garde sa propre caisse', () => {
  // Une seule adresse pour trois offres ferait payer 2 000 francs un accès VIP.
  const avant = process.env.MAKETOU_LIEN_VIP;
  process.env.MAKETOU_LIEN_VIP = 'https://profoot.mymaketou.shop/fr/products/vip';
  try {
    assert.notEqual(lienMaketou('vip_yearly'), lienMaketou('essential_monthly'));
  } finally {
    if (avant) process.env.MAKETOU_LIEN_VIP = avant;
    else delete process.env.MAKETOU_LIEN_VIP;
  }
});

// ── LA ROUTE DE PAIEMENT ───────────────────────────────────────────────────

test('★ ACQUIS — MakeTou est servi avant tout appel à la boutique fermée', () => {
  const iMaketou = CHECKOUT.indexOf('const lienBoutique = lienMaketou(plan)');
  const iChariow = CHECKOUT.indexOf('await initCheckout(');
  assert.ok(iMaketou > 0, 'Le départ vers MakeTou a disparu de la route.');
  assert.ok(
    iMaketou < iChariow,
    'La route appelle Chariow avant MakeTou : la caisse vide reprend la main.'
  );
});

test('★ ACQUIS — la réponse dit par quelle passerelle on part', () => {
  // Sans ce marqueur, le navigateur ne saurait pas qu'il doit garder ProFoot
  // ouvert pour ramener l'acheteur : MakeTou, lui, ne le renverra jamais.
  assert.match(CHECKOUT, /passerelle: 'maketou'/);
});

// ── LE RETOUR DE L'ACHETEUR ────────────────────────────────────────────────

test('★ ACQUIS — l’onglet de paiement se réserve pendant le clic', () => {
  // Ouvert après l'appel réseau, le navigateur le bloquerait comme une
  // publicité, et l'acheteur perdrait le retour automatique.
  assert.match(DEPART, /window\.open\('',\s*'_blank'\)/);
  for (const page of [
    'src/app/(dashboard)/pricing/PricingClient.tsx',
    'src/app/(dashboard)/analyze/AnalyzeClient.tsx',
    'src/app/(dashboard)/expert/page.tsx',
  ]) {
    const source = lire(page);
    const iReserve = source.indexOf('reserverOngletPaiement()');
    const iAppel = source.indexOf("fetch('/api/paiement/caisse'");
    assert.ok(iReserve > 0, `${page} ne réserve plus d’onglet.`);
    assert.ok(iReserve < iAppel, `${page} ouvre l’onglet après l’appel réseau : il sera bloqué.`);
  }
});

test('★ ACQUIS — un onglet bloqué n’empêche jamais de payer', () => {
  // Certains téléphones refusent la seconde fenêtre. L'acheteur doit pouvoir
  // payer quand même, quitte à perdre le retour automatique.
  assert.match(DEPART, /if \(onglet && !onglet\.closed\)/);
  assert.match(DEPART, /window\.location\.href = caisse;/);
});

test('★ ACQUIS — l’attente tient le temps d’un paiement mobile', () => {
  // Trente secondes s'écoulaient pendant que l'acheteur composait encore son
  // code Orange Money : la page renonçait avant même qu'il ait payé.
  assert.match(ATTENTE, /const maxTentatives = viaMaketou \? 450 : 15/);
});

test('★ ACQUIS — revenir sur l’onglet déclenche une vérification immédiate', () => {
  // En arrière-plan, les navigateurs ralentissent les minuteries à une fois
  // par minute : sans cette écoute, un accès déjà ouvert resterait invisible.
  assert.match(ATTENTE, /addEventListener\('visibilitychange', auRetour\)/);
  assert.match(ATTENTE, /removeEventListener\('visibilitychange', auRetour\)/);
});

test('★ ACQUIS — l’abonné part sur son analyse sans avoir à cliquer', () => {
  assert.match(ATTENTE, /window\.location\.replace\(destination\)/);
  assert.doesNotMatch(
    ATTENTE,
    /if \(cleMatch\) window\.location\.replace/,
    'Seul l’acheteur d’un match est ramené : l’abonné reste devant un bouton.'
  );
});

test('★ ACQUIS — l’attente MakeTou n’interroge pas la boutique fermée', () => {
  // Un quart d'heure de requêtes vers un service qui ne répondra rien d'utile.
  const i = ATTENTE.indexOf('viaMaketou\n            ? Promise.resolve()');
  assert.ok(i > 0, 'La réconciliation Chariow tourne aussi pour les ventes MakeTou.');
});

test('★ ACQUIS — la page d’attente ne prétend pas que le paiement est fait', () => {
  // Elle s'ouvre AVANT le paiement désormais. Annoncer « nous confirmons votre
  // paiement » à quelqu'un qui n'a pas encore payé le ferait tout fermer.
  assert.doesNotMatch(ATTENTE, /Nous confirmons votre paiement/);
  assert.match(ATTENTE, /En attente de votre paiement/);
});
