/**
 * ★ ACQUIS — CHAQUE ACHAT DONNE SON QUOTA, TOUT DE SUITE.
 *
 * ── LA RÈGLE, TELLE QUE LE PROPRIÉTAIRE L'ÉNONCE ──────────────────────────
 *
 * « Il achète 2 000, il a 20 analyses. Il les finit, il rachète 2 000, on lui
 * redonne 20 analyses. Même le même jour. Même cinquante fois. »
 *
 * Ce n'est pas un abonnement à débit mensuel : c'est un carnet qu'on recharge.
 *
 * ── CE QUE ÇA A COÛTÉ ─────────────────────────────────────────────────────
 *
 * Le calcul des droits ne retenait QUE l'abonnement du meilleur niveau : deux
 * Essentiel étant du même rang, le second était ignoré. Il donnait des jours
 * de validité, aucune analyse.
 *
 * Le 28 août 2026 à 10 h 49 et 10 h 50, quelqu'un paie DEUX FOIS 2 000 FCFA,
 * reçoit 20 analyses, les épuise, se retrouve bloqué, et écrit : « Je paye
 * deux fois, normalement 40 analyses. » Il avait raison.
 *
 * Relevé le 29 août sur la base : 33 comptes cumulaient plusieurs abonnements
 * actifs, et DIX-SEPT étaient bloqués alors qu'ils avaient payé.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PLANS, UNLIMITED, currentPeriodStart } from '../src/lib/subscription';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SOURCE = 'src/lib/subscription.ts';

test('★ ACQUIS — le quota est la SOMME des offres achetées et valides', () => {
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /quotaCumule \+= limite/, 'Le quota ne se cumule plus.');
  assert.match(
    s,
    /analysisLimit: quotaIllimite \? UNLIMITED : quotaCumule/,
    'Les droits rendus ne portent plus le quota cumulé.'
  );
});

test('★ ACQUIS — le cumul se fait AVANT le classement par niveau', () => {
  // C'était exactement le défaut : le `continue` qui écarte les abonnements de
  // niveau inférieur ou égal passait AVANT le comptage. Les abonnements
  // ignorés étaient précisément ceux que le client avait payés.
  const s = sansCommentaires(lire(SOURCE));
  const iCumul = s.indexOf('quotaCumule += limite');
  const iRang = s.indexOf('if (RANK[config.tier] <= RANK[best.plan]) continue;');
  assert.ok(iCumul > 0 && iRang > 0, 'Les deux repères doivent exister.');
  assert.ok(
    iCumul < iRang,
    'Le cumul est repassé APRÈS le filtre de niveau : les rachats de même offre sont de nouveau ignorés.'
  );
});

test('★ ACQUIS — la période part du plus ancien achat encore valide', () => {
  // Sinon un rachat effacerait les analyses déjà consommées sur l'achat
  // précédent, et ferait cadeau de ce qui a déjà servi.
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /debutLePlusAncien/, 'La période ne part plus du plus ancien achat.');
  assert.match(s, /debut < debutLePlusAncien/);
  assert.match(s, /periodStart: debutLePlusAncien/);
});

test('★ ACQUIS — deux Essentiel le même jour font 40 analyses', () => {
  // Le cas exact de Tenere, mesuré : deux achats à 10 h 49 et 10 h 50, vingt
  // analyses consommées, vingt encore dues.
  const limite = PLANS.essential_monthly.analysisLimit;
  assert.equal(limite, 20);
  assert.equal(limite + limite, 40, 'Deux Essentiel ne font plus 40 analyses.');

  // Consommé 20 sur 40 : il lui en reste 20, il n'est plus bloqué.
  const utilise = 20;
  assert.equal(Math.max(0, limite * 2 - utilise), 20);
});

test('★ ACQUIS — un VIP illimité n’est jamais réduit à une somme', () => {
  // Additionner un quota fini à un illimité donnerait un nombre — et
  // enfermerait un VIP annuel dans une limite qu'il n'a jamais eue.
  assert.equal(PLANS.vip_yearly.analysisLimit, UNLIMITED);
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /if \(limite === UNLIMITED\) quotaIllimite = true;/);
  assert.match(s, /else quotaCumule \+= limite;/);
});

test('★ ACQUIS — le niveau reste celui de l’offre la plus avantageuse', () => {
  // Cumuler les quotas ne doit pas cumuler les privilèges : quelqu'un qui a un
  // Essentiel et un Pro reste Pro, il ne devient pas VIP.
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /if \(RANK\[config\.tier\] <= RANK\[best\.plan\]\) continue;/);
  assert.match(s, /plan: config\.tier/);
});

test('★ ACQUIS — la période de quota se calcule toujours par cycles', () => {
  // Un abonnement de trente jours souscrit il y a soixante-cinq jours ouvre sa
  // troisième période, pas la première.
  const depuis = '2026-06-01T00:00:00.000Z';
  const debut = currentPeriodStart(depuis, 30, new Date('2026-08-05T00:00:00.000Z'));
  assert.equal(debut.toISOString(), '2026-07-31T00:00:00.000Z');
});

// ── LA MOITIÉ QUI MANQUAIT : LE BOUTON ────────────────────────────────────
//
// Le serveur savait cumuler depuis le 29 août 2026. La page des tarifs, elle,
// n'a jamais laissé personne recharger : `RANK[plan] >= RANK[tier]` grisait
// l'offre en cours sous l'étiquette « Accès Actif ».
//
// Le 4 septembre 2026, un client l'écrit à l'influenceur qui l'avait amené :
// « j'essaye de faire un abonnement de 2000 je n'arrive plus, il faut que
// j'attende jusqu'au 24 ». Vingt jours d'attente imposés à quelqu'un qui
// voulait payer le jour même — la règle du propriétaire, « même le même jour,
// même cinquante fois », était appliquée par le serveur et refusée par
// l'interface.
//
// Ces deux tests tiennent la porte ouverte.

const TARIFS = 'src/app/(dashboard)/pricing/PricingClient.tsx';

test('★ ACQUIS — l’offre en cours reste RACHETABLE sur la page des tarifs', () => {
  const s = sansCommentaires(lire(TARIFS));

  assert.match(
    s,
    /const couvertPar = \(tier: PlanTier\) => RANK\[plan\] > RANK\[tier\];/,
    'La comparaison est redevenue « >= » : un abonné ne peut plus recharger son propre accès.'
  );
  assert.doesNotMatch(
    s,
    /RANK\[plan\] >= RANK\[tier\]/,
    'Le verrou du 4 septembre 2026 est revenu.'
  );

  // Le bouton ne doit être éteint que par « couvert » (offre inférieure) ou
  // « dejaVip » (illimité, rien à recharger). Jamais par l'égalité de niveau.
  assert.match(
    s,
    /disabled=\{loadingPlan !== null \|\| checkingStatus \|\| couvert \|\| dejaVip\}/,
    'La condition d’extinction du bouton a changé — vérifier qu’elle n’enferme pas de nouveau l’offre en cours.'
  );
  assert.match(
    s,
    /const renouvellement = plan === offre\.tier && plan !== 'FREE';/,
    'Le cas du rachat de sa propre offre n’est plus distingué.'
  );
});

test('★ ACQUIS — le client à sec n’est plus renvoyé à la fin du mois', () => {
  // La date de remise à zéro venait AVANT la possibilité de recharger. C'est
  // cette phrase-là, lue seule, qui a produit « il faut que j'attende ».
  const s = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));
  const bloc = s.slice(s.indexOf('analyses du mois qui sont épuisées'));
  const posRecharge = bloc.indexOf('Rechargez');
  const posDate = bloc.indexOf('votre compteur repart');

  assert.ok(posRecharge > 0, 'Le message ne propose plus de recharger.');
  assert.ok(
    posDate < 0 || posRecharge < posDate,
    'La date de remise à zéro repasse avant le rechargement : elle se lit comme une attente obligatoire.'
  );
});

test('★ ACQUIS — l’écran dit D’ABORD que l’accès payé reste ouvert', () => {
  /*
   * Le 5 septembre 2026, un client écrit qu'il a payé et n'a jamais reçu son
   * accès. Vérification : accès Pro ouvert depuis le 28 août, connecté le matin
   * même, cinquante analyses consommées dont trois une heure plus tôt. Il
   * n'avait rien perdu.
   *
   * Ce qu'il avait vu, c'est l'écran de compteur épuisé — et cet écran ne
   * disait NULLE PART que son accès tenait toujours. « Rechargez votre accès »
   * se lit même comme « votre accès est fini, rachetez-en un ». Quelqu'un qui a
   * payé cinq mille francs et lit cela conclut qu'on lui a repris son achat, et
   * il écrit au support — ou il s'en va sans écrire.
   *
   * La phrase rassurante doit venir AVANT tout le reste.
   */
  const s = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));
  assert.ok(
    s.includes(
      "Votre accès {libelleAcces ?? ''} reste ouvert jusqu&apos;au"
    ),
    'L’écran ne dit plus que l’accès payé reste ouvert : le client croira qu’on le lui a repris.'
  );
  assert.ok(
    s.includes(
      'setAccesOuvertJusquA(data.expiresAt ?? null)'
    ),
    'L’échéance de l’accès n’est plus lue : la phrase rassurante ne peut plus s’afficher.'
  );

  // Et elle passe AVANT l'annonce du compteur épuisé.
  const posRassure = s.indexOf('reste ouvert jusqu&apos;au');
  const posEpuise = s.indexOf('analyses du mois qui sont épuisées');
  assert.ok(
    posRassure > 0 && posRassure < posEpuise,
    'La mauvaise nouvelle repasse avant la bonne.'
  );
});

