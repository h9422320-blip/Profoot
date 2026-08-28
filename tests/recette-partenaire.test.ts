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
 * ── LE CHIFFRE NE DOIT JAMAIS ÊTRE EN RETARD SUR LA CAISSE ───────────────
 *
 * Une version a gardé le total cinq minutes en réserve. Deux pages ouvertes à
 * une minute d'intervalle lisaient alors deux instantanés différents : le
 * 22 août 2026 à 12 h 16, la vue d'ensemble affichait 368 000 FCFA et la page
 * des partenaires 325 000, quand la caisse en avait encaissé 375 200 et
 * 336 000. Un chiffre en retard est un chiffre faux.
 */
test('CONTRAT — aucune mise en réserve sur le chemin normal des recettes', () => {
  const src = lire('src/lib/recettes-boutique.ts');
  const fonction = src.slice(src.indexOf('export async function recettesParJour'));
  const corps = fonction.slice(0, fonction.indexOf('\n}\n'));

  assert.ok(
    !/lireReserve/.test(corps),
    'Une lecture de réserve est réapparue sur le chemin des recettes. Le chiffre ' +
      'pourrait de nouveau être servi en retard, et deux pages de la même ' +
      'administration se contrediraient.'
  );

  // ── LE FILET A CHANGÉ DE NATURE, PAS DE RÔLE ──────────────────────────
  //
  // Il tenait dans un « catch » qui resservait le dernier chiffre connu, parce
  // que la seule source vivait chez Chariow. Cette boutique a fermé le 27 août
  // 2026, et ses recettes sont désormais ÉCRITES DANS LE CODE : elles ne
  // peuvent plus manquer, ni arriver en retard, ni être servies à moitié.
  //
  // La promesse d'origine — la page a toujours un chiffre à montrer — est donc
  // tenue plus solidement qu'avant. Ce qui reste à protéger, c'est qu'une
  // lecture ratée des ventes du jour n'efface pas l'histoire.
  assert.ok(
    /HISTOIRE_CHARIOW/.test(corps),
    'Les recettes figées ne sont plus servies : une panne de base ferait ' +
      'disparaître un million de francs de l’écran.'
  );
  const apresCatch = corps.slice(corps.indexOf('} catch'));
  assert.ok(
    !/return null/.test(apresCatch) && !/parJour = {}/.test(apresCatch),
    'Une lecture ratée des ventes du jour efface les recettes déjà acquises.'
  );

});

/**
 * ── ON NE DEMANDE QUE LES VENTES PAYÉES ──────────────────────────────────
 *
 * La boutique est surtout faite de paniers abandonnés : 1 163 ventes
 * enregistrées au 22 août 2026, 115 encaissées. Tout relire coûtait douze
 * requêtes et sept secondes — c'est ce qui avait rendu la mise en réserve
 * nécessaire, et donc le décalage inévitable.
 */
test('CONTRAT — les recettes sont demandées par statut, pagination préservée', () => {
  const src = lire('src/lib/chariow.ts');
  const fonction = src.slice(src.indexOf('export async function listSalesEncaissees'));
  const corps = fonction.slice(0, 2600);

  assert.ok(
    /status=\$\{statut\}/.test(corps),
    "La lecture ne filtre plus par statut : elle relirait toute la boutique, " +
      "abandons compris, et la page redeviendrait trop lente pour se passer de cache."
  );

  assert.ok(
    /searchParams\.set\('per_page', '100'\)/.test(corps) &&
      /searchParams\.set\('status', statut\)/.test(corps),
    "Le lien de page suivante ne reporte ni `per_page` ni `status` : Chariow les " +
      "honore sur la première requête puis les laisse tomber. Sans les reposer, " +
      "les pages retombent à dix ventes et rouvrent la liste complète — c'est ce " +
      "qui rendait invisible la moitié de la boutique."
  );
});

/**
 * ── LA RÈGLE DE COMPTAGE EST CELLE DE CHARIOW ────────────────────────────
 *
 * Vérifié le 22 août 2026 contre le tableau de bord de la boutique :
 * `completed + settled` donne 103 ventes et 336 000 FCFA du 16 au 22 août,
 * et 375 200 FCFA depuis l'ouverture — au franc près. Ajouter
 * `awaiting_payment` donnait 344 000 : huit mille francs qui n'étaient pas
 * entrés.
 */
test('CONTRAT — seuls completed et settled comptent comme encaissés', () => {
  const src = lire('src/lib/chariow.ts');
  const ligne = src.match(/export const STATUTS_ENCAISSES = \[([^\]]*)\]/)?.[1] ?? '';
  const statuts = ligne.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);

  assert.deepEqual(
    statuts.sort(),
    ['completed', 'settled'],
    `Les statuts comptés comme encaissés sont devenus [${statuts.join(', ')}]. ` +
      "Le total de l'administration ne correspondrait plus à celui de la boutique."
  );
});

