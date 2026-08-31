/**
 * ★ ACQUIS — L'OFFRE CHOISIE SURVIT À L'INSCRIPTION.
 *
 * ── LA DÉCISION QU'ON FAISAIT REPRENDRE DEUX FOIS ─────────────────────────
 *
 * Quelqu'un qui cliquait « Choisir l'Essentiel — 2 000 FCFA » sans compte était
 * envoyé vers l'inscription, puis ramené sur la page des tarifs NUE. Il devait
 * re-choisir son offre : reprendre la même décision une seconde fois, au moment
 * précis où il sortait son argent. Chaque décision reprise est une occasion de
 * renoncer.
 *
 * Le commentaire du code promettait pourtant déjà que « le renvoi porte l'offre
 * choisie ». Il décrivait une intention que le code n'appliquait pas.
 *
 * ── ET IL NE SAVAIT PAS POURQUOI IL ÉTAIT LÀ ──────────────────────────────
 *
 * La page d'inscription affichait « Créer un compte », sans un mot sur l'offre
 * ni sur son prix. Certains croient s'être trompés de bouton.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TARIFS = 'src/app/(dashboard)/pricing/PricingClient.tsx';
const INSCRIPTION = 'src/app/signup/page.tsx';
const ACTIONS = 'src/app/login/actions.ts';

test('★ ACQUIS — l’offre voyage jusqu’à l’inscription', () => {
  const s = sansCommentaires(lire(TARIFS));
  assert.match(s, /\/signup\?suite=\/pricing&offre=\$\{encodeURIComponent\(selectedPlan\)\}/,
    'La page des tarifs n’emporte plus l’offre choisie.');

  const g = sansCommentaires(lire(INSCRIPTION));
  assert.match(g, /name="offre"/, 'Le formulaire ne transporte plus l’offre.');
});

test('★ ACQUIS — l’offre ne passe JAMAIS par « suite »', () => {
  // `suite` n'accepte qu'un chemin sans point d'interrogation, et c'est
  // exactement cette contrainte qui empêche un lien truqué d'expédier
  // quelqu'un vers un site tiers juste après la saisie de son mot de passe.
  // L'élargir pour y glisser l'offre rouvrirait cette porte.
  const a = sansCommentaires(lire(ACTIONS));
  assert.ok(
    a.includes('/^\\/[a-z0-9/_-]{0,60}$/i.test(suite)'),
    'Le contrôle de « suite » a été élargi : la redirection ouverte redevient possible.'
  );
  assert.match(a, /const offre = propre\(formData\.get\('offre'\)\)/, 'L’offre n’est plus revalidée côté serveur.');
  assert.match(a, /offre && suite === '\/pricing'/, 'L’offre est recollée à n’importe quelle destination.');
});

test('★ ACQUIS — une offre inventée n’affiche rien et n’ouvre rien', () => {
  // L'offre arrive de l'adresse, donc de l'extérieur. Afficher un prix venu de
  // l'URL laisserait n'importe qui fabriquer un lien annonçant « Essentiel —
  // 200 FCFA ».
  const g = sansCommentaires(lire(INSCRIPTION));
  assert.match(g, /LIBELLE_OFFRE\[offre\] &&/, 'Un nom d’offre inconnu serait affiché tel quel.');
  assert.doesNotMatch(g, /LIBELLE_OFFRE[\s\S]{0,200}FCFA/, 'Un prix venu de l’adresse serait affiché.');

  const s = sansCommentaires(lire(TARIFS));
  assert.match(
    s,
    /OFFRES as readonly \{ cle: PlanKey \}\[\]\)\.some\(\(o\) => o\.cle === demandee\)/,
    'La page des tarifs ouvre le paiement sur une offre non vérifiée.'
  );
});
