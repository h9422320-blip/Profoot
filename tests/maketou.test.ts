/**
 * ★ ACQUIS — UNE VENTE MAKETOU N'OUVRE UN ACCÈS QUE SI ELLE EST AUTHENTIQUE.
 *
 * ── CE QUI EST EN JEU ─────────────────────────────────────────────────────
 *
 * Relevé le 27 août 2026 sur un message de test réel : MakeTou n'envoie AUCUNE
 * signature. Le seul marqueur d'origine est un `user-agent: MaketouPulse/1.0`,
 * que n'importe qui écrit en trois secondes.
 *
 * L'adresse du pulse est publique. Si elle ouvrait un accès sur simple demande,
 * ProFoot serait gratuit pour qui sait envoyer une requête. Tout repose donc
 * sur un secret partagé — et ces tests le protègent.
 *
 * ── LE PIÈGE DU MONTANT ───────────────────────────────────────────────────
 *
 * Dans le message observé, `sale.amount` vaut 2999 quand `products[0].price`
 * vaut 29.99 : la vente est en CENTIMES, le produit en unités. La veille, la
 * même confusion sur l'autre boutique avait fait afficher « 3,14 F » pour un
 * paiement de 2 000 FCFA.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  secretValide,
  offreAchetee,
  offreParNom,
  montantEnFrancs,
  montantCompatible,
  montantComparable,
  montantLisible,
  deviseDeLaVente,
  type VenteMaketou,
} from '../src/lib/maketou';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const ROUTE = lire('src/app/api/maketou/pulse/route.ts');
const MODULE = lire('src/lib/maketou.ts');

/** Le message réellement reçu de MakeTou le 27 août 2026, structure conservée. */
const VENTE_REELLE: VenteMaketou = {
  eventType: 'SUCCESSFUL_SALE',
  meta: { source: 'my-app', orderId: 'ext_order_abc123' },
  sale: { id: 'sale_123', amount: 200000, currency: 'XOF' },
  customer: { name: 'John Doe', email: 'John.Doe@Example.com', phone: '620000000' },
  products: [{ id: 'prod_123', name: 'ProFoot AI — Accès Essentiel (30 jours)', price: 2000, currency: 'XOF' }],
  originCountry: { code: 'CI', name: "Côte d'Ivoire" },
  paymentMethod: { name: 'Wave' },
};

// ── LE SECRET ──────────────────────────────────────────────────────────────

test('★ ACQUIS — sans secret configuré, rien ne peut être authentifié', () => {
  const avant = process.env.MAKETOU_PULSE_SECRET;
  delete process.env.MAKETOU_PULSE_SECRET;
  try {
    assert.equal(secretValide('nimportequoi'), false);
    assert.equal(secretValide(null), false);
    assert.equal(secretValide(''), false);
  } finally {
    if (avant) process.env.MAKETOU_PULSE_SECRET = avant;
  }
});

test('★ ACQUIS — seul le bon secret passe', () => {
  const avant = process.env.MAKETOU_PULSE_SECRET;
  process.env.MAKETOU_PULSE_SECRET = 'un-secret-de-test-123';
  try {
    assert.equal(secretValide('un-secret-de-test-123'), true);
    assert.equal(secretValide('un-secret-de-test-124'), false, 'Un caractère près, ça passe.');
    assert.equal(secretValide('un-secret-de-test-12'), false, 'Une longueur différente passe.');
    assert.equal(secretValide(null), false);
  } finally {
    if (avant) process.env.MAKETOU_PULSE_SECRET = avant;
    else delete process.env.MAKETOU_PULSE_SECRET;
  }
});

test('★ ACQUIS — la route refuse d’ouvrir sans authentification', () => {
  // Le contrôle doit précéder tout appel à l'ouverture d'accès.
  const iSecret = ROUTE.indexOf('if (!identifie)');
  const iOuvrir = ROUTE.indexOf('ouvrirAccesMaketou(');
  assert.ok(iSecret > 0, 'Le refus des messages non authentifiés a disparu.');
  assert.ok(iSecret < iOuvrir, 'L’accès s’ouvre avant la vérification du secret.');
});

test('★ ACQUIS — la comparaison du secret est à durée constante', () => {
  // Une comparaison naïve révèle, par le temps qu'elle met à échouer, combien
  // de caractères initiaux sont corrects.
  assert.match(MODULE, /ecart \|= fourni\.charCodeAt\(i\) \^ attendu\.charCodeAt\(i\)/);
});

// ── LE PIÈGE DU MONTANT ────────────────────────────────────────────────────

test('★ ACQUIS — le prix du produit fait foi, pas le montant en centimes', () => {
  // `sale.amount` = 200000, `products[0].price` = 2000. Lire le premier
  // ferait refuser une vente parfaitement valide.
  assert.equal(montantEnFrancs(VENTE_REELLE), 2000);
});

