/**
 * ★ ACQUIS — L'ADRESSE TAPÉE AU PAIEMENT N'EST PAS TOUJOURS LA BONNE.
 *
 * ── CE QUI EST ARRIVÉ À AMON, LE 29 AOÛT 2026 ─────────────────────────────
 *
 *   18 h 34  il crée son compte : essanamon231@gmail.com
 *   18 h 46  il paie 2 000 F — en tapant essanon231@gmail.com
 *   19 h 02  il revient se connecter sur son vrai compte : rien
 *   19 h 28  un avis d'une étoile arrive
 *
 * L'adresse qu'il avait tapée n'existe pas : Gmail répond « 550 5.1.1 Address
 * not found ». Ni le message de l'application ni celui du fondateur n'ont pu
 * lui parvenir, et son accès l'attendait sur un compte dont il ne recevrait
 * jamais le mot de passe.
 *
 * Retaper son adresse dans le formulaire de la boutique est le seul endroit du
 * parcours où le client peut se tromper sans que rien ne le lui dise. Deux
 * acheteurs sur quatre s'y sont trompés le même soir.
 *
 * ── CE QUE CES ASSERTIONS PROTÈGENT ───────────────────────────────────────
 *
 * Le risque n'est pas de rater une jumelle : c'est d'en inventer une. Ouvrir
 * un accès payé sur le compte de quelqu'un d'autre serait pire que le problème
 * qu'on répare.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { distance, jumelleProbable, type CompteConnu } from '../src/lib/adresses-jumelles';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const compte = (email: string, extra: Partial<CompteConnu> = {}): CompteConnu => ({
  email,
  id: 'id-' + email,
  aUnAccesActif: false,
  creeLe: '2026-08-01T00:00:00Z',
  ...extra,
});

test('★ ACQUIS — le cas réel d’AMON est reconnu', () => {
  const trouve = jumelleProbable('essanon231@gmail.com', [
    compte('essanamon231@gmail.com'),
    compte('kouadioromaricyao453@gmail.com'),
    compte('bankolelouis6@gmail.com'),
  ]);
  assert.equal(trouve?.email, 'essanamon231@gmail.com');
});

test('★ ACQUIS — le cas réel de Saliou est reconnu', () => {
  // mbayesaliou2024 payé, mbayesaliou2004 en compte : un chiffre d'écart.
  const trouve = jumelleProbable('mbayesaliou2024@icloud.com', [
    compte('mbayesaliou2004@icloud.com'),
  ]);
  assert.equal(trouve?.email, 'mbayesaliou2004@icloud.com');
});

test('★ ACQUIS — jamais de jumelle sur un autre domaine', () => {
  // Un @gmail et un @icloud n'appartiennent pas au même doigt qui glisse.
  assert.equal(jumelleProbable('essanamon231@gmail.com', [compte('essanamon231@icloud.com')]), null);
});

test('★ ACQUIS — jamais de jumelle quand deux comptes sont aussi proches', () => {
  // Deux candidates également plausibles, et l'on ne sait pas laquelle est la
  // bonne. Donner l'accès à l'une des deux au hasard serait le retirer à
  // l'autre.
  const trouve = jumelleProbable('souleymane12@gmail.com', [
    compte('souleymane13@gmail.com'),
    compte('souleymane14@gmail.com'),
  ]);
  assert.equal(trouve, null);
});

test('★ ACQUIS — jamais de jumelle qui possède déjà un accès payé', () => {
  // Deux personnes différentes, pas une faute de frappe.
  const trouve = jumelleProbable('mbayesaliou2024@icloud.com', [
    compte('mbayesaliou2004@icloud.com', { aUnAccesActif: true }),
  ]);
  assert.equal(trouve, null);
});

test('★ ACQUIS — jamais de jumelle créée après la vente', () => {
  // Un compte ouvert après le paiement n'est pas celui de l'acheteur d'alors :
  // c'est un homonyme arrivé depuis.
  const trouve = jumelleProbable(
    'essanon231@gmail.com',
    [compte('essanamon231@gmail.com', { creeLe: '2026-08-30T10:00:00Z' })],
    '2026-08-29T18:46:00Z'
  );
  assert.equal(trouve, null);
});

test('★ ACQUIS — rien à deviner quand l’adresse payée existe déjà', () => {
  const trouve = jumelleProbable('essanamon231@gmail.com', [
    compte('essanamon231@gmail.com'),
    compte('essanon231@gmail.com'),
  ]);
  assert.equal(trouve, null);
});

test('★ ACQUIS — les adresses courtes ne se comparent pas', () => {
  // Sur « ali@ » et « ela@ », deux caractères d'écart ne veulent plus rien
  // dire : ce sont deux personnes.
  assert.equal(jumelleProbable('ali@gmail.com', [compte('ela@gmail.com')]), null);
});

test('★ ACQUIS — trois caractères d’écart, ce n’est plus une faute de frappe', () => {
  assert.equal(jumelleProbable('souleymane2024@gmail.com', [compte('souleymane1999@gmail.com')]), null);
});

test('★ ACQUIS — la distance s’arrête au plafond', () => {
  // Sans arrêt anticipé, chaque livraison comparerait l'adresse payée à six
  // mille comptes, en entier.
  assert.equal(distance('abc', 'abc'), 0);
  assert.equal(distance('abcdef', 'abcdefgh'), 2);
  assert.ok(distance('abcdef', 'zzzzzzzzzz') > 2);
  const s = sansCommentaires(lire('src/lib/adresses-jumelles.ts'));
  assert.match(s, /if \(minimum > plafond\) return plafond \+ 1;/, 'L’arrêt anticipé a sauté.');
});

test('★ ACQUIS — la livraison pose l’accès sur la jumelle, pas sur l’adresse fautive', () => {
  const s = sansCommentaires(lire('src/lib/livraison-sans-compte.ts'));
  assert.match(s, /jumelleProbable\(email, comptesConnus/, 'La livraison ne cherche plus la jumelle.');
  assert.match(s, /a: adressePrevenue/, 'Le message repart vers l’adresse fautive.');
  assert.match(
    s,
    /generateLink\(\{[\s\S]{0,80}email: adressePrevenue/,
    'Le lien de mot de passe est généré pour la mauvaise adresse.'
  );
});

test('★ ACQUIS — déplacer un accès ne se fait jamais à l’aveugle', () => {
  // Une tâche qui se tromperait de compte donnerait un abonnement payé à un
  // inconnu ET le retirerait à celui qui l'a payé : deux fautes d'un coup pour
  // réparer une faute de frappe.
  const s = sansCommentaires(lire('src/lib/rattacher-vente.ts'));
  assert.match(s, /encoreValide/, 'Un compte qui a déjà un accès pourrait en recevoir un second.');
  assert.match(s, /last_sign_in_at/, 'On retirerait son accès à un compte déjà utilisé.');
  assert.match(s, /abos\.length > 1/, 'Une vente portée par plusieurs abonnements passerait.');
  assert.doesNotMatch(s, /deleteUser|\.delete\(\)/, 'Le rattachement supprime désormais des données.');
});