/**
 * PERSONNE NE DOIT PAYER SANS RECEVOIR SON ACCÈS.
 *
 * Le 22 août 2026 à 14 h 55, un client écrivait « je n'arrive pas à activer ».
 * Il avait payé à 14 h 36. Deux autres attendaient depuis deux jours sans
 * jamais s'être plaints. La seule détection en place était la patience d'un
 * client.
 */
test('CONTRAT — le rattrapage des accès payés tourne chaque jour', () => {
  const entretien = lire('src/lib/entretien-quotidien.ts');

  assert.ok(
    /rattraperAccesManquants/.test(entretien),
    "Le rattrapage des accès a disparu de l'entretien quotidien : un paiement " +
      "dont le webhook échoue ne serait plus jamais rattrapé, et le client " +
      "n'aurait que le courrier électronique pour se signaler."
  );

  // L'ordre compte : c'est la seule étape où quelqu'un attend derrière.
  assert.ok(
    entretien.indexOf('rattraperAccesManquants') < entretien.indexOf('construirePreuves'),
    "Le rattrapage des accès passe après la reconstruction du mur de preuves. " +
      "Un mur reconstruit une heure plus tard ne coûte rien ; un client qui a " +
      "payé et ne peut pas entrer demande un remboursement."
  );
});

test('CONTRAT — un match acheté à l unité ne passe pas pour un accès manquant', () => {
  const src = lire('src/lib/acces-manquants.ts');

  assert.ok(
    /matchs_debloques/.test(src),
    "Seule la table des abonnements est consultée. Un match acheté à l'unité " +
      "n'y laisse aucune ligne : tous ces achats passeraient pour des accès " +
      "manquants et seraient « réparés » en abonnements. Deux faux positifs sur " +
      "six lors du premier relevé."
  );

  assert.ok(
    /activateSubscriptionFromSale/.test(src),
    "La réparation n'utilise plus la fonction d'activation de production. Une " +
      "copie appliquerait ses propres règles de plan et de durée, qui " +
      "divergeraient au premier changement de tarif."
  );
});

/**
 * QUELQU'UN DONT ON ROUVRE L'ACCÈS DOIT L'APPRENDRE — UNE SEULE FOIS.
 *
 * Un accès rendu que le client ignore ne vaut pas beaucoup mieux qu'un accès
 * manquant : il continue d'attendre, ou demande un remboursement.
 */
test('CONTRAT — un accès rouvert prévient la personne concernée', () => {
  const src = lire('src/lib/acces-manquants.ts');
  assert.ok(
    /if \(await prevenir\(/.test(src),
    "L'envoi du courriel a disparu du rattrapage : l'accès serait rouvert en " +
      "silence, et la personne continuerait d'attendre sans savoir."
  );
});

test('CONTRAT — la même personne ne peut pas être prévenue deux fois', () => {
  const src = lire('src/lib/acces-manquants.ts');
  const fonction = src.slice(src.indexOf('async function prevenir'), src.indexOf('/** Lit une table'));

  assert.ok(
    /acces:prevenu:\$\{saleId\}/.test(fonction),
    "La trace des personnes déjà prévenues a disparu. Le rattrapage tourne chaque " +
      "jour : le même message partirait tous les matins à la même personne."
  );

  // La trace est posée AVANT l'envoi, jamais après. On cherche l'APPEL
  // — `envoyerCourriel({` — et non la ligne d'import, qui figure forcément
  // en tête de fonction et ferait passer le contrôle pour rien.
  assert.ok(
    fonction.indexOf('ecrireReserve(cle') < fonction.indexOf('envoyerCourriel({'),
    "La trace est écrite après l'envoi. Si le service répond mal en ayant malgré " +
      "tout expédié le message, il repartirait chaque jour. Un message manqué se " +
      "rattrape à la main ; un message envoyé quatre fois, non."
  );
});

test('CONTRAT — un envoi impossible se voit, il ne disparaît pas', () => {
  const src = lire('src/lib/courriel.ts');
  assert.ok(
    /console\.error\([\s\S]{0,200}NON ENVOYÉ/.test(src),
    "Sans clé, l'envoi échoue en silence. On croirait prévenir des clients qu'on " +
      "ne prévient pas — pire que de ne rien avoir du tout."
  );
});

test('CONTRAT — les courriels partent du domaine vérifié, et les réponses arrivent quelque part', () => {
  const src = lire('src/lib/courriel.ts');

  // Resend n'accepte que les domaines dont on lui a prouvé la propriété.
  // `noreply@profootai.com` est l'adresse qui envoie déjà les messages de mot
  // de passe oublié, avec livraison vérifiée.
  assert.ok(
    /noreply@profootai\.com/.test(src),
    "L'expéditeur n'est plus l'adresse vérifiée : Resend refuserait l'envoi, et " +
      "aucun client ne serait prévenu."
  );

  // Ces messages disent « répondez simplement à ce message ». Sans en-tête de
  // réponse, on inviterait un client à écrire là où personne ne lit — et il
  // croirait avoir signalé son problème.
  assert.ok(
    /reply_to:/.test(src),
    "L'en-tête de réponse a disparu. Les messages invitent pourtant à répondre, " +
      "et ils partent d'un noreply@ : les réponses tomberaient dans le vide."
  );
});