test('★ ACQUIS — les deux écritures du montant sont acceptées', () => {
  assert.equal(montantCompatible(2000, 'essential_monthly'), true, 'Écriture en unités refusée.');
  assert.equal(montantCompatible(200000, 'essential_monthly'), true, 'Écriture en centimes refusée.');
  assert.equal(montantCompatible(100, 'essential_monthly'), false, 'Cent francs achètent l’offre.');
  assert.equal(montantCompatible(2000, 'vip_yearly'), false, 'Le prix de l’Essentiel achète le VIP.');
});

test('★ ACQUIS — les anciens tarifs restent honorés', () => {
  // Une page de paiement ouverte avant une baisse de prix se règle au tarif de
  // l'époque. Refuser ces ventes débiterait le client sans rien lui donner.
  assert.equal(montantCompatible(3000, 'essential_monthly'), true);
  assert.equal(montantCompatible(9000, 'essential_monthly'), true);
});

// ── QUELLE OFFRE A ÉTÉ ACHETÉE ─────────────────────────────────────────────

test('★ ACQUIS — l’offre se reconnaît au nom du produit', () => {
  assert.equal(offreAchetee(VENTE_REELLE), 'essential_monthly');

  const pro = { ...VENTE_REELLE, products: [{ name: 'ProFoot AI — Accès Pro (30 jours)', price: 5000 }] };
  assert.equal(offreAchetee(pro), 'pro_monthly');

  const vip = { ...VENTE_REELLE, products: [{ name: 'ProFoot AI — Accès VIP (1 an)', price: 15000 }] };
  assert.equal(offreAchetee(vip), 'vip_yearly');
});

test('★ ACQUIS — un produit inconnu ne devient pas une offre par défaut', () => {
  // Sans ce refus, n'importe quel produit vendu sur la boutique ouvrirait un
  // accès — un tee-shirt à 2 000 francs donnerait un mois d'analyses.
  const inconnu = { ...VENTE_REELLE, products: [{ name: 'Casquette ProFoot', price: 7777 }] };
  assert.equal(offreAchetee(inconnu), null);
});

test('★ ACQUIS — le montant sert de repli quand le nom ne dit rien', () => {
  const sansNom = { ...VENTE_REELLE, products: [{ name: 'Article', price: 15000 }] };
  assert.equal(offreAchetee(sansNom), 'vip_yearly');
});

// ── LA MONNAIE DE L'ACHETEUR ───────────────────────────────────────────────
//
// Relevé le 28 août 2026 sur la page publique : l'offre à 2 000 FCFA s'affiche
// « 31 242 GNF » à un visiteur guinéen. Comparer 31 242 à 2 000 refuserait une
// vente honnête, et le client aurait payé pour rien.

test('★ ACQUIS — une vente en francs CFA reste vérifiée au centime', () => {
  assert.equal(montantComparable(VENTE_REELLE), true);
  assert.equal(deviseDeLaVente(VENTE_REELLE), 'XOF');
});

test('★ ACQUIS — une vente en monnaie étrangère n’est pas comparée au tarif', () => {
  const enGuinee = {
    ...VENTE_REELLE,
    sale: { id: 'v_gn', amount: 3124200, currency: 'GNF' },
    products: [{ name: 'ProFoot AI — Accès Essentiel (30 jours)', price: 31242, currency: 'GNF' }],
  };
  assert.equal(deviseDeLaVente(enGuinee), 'GNF');
  assert.equal(montantComparable(enGuinee), false, '31 242 GNF serait comparé à 2 000 FCFA.');
  assert.equal(offreParNom(enGuinee), 'essential_monthly', 'Le nom du produit doit suffire.');
});

test('★ ACQUIS — sans monnaie annoncée, le contrôle du montant s’applique', () => {
  // Ne pas relâcher la garde par défaut : c'est le cas le plus courant.
  const sansDevise = { ...VENTE_REELLE, sale: { id: 'v', amount: 2000 }, products: [{ name: 'X', price: 2000 }] };
  assert.equal(montantComparable(sansDevise), true);
});

test('★ ACQUIS — une monnaie étrangère n’ouvre rien sans nom d’offre reconnu', () => {
  // Sinon un produit quelconque vendu en euros ouvrirait un accès.
  const inconnu = {
    ...VENTE_REELLE,
    sale: { id: 'v_eu', amount: 100, currency: 'EUR' },
    products: [{ name: 'Casquette ProFoot', price: 1, currency: 'EUR' }],
  };
  assert.equal(montantComparable(inconnu), false);
  assert.equal(offreParNom(inconnu), null, 'Une casquette nomme une offre.');
});

test('★ ACQUIS — le relâchement du montant est borné au nom du produit', () => {
  // La branche « monnaie étrangère » doit exiger offreParNom, jamais offreAchetee :
  // le repli par montant y serait absurde, puisque le montant est justement
  // celui qu'on renonce à comparer.
  assert.match(MODULE, /\} else if \(!offreParNom\(vente\)\) \{/);
});

