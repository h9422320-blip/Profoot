/**
 * ★ ACQUIS — LE CONTENU PAYANT NE S'OUVRE QUE CONTRE UN PAIEMENT.
 *
 * ── CE QUI S'EST PASSÉ LE 2 SEPTEMBRE 2026 ────────────────────────────────
 *
 * Une troisième porte a été ouverte dans `/api/analyze` : une analyse complète
 * offerte à tout compte gratuit, une fois. Elle a servi 336 fois en dix-neuf
 * heures.
 *
 * Le propriétaire l'a découverte le soir même en ouvrant l'application avec un
 * compte gratuit, et l'a fait retirer immédiatement.
 *
 * ── LA RÈGLE QUI EN SORT, ET ELLE NE SE DISCUTE PAS ───────────────────────
 *
 * Deux titres, et deux seulement, ouvrent l'analyse complète :
 *
 *     1. un abonnement en cours
 *     2. l'achat de cette rencontre à l'unité
 *
 * Toute autre idée d'ouverture — essai, démonstration, geste commercial,
 * « juste pour montrer la valeur » — est une DÉCISION COMMERCIALE. Elle
 * appartient au propriétaire, elle ne se prend pas dans un fichier de code, et
 * elle ne se déduit pas d'un raisonnement sur la conversion.
 *
 * Ces tests existent pour que la troisième porte ne se rouvre jamais toute
 * seule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const route = lire('src/app/api/analyze/route.ts');
const routeNue = sansCommentaires(route);

test('★ ACQUIS — une seule porte : l’abonnement', () => {
  // Il y en a eu trois. Deux ont été retirées le 2 septembre 2026, le même
  // soir, par le propriétaire : l'analyse offerte, et l'achat à l'unité à
  // 600 FCFA. Il ne reste que les trois abonnements — 2 000, 5 000, 15 000.
  assert.match(
    routeNue,
    /const aDroitAuComplet = guard\.entitlements\.premium;/,
    'Le droit à l’analyse complète a changé de forme : vérifier qu’aucune ouverture gratuite n’a été ajoutée.'
  );
  assert.doesNotMatch(routeNue, /matchDebloque/, 'L’achat à l’unité est revenu ouvrir l’analyse.');
});

test('★ ACQUIS — aucune trace d’essai offert ne subsiste', () => {
  assert.doesNotMatch(routeNue, /essaiOffert/, 'L’essai offert est revenu dans la route d’analyse.');
  assert.doesNotMatch(routeNue, /essai\.accorde/, 'Une variable d’essai est de nouveau consultée.');
  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'src/lib/essai-offert.ts')),
    false,
    'Le module d’essai offert a été recréé.'
  );
});

test('★ ACQUIS — l’écran n’annonce plus d’analyse offerte', () => {
  const ecran = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));
  assert.doesNotMatch(ecran, /essaiOffert/, 'Le bandeau « analyse offerte » est revenu.');
  assert.doesNotMatch(ecran, /offerte/i, 'Un texte annonce de nouveau quelque chose d’offert.');
});

test('★ ACQUIS — le flou reste piloté par le serveur', () => {
  // Ce point-là n'est PAS revenu en arrière, et c'est voulu. Le flou suivait
  // « cette personne est-elle abonnée ? » ; il suit maintenant « le serveur
  // a-t-il envoyé l'aperçu ? ». Sans cela, qui achète un match à l'unité
  // recevait l'analyse entière, floutée, avec un mur de paiement par-dessus.
  //
  // Un compte gratuit reçoit toujours le teaser, donc `locked` est vrai, donc
  // le flou s'applique : cette correction n'ouvre rien à personne.
  const ecran = lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx');
  assert.match(
    ecran,
    /\$\{result\.locked \? 'pointer-events-none select-none blur-\[16px\]/,
    'Le flou ne suit plus la décision du serveur.'
  );
  assert.match(ecran, /\{result\.locked && \(/, 'Le mur de paiement ne suit plus la décision du serveur.');
});