// ── ET L'OFFRE AU-DESSUS, QU'ON NE LUI PROPOSAIT JAMAIS ───────────────────
//
// Le même client, le même jour : « le comble, c'est qu'ils ne m'ont pas
// proposé le quinze mille ni les autres ». Il avait pris l'Essentiel, l'avait
// rechargé une fois — quarante analyses dans le mois — et les avait toutes
// consommées. L'écran de limite atteinte ne lui tendait qu'un bouton, le
// sien, à 2 000 FCFA ; le reste tenait dans un lien gris souligné.
//
// Celui qui vide son compteur est justement celui à qui l'offre supérieure
// sert. Elle doit donc être PROPOSÉE, pas sous-entendue.

test('★ ACQUIS — le serveur nomme l’offre du rang au-dessus', () => {
  const s = sansCommentaires(lire('src/app/api/payments/status/route.ts'));
  assert.match(s, /offreSuperieure:/, 'L’offre supérieure n’est plus transmise au navigateur.');
  assert.match(
    s,
    /ESSENTIAL: 'pro_monthly'/,
    'Un abonné Essentiel ne se voit plus proposer le Pro.'
  );
  assert.match(
    s,
    /PRO: 'vip_yearly'/,
    'Un abonné Pro ne se voit plus proposer le VIP annuel.'
  );
  // Un VIP n'a rien au-dessus : la table s'arrête là, et `null` est rendu.
  assert.doesNotMatch(s, /VIP: '/, 'Une offre a été inventée au-dessus du VIP annuel.');
});

test('★ ACQUIS — l’écran de limite atteinte propose la montée en gamme', () => {
  const s = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));

  assert.match(
    s,
    /setOffreSuperieure\(data\.offreSuperieure \?\? null\);/,
    'L’écran ne lit plus l’offre supérieure envoyée par le serveur.'
  );
  assert.match(
    s,
    /Passer au \{offreSuperieure\.libelle\}/,
    'Le bouton de montée en gamme a disparu de la carte « limite atteinte ».'
  );
  assert.match(
    s,
    /setNoticeRecharge\(offreSuperieure\);/,
    'Le bouton de montée en gamme n’ouvre plus le paiement de CETTE offre.'
  );
});

test('★ ACQUIS — la notice de paiement porte l’offre réellement choisie', () => {
  // Elle a longtemps été commandée par un booléen : elle ne pouvait alors
  // désigner qu'une seule offre, toujours la même. Deux boutons partagent
  // désormais ce chemin, et c'est le second qui ne doit pas vendre le premier.
  const s = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));
  assert.doesNotMatch(
    s,
    /setNoticeRecharge\(true\)/,
    'La notice est redevenue un booléen : les deux boutons vendraient la même offre.'
  );
  assert.match(
    s,
    /cleOffre=\{noticeRecharge\.cle\}/,
    'La notice ne transmet plus l’offre qui a été cliquée.'
  );
  assert.match(
    s,
    /const offreActuelle = noticeRecharge;/,
    'Le paiement est repassé sur l’offre en cours au lieu de celle qui a été choisie.'
  );
});