// ── LA VRAIE VENTE, ET NON PLUS LE MESSAGE DE TEST ─────────────────────────
//
// Le 28 août 2026 au matin, neuf personnes ont payé et aucune n'a reçu son
// accès. Elles ont écrit sur WhatsApp. Cause : le message de TEST de MakeTou
// porte de vrais nombres (`"price": 29.99`), les VRAIES ventes portent du
// texte (`"price": "2000"`). Le montant était jugé introuvable, et chaque
// vente refusée avec « Montant null incompatible ».
//
// Le message ci-dessous est celui d'une vente réelle, recopié du journal.

const VENTE_MALI: VenteMaketou = {
  eventType: 'SUCCESSFUL_SALE',
  sale: { id: '28a1adff-bcdb-4341-8df4-696e9e13f4ee', amount: '2040' as any },
  customer: { email: 'client@example.com' },
  products: [{ name: 'ProFoot AI — Accès Essentiel (30 jours)', price: '2000' as any }],
  originCountry: { code: 'ML' },
  paymentMethod: { name: 'Orange Money Mali' },
};

test('★ ACQUIS — un montant écrit en texte reste un montant', () => {
  assert.equal(montantEnFrancs(VENTE_MALI), 2000, 'Le montant textuel est jugé introuvable.');
  assert.equal(montantCompatible(2000, 'essential_monthly'), true);
});

test('★ ACQUIS — les frais de la boutique ne font pas refuser la vente', () => {
  // `sale.amount` vaut 2040 quand le produit coûte 2 000 : MakeTou ajoute ses
  // frais. Le prix du produit doit primer, sinon aucune vente ne passe.
  assert.equal(montantEnFrancs(VENTE_MALI), 2000, 'Les frais sont comptés dans le prix.');
});

test('★ ACQUIS — une somme écrite avec des espaces reste lisible', () => {
  const espace = { ...VENTE_MALI, products: [{ name: 'Accès Essentiel', price: '2 000' as any }] };
  assert.equal(montantEnFrancs(espace), 2000);
});

test('★ ACQUIS — un montant ABSENT n’est pas un montant FAUX', () => {
  // Refuser sur un champ que la boutique n'a pas rempli revient à punir le
  // client. L'offre est reconnue au nom ; l'accès doit s'ouvrir.
  const sansMontant: VenteMaketou = {
    eventType: 'SUCCESSFUL_SALE',
    sale: { id: 'v1' },
    customer: { email: 'client@example.com' },
    products: [{ name: 'ProFoot AI — Accès Essentiel (30 jours)' }],
  };
  assert.equal(montantLisible(sansMontant), false);
  assert.equal(offreParNom(sansMontant), 'essential_monthly');
  // Le garde-fou ne se déclenche que si le montant est LISIBLE.
  assert.match(MODULE, /if \(montantComparable\(vente\) && montantLisible\(vente\)\)/);
});

test('★ ACQUIS — un montant lisible et faux fait toujours barrage', () => {
  // Le relâchement ne doit pas ouvrir la porte : cent francs n'achètent pas
  // l'offre annuelle.
  const centFrancs = { ...VENTE_MALI, products: [{ name: 'Accès VIP', price: '100' as any }] };
  assert.equal(montantLisible(centFrancs), true);
  assert.equal(montantCompatible(100, 'vip_yearly'), false);
});

// ── CE QUE LA ROUTE GARANTIT ───────────────────────────────────────────────

test('★ ACQUIS — seule une vente réussie est traitée', () => {
  assert.match(
    MODULE,
    /vente\.eventType !== 'SUCCESSFUL_SALE'/,
    'Un remboursement ou une annulation ouvrirait un accès.'
  );
});

test('★ ACQUIS — une vente ne crédite jamais deux fois', () => {
  assert.match(
    MODULE,
    /onConflict: 'chariow_sale_id', ignoreDuplicates: true/,
    'Un pulse rejoué repousserait la date d’expiration.'
  );
  assert.match(MODULE, /provider: 'maketou'/, 'La passerelle d’origine n’est plus tracée.');
});

test('★ ACQUIS — une vente sans compte est enregistrée, pas perdue', () => {
  // Le 26 août, deux personnes ont payé sans compte et sont restées invisibles
  // jusqu'à ce qu'on les cherche à la main.
  assert.match(MODULE, /payment_intents'\)\.upsert/, 'La vente n’est plus enregistrée.');
  const iEnregistre = MODULE.indexOf("from('payment_intents').upsert");
  const iSansCompte = MODULE.indexOf('if (!userId)');
  assert.ok(
    iEnregistre > 0 && iEnregistre < iSansCompte,
    'La vente sans compte n’est pas enregistrée avant d’être écartée.'
  );
});

test('★ ACQUIS — la route accuse toujours réception', () => {
  // Une erreur ferait réessayer MakeTou en boucle sans rien réparer.
  assert.doesNotMatch(ROUTE, /status:\s*5\d\d/, 'Une 5xx déclencherait des réessais en boucle.');
  assert.match(ROUTE, /catch \(e: any\)/, 'Une exception non rattrapée produirait une 500.');
});
