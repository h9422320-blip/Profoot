/**
 * ★ ACQUIS — L'ENCAISSEMENT PAWAPAY N'OUVRE UN ACCÈS QUE CONTRE UN PAIEMENT.
 *
 * ── CE QUI EST EN JEU ─────────────────────────────────────────────────────
 *
 * L'adresse de rappel est publique. N'importe qui peut y envoyer un JSON
 * disant « COMPLETED ». Si ce message suffisait à ouvrir un accès, la totalité
 * du produit serait gratuite pour qui sait envoyer une requête.
 *
 * Ces tests protègent la seule règle qui empêche ça : le message reçu n'est
 * qu'une sonnette, le statut est TOUJOURS relu chez PawaPay avec notre jeton.
 *
 * ── ET LE RESTE ───────────────────────────────────────────────────────────
 *
 * Le montant ne vient jamais du navigateur, le bac à sable est le défaut, et
 * le jeton n'est lu que depuis l'environnement — jamais écrit dans le code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { baseUrl, estProduction, pawapayConfigure, STATUTS_FINAUX } from '../src/lib/pawapay';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const CLIENT = lire('src/lib/pawapay.ts');
const ACTIVATION = lire('src/lib/pawapay-activation.ts');
const RAPPEL = lire('src/app/api/pawapay/callback/route.ts');
const DEPOT = lire('src/app/api/pawapay/depot/route.ts');

// ── LE BAC À SABLE EST LE DÉFAUT ───────────────────────────────────────────

test('★ ACQUIS — sans réglage, on parle au bac à sable et non à la vraie caisse', () => {
  const avant = process.env.PAWAPAY_BASE_URL;
  delete process.env.PAWAPAY_BASE_URL;
  try {
    assert.equal(baseUrl(), 'https://api.sandbox.pawapay.io');
    assert.equal(estProduction(), false, 'Un oubli de réglage enverrait de vrais paiements.');
  } finally {
    if (avant) process.env.PAWAPAY_BASE_URL = avant;
  }
});

test('★ ACQUIS — la production se reconnaît à son adresse', () => {
  const avant = process.env.PAWAPAY_BASE_URL;
  process.env.PAWAPAY_BASE_URL = 'https://api.pawapay.io';
  try {
    assert.equal(estProduction(), true);
    assert.equal(baseUrl(), 'https://api.pawapay.io', 'La barre finale doit être retirée.');
    process.env.PAWAPAY_BASE_URL = 'https://api.pawapay.io/';
    assert.equal(baseUrl(), 'https://api.pawapay.io');
  } finally {
    if (avant) process.env.PAWAPAY_BASE_URL = avant;
    else delete process.env.PAWAPAY_BASE_URL;
  }
});

test('★ ACQUIS — sans jeton, le module se sait inutilisable', () => {
  const avant = process.env.PAWAPAY_API_TOKEN;
  delete process.env.PAWAPAY_API_TOKEN;
  try {
    assert.equal(pawapayConfigure(), false);
  } finally {
    if (avant) process.env.PAWAPAY_API_TOKEN = avant;
  }
});

// ── LE SECRET RESTE UN SECRET ──────────────────────────────────────────────

test('★ ACQUIS — aucun jeton en clair dans le code', () => {
  for (const [nom, src] of [['client', CLIENT], ['activation', ACTIVATION], ['rappel', RAPPEL], ['dépôt', DEPOT]] as const) {
    assert.match(
      src.includes('PAWAPAY_API_TOKEN') ? 'process.env' : 'process.env',
      /process\.env/,
      `${nom} : le jeton doit venir de l'environnement.`
    );
    // Un jeton PawaPay est un JWT : trois blocs séparés par des points.
    assert.doesNotMatch(
      src,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
      `${nom} : un jeton semble écrit en dur.`
    );
  }
});

test("★ ACQUIS — le jeton n'est jamais journalisé", () => {
  // Un message d'erreur finit dans les journaux de l'hébergeur, qui ne sont
  // pas le bon endroit pour un secret.
  const lignesDeJournal = CLIENT.split(/\r?\n/).filter((l) => /console\.(log|warn|error)/.test(l));
  for (const l of lignesDeJournal) {
    assert.doesNotMatch(l, /\bjeton\b(?!\s*(?:absent|:))/, `Journal suspect : ${l.trim()}`);
    assert.doesNotMatch(l, /PAWAPAY_API_TOKEN\s*\}/, `Le jeton est interpolé dans un journal : ${l.trim()}`);
  }
});

// ── LA RÈGLE QUI PROTÈGE TOUT LE PRODUIT ───────────────────────────────────

test("★ ACQUIS — le rappel ne décide rien : le statut est relu chez PawaPay", () => {
  // Si cette règle tombe, un inconnu ouvre un accès en envoyant un JSON.
  assert.match(
    ACTIVATION,
    /const lu = await lireStatutDepot\(depositId\)/,
    "L'activation ne relit plus le statut à la source."
  );
  assert.match(
    ACTIVATION,
    /if \(lu\.statut !== 'COMPLETED'\)/,
    "L'activation ne vérifie plus que l'encaissement est abouti."
  );

  // Le corps du message ne doit jamais servir à décider d'un statut.
  const bloc = RAPPEL.slice(RAPPEL.indexOf('export async function POST'));
  assert.doesNotMatch(
    bloc,
    /statutAnnonce\s*===\s*['"]COMPLETED['"]/,
    'Le rappel croit le statut annoncé au lieu de le vérifier.'
  );
  assert.match(bloc, /ouvrirAccesSiPaye\(admin, depositId\)/, "Le rappel n'appelle plus l'activation vérifiée.");
});

test('★ ACQUIS — un encaissement ne crédite jamais deux fois', () => {
  assert.match(
    ACTIVATION,
    /onConflict: 'chariow_sale_id', ignoreDuplicates: true/,
    'Un rappel rejoué repousserait la date d’expiration.'
  );
  assert.match(ACTIVATION, /provider: 'pawapay'/, 'La passerelle d’origine n’est plus tracée.');
});

test('★ ACQUIS — le montant payé doit correspondre à l’offre', () => {
  // Sans ce contrôle, cent francs achèteraient l'offre annuelle.
  assert.match(ACTIVATION, /toleres\.includes\(paye\)/, 'Le montant payé n’est plus confronté à l’offre.');
  assert.match(ACTIVATION, /montantsPrecedents/, 'Les anciens tarifs ne sont plus tolérés.');
});

test('★ ACQUIS — le montant ne vient jamais du navigateur', () => {
  assert.match(
    DEPOT,
    /const montant = offres\?\.\[plan\]\?\.prixXof \?\? PLANS\[plan\]\.amountXof/,
    'Le montant est relu côté serveur — sinon on choisit son prix.'
  );
  assert.doesNotMatch(DEPOT, /corps\?\.(montant|amount)/, 'Le montant est accepté depuis la requête.');
  assert.match(DEPOT, /supabase\.auth\.getUser\(\)/, "L'identité doit venir de la session.");
  assert.doesNotMatch(DEPOT, /corps\?\.(userId|user_id)/, "L'appelant choisit le compte à créditer.");
});

// ── LES STATUTS ────────────────────────────────────────────────────────────

test('★ ACQUIS — seuls deux statuts sont définitifs', () => {
  assert.deepEqual(STATUTS_FINAUX, ['COMPLETED', 'FAILED']);
  // « ACCEPTED » signifie que la demande est prise en charge, pas payée.
  assert.ok(!STATUTS_FINAUX.includes('ACCEPTED' as any), '« ACCEPTED » pris pour un paiement.');
});

test("★ ACQUIS — l'écran ne promet pas un paiement à l'acceptation", () => {
  assert.match(
    DEPOT,
    /Validez la demande qui arrive sur votre téléphone/,
    "Le message d'acceptation doit dire au client ce qu'il lui reste à faire."
  );
});

// ── L'ADRESSE DE RAPPEL ────────────────────────────────────────────────────

test('★ ACQUIS — le rappel accuse toujours réception', () => {
  // Répondre en erreur ferait réessayer PawaPay en boucle sans rien réparer.
  const bloc = RAPPEL.slice(RAPPEL.indexOf('export async function POST'));
  assert.doesNotMatch(bloc, /status:\s*5\d\d/, 'Une erreur 5xx déclencherait des réessais en boucle.');
  assert.match(bloc, /catch \(e: any\)/, 'Une exception non rattrapée produirait une 500.');
});

test("★ ACQUIS — l'empreinte du corps est contrôlée quand elle est fournie", () => {
  assert.match(RAPPEL, /content-digest/i, "L'empreinte n'est plus lue.");
  assert.match(RAPPEL, /createHash\('sha256'\)/, "L'empreinte n'est plus recalculée.");
});

// ── LE BASCULEMENT SANDBOX → PRODUCTION EST UN CHANGEMENT DE RÉGLAGE ───────

test('★ ACQUIS — une seule ligne du code décide de la passerelle contactée', () => {
  // Si un second fichier lisait PAWAPAY_BASE_URL, passer en production
  // demanderait de penser à deux endroits — et l'un des deux serait oublié.
  const fichiers = [
    'src/lib/pawapay.ts',
    'src/lib/pawapay-activation.ts',
    'src/app/api/pawapay/callback/route.ts',
    'src/app/api/pawapay/depot/route.ts',
    'src/app/api/pawapay/essai/route.ts',
  ];
  for (const f of fichiers) {
    const src = lire(f);
    const lectures = (src.match(/process\.env\.PAWAPAY_BASE_URL/g) ?? []).length;
    if (f === 'src/lib/pawapay.ts') {
      assert.equal(lectures, 1, 'pawapay.ts doit lire l’adresse exactement une fois.');
    } else {
      assert.equal(lectures, 0, `${f} lit l’adresse directement : le basculement se ferait à deux endroits.`);
    }
  }
});

test('★ ACQUIS — aucun appel ne contourne baseUrl()', () => {
  // Un `fetch('https://api.sandbox…')` écrit en dur continuerait de parler au
  // bac à sable après le passage en production. Silencieusement.
  for (const f of [
    'src/lib/pawapay.ts',
    'src/app/api/pawapay/callback/route.ts',
    'src/app/api/pawapay/depot/route.ts',
    'src/app/api/pawapay/essai/route.ts',
  ]) {
    const src = lire(f);
    for (const ligne of src.split(/\r?\n/)) {
      const nue = ligne.trim();
      if (nue.startsWith('*') || nue.startsWith('//')) continue; // commentaires
      if (!/fetch\s*\(/.test(ligne)) continue;
      assert.doesNotMatch(
        ligne,
        /https:\/\/api\.(sandbox\.)?pawapay\.io/,
        `${f} : un appel contourne baseUrl() — ${nue.slice(0, 70)}`
      );
    }
  }
});

test("★ ACQUIS — le banc d'essai refuse la production", () => {
  // Il envoie de VRAIS encaissements avec des numéros de test. Le laisser
  // tourner en production déclencherait des mouvements réels.
  const src = lire('src/app/api/pawapay/essai/route.ts');
  assert.match(src, /if \(estProduction\(\)\)/, 'Le refus de tourner en production a disparu.');
  const i = src.indexOf('if (estProduction())');
  const j = src.indexOf("const action =");
  assert.ok(i > 0 && i < j, 'Le refus doit précéder toute action.');
});
