import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerFidelisation } from '../src/lib/fidelisation';

/**
 * ★ ACQUIS — LA FIDÉLISATION SE MESURE SUR UN DÉNOMINATEUR HONNÊTE.
 *
 * ── LE PIÈGE QUE CES ÉPREUVES FERMENT ─────────────────────────────────────
 *
 * Le 24 août 2026, le taux de rachat brut valait 6 %. Lu seul, il donnait à
 * croire que le produit ne retenait personne. Il ne mesurait en réalité que
 * l'âge de la boutique : dix-sept jours, aucun abonnement mensuel arrivé à
 * terme, et treize des quatorze paiements répétés qui étaient des montées en
 * gamme, pas des renouvellements.
 *
 * La comparaison qui se répond vraiment était ailleurs : 16 % de rachat chez
 * ceux qui avaient épuisé leurs vingt analyses, 1 % chez ceux à qui il en
 * restait. Tomber à sec multipliait par seize la chance de repayer.
 *
 * Ces épreuves protègent quatre choses : que le quota serve de séparateur,
 * que les abonnés Pro et VIP ne viennent pas gonfler le résultat, que
 * l'avertissement sur l'âge de la boutique s'affiche tant qu'il le faut, et
 * qu'il s'efface une fois le premier terme passé.
 */

const JOUR = 86_400_000;
const T0 = Date.parse('2026-08-07T10:00:00.000Z');
const MAINTENANT = T0 + 17 * JOUR;

const quand = (jours: number) => new Date(T0 + jours * JOUR).toISOString();

const abo = (user_id: string, plan: string, jours: number, amount = 2000) => ({
  user_id,
  plan,
  amount,
  created_at: quand(jours),
});

/** `n` analyses consommées par ce compte, une par heure. */
const analyses = (user_id: string, n: number, depuis: number) =>
  Array.from({ length: n }, (_, i) => ({
    user_id,
    created_at: new Date(T0 + depuis * JOUR + i * 3_600_000).toISOString(),
  }));

test('★ ACQUIS — le quota sépare ceux qui sont à sec de ceux qui ont du crédit', () => {
  const b = calculerFidelisation(
    [
      // À sec, a repayé.
      abo('sec-repaye', 'essential_monthly', 0),
      abo('sec-repaye', 'pro_monthly', 2, 5000),
      // À sec, n'a pas repayé.
      abo('sec-parti', 'essential_monthly', 0),
      // Il lui reste du crédit, n'a pas repayé.
      abo('credit-reste', 'essential_monthly', 0),
    ],
    [
      ...analyses('sec-repaye', 20, 0),
      ...analyses('sec-parti', 25, 0),
      ...analyses('credit-reste', 4, 0),
    ],
    MAINTENANT
  );

  assert.equal(b.aSec.total, 2, 'Deux abonnés ont atteint les vingt analyses.');
  assert.equal(b.aSec.ontRepaye, 1);
  assert.equal(b.aSec.taux, 50);

  assert.equal(b.encoreDuCredit.total, 1, 'Un seul abonné a encore du crédit.');
  assert.equal(b.encoreDuCredit.ontRepaye, 0);
  assert.equal(b.encoreDuCredit.taux, 0);
});

test('★ ACQUIS — les abonnés Pro et VIP ne gonflent pas le résultat', () => {
  const b = calculerFidelisation(
    [
      abo('essentiel', 'essential_monthly', 0),
      // Entrés directement par une offre large : leur quota ne s'épuise pas en
      // quelques jours, les compter fausserait la comparaison.
      abo('pro', 'pro_monthly', 0, 5000),
      abo('vip', 'vip_yearly', 0, 15000),
    ],
    [...analyses('essentiel', 20, 0), ...analyses('pro', 40, 0), ...analyses('vip', 90, 0)],
    MAINTENANT
  );

  assert.equal(
    b.aSec.total + b.encoreDuCredit.total,
    1,
    'Seuls les abonnés entrés par l’offre Essentiel entrent dans la comparaison. ' +
      'Un abonné Pro a cinquante analyses et un VIP n’a pas de limite : les mélanger ' +
      'ferait paraître la rétention meilleure qu’elle n’est.'
  );
});

test('★ ACQUIS — tant qu’aucun abonnement n’a expiré, le panneau le dit', () => {
  const b = calculerFidelisation(
    [abo('a', 'essential_monthly', 0), abo('b', 'essential_monthly', 3)],
    analyses('a', 5, 0),
    MAINTENANT
  );

  assert.equal(
    b.tropJeunePourJuger,
    true,
    'Dix-sept jours après la première vente, aucun abonnement de trente jours n’a pu ' +
      'arriver à terme : le taux brut ne mesure que l’âge de la boutique.'
  );
  assert.equal(
    String(b.premierRenouvellementPossible).slice(0, 10),
    '2026-09-06',
    'La date d’échéance annoncée doit être celle du premier abonnement plus trente jours.'
  );
  assert.equal(b.ageBoutiqueJours, 17);
});

test('★ ACQUIS — passé le premier terme, l’avertissement s’efface', () => {
  const b = calculerFidelisation(
    [abo('a', 'essential_monthly', 0)],
    analyses('a', 5, 0),
    T0 + 45 * JOUR
  );

  assert.equal(
    b.tropJeunePourJuger,
    false,
    'Quarante-cinq jours après la première vente, le premier abonnement a expiré : ' +
      'le taux de rachat brut redevient lisible et l’avertissement doit disparaître.'
  );
});

test('★ ACQUIS — un client qui n’a jamais payé deux fois n’est jamais compté comme revenu', () => {
  const b = calculerFidelisation(
    [abo('seul', 'essential_monthly', 0)],
    analyses('seul', 30, 0),
    MAINTENANT
  );

  assert.equal(b.acheteurs, 1);
  assert.equal(b.ontPayePlusieursFois, 0);
  assert.equal(b.tauxBrut, 0);
  assert.equal(b.aSec.ontRepaye, 0);
});

test('★ ACQUIS — la vingtième analyse est datée dans l’ordre, pas dans celui de la base', () => {
  // Les lignes arrivent en désordre : Supabase rend ses paquets triés chacun de
  // son côté, et la concaténation ne l’est plus. Sans le retri, la « vingtième
  // analyse » serait prise au hasard et la durée du crédit deviendrait fausse.
  const desordre = [
    ...analyses('a', 10, 5), // les plus récentes d'abord
    ...analyses('a', 10, 0), // puis les plus anciennes
  ];

  const b = calculerFidelisation([abo('a', 'essential_monthly', 0)], desordre, MAINTENANT);

  assert.equal(b.aSec.total, 1, 'Vingt analyses ont bien été consommées.');
  assert.ok(
    b.dureeQuotaJours !== null && b.dureeQuotaJours.moyenne >= 5,
    `Durée calculée : ${b.dureeQuotaJours?.moyenne} j. La première analyse date du jour 0 et ` +
      `la vingtième du jour 5 : une durée plus courte signifie que l’ordre n’a pas été rétabli.`
  );
});
