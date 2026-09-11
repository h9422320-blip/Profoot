import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { adresseJoignable, adressesCandidates } from '../src/lib/livraison-sans-compte';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * ── UNE INVITATION ENVOYÉE DANS LE VIDE NE SERT À PERSONNE ────────────────
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 9 SEPTEMBRE 2026 ──────────────────────────────
 *
 * Un acheteur a payé DEUX FOIS — le 5 septembre à 19 h 10 et le 6 à 7 h 22,
 * deux mille francs chacune — et n'a jamais rien reçu. L'adresse portée sur la
 * vente était `babaoulare@4gmail.com`, un domaine qui n'existe pas. Les deux
 * invitations sont parties dans le vide.
 */
test("★ ACQUIS — un domaine cassé de façon certaine est corrigé", () => {
  // Les déformations relevées sur des adresses de clients.
  assert.equal(adresseJoignable('a@gmial.com'), 'a@gmail.com');
  assert.equal(adresseJoignable('a@gmail.co'), 'a@gmail.com');
  assert.equal(adresseJoignable('a@gmail.con'), 'a@gmail.com');
  assert.equal(adresseJoignable('a@yaho.com'), 'a@yahoo.com');
  assert.equal(adresseJoignable('a@hotmial.com'), 'a@hotmail.com');
  // La casse du domaine ne doit pas empêcher la reconnaissance.
  assert.equal(adresseJoignable('a@GMIAL.COM'), 'a@gmail.com');
});

/**
 * ── LE CHIFFRE COLLÉ AU DOMAINE APPARTIENT AU NOM ────────────────────────
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 11 SEPTEMBRE 2026 ─────────────────────────────
 *
 * La première version de cette garantie exigeait `babaoulare@gmail.com` : le
 * « 4 » y était lu comme un doigt qui glisse. C'était faux. Son vrai compte
 * était `babaoulare4@gmail.com`, créé le soir de son premier paiement —
 * l'arobase tapée un caractère trop tôt. Un compte avait été créé à
 * l'adresse corrigée, où il n'entrerait jamais, pendant qu'il essayait
 * d'entrer avec trois comptes à son vrai nom.
 *
 * Le chiffre n'est pas deviné : il est remis là où il a été tapé.
 */
test("★ ACQUIS — le chiffre collé au domaine est remis dans le nom", () => {
  assert.equal(adresseJoignable('babaoulare@4gmail.com'), 'babaoulare4@gmail.com');
  assert.equal(adresseJoignable('a@4Gmail.COM'), 'a4@gmail.com');
  assert.equal(adresseJoignable('jean.dupont@6gmail.com'), 'jean.dupont6@gmail.com');
  assert.notEqual(
    adresseJoignable('babaoulare@4gmail.com'),
    'babaoulare@gmail.com',
    'Le chiffre est de nouveau jeté : l’accès repartirait vers l’adresse de quelqu’un d’autre.'
  );
});

/**
 * ── ON NE DEVINE JAMAIS AU-DELÀ ──────────────────────────────────────────
 *
 * Rien n'est inventé dans la partie avant l'arobase : « jean.dupont » et
 * « jeandupont » sont deux personnes possibles, et l'accès suit l'invitation.
 */
test("★ ACQUIS — rien d'autre n'est touché", () => {
  for (const a of [
    'client@gmail.com',
    'client@orange.ci',
    'client@yahoo.fr',
    'client@moov-africa.bj',
    'prenom.nom+profoot@societe.com',
    'client4@gmail.com',
  ]) {
    assert.equal(adresseJoignable(a), a, `${a} a été modifié alors qu'il est valable.`);
  }
  // La partie locale n'est jamais corrigée, même quand elle ressemble à une faute.
  assert.equal(adresseJoignable('gmial@gmail.com'), 'gmial@gmail.com');
  // Un domaine inconnu n'est pas corrigé au jugé.
  assert.equal(adresseJoignable('client@gmaul.example'), 'client@gmaul.example');
  // Et ce qui n'est pas une adresse ressort tel quel, sans exception levée.
  assert.equal(adresseJoignable(''), '');
  assert.equal(adresseJoignable('sans-arobase'), 'sans-arobase');
  assert.equal(adresseJoignable('@gmail.com'), '@gmail.com');
});

/**
 * ── UN COMPTE RÉEL EST LA PREUVE DE LA BONNE LECTURE ─────────────────────
 *
 * Une adresse de vente peut se lire de plusieurs façons. La livraison les
 * essaie toutes contre les comptes EXISTANTS avant de conclure qu'il n'y en
 * a pas : babaoulare avait un compte à `babaoulare4@gmail.com` au moment de
 * son second paiement, et il aurait été servi dans la seconde.
 */
test("★ ACQUIS — la livraison essaie toutes les lectures de l’adresse", () => {
  assert.deepEqual(adressesCandidates('babaoulare@4gmail.com'), [
    'babaoulare@4gmail.com',
    'babaoulare4@gmail.com',
    'babaoulare@gmail.com',
  ]);
  assert.deepEqual(adressesCandidates('Client@Gmail.com'), ['client@gmail.com']);
  assert.deepEqual(adressesCandidates('a@gmial.com'), ['a@gmial.com', 'a@gmail.com']);
  assert.deepEqual(adressesCandidates(''), []);

  const s = sansCommentaires(fs.readFileSync('src/lib/livraison-sans-compte.ts', 'utf8'));
  assert.match(s, /adressesCandidates\(email\)/, 'La livraison ne cherche plus de compte sous les autres lectures.');
});

/**
 * ── UN MESSAGE EN DOUBLE NE CRIE PAS AU LOUP ─────────────────────────────
 *
 * Le 11 septembre 2026, MakeTou a envoyé la même vente deux fois. Le second
 * message, qui n'avait rien à faire, a fini le premier et envoyé « une vente
 * n'a PAS ouvert d'accès » pour un client servi depuis la première minute.
 */
test('★ ACQUIS — une vente servie par son jumeau ne déclenche aucune alerte', () => {
  const s = sansCommentaires(fs.readFileSync('src/app/api/maketou/pulse/route.ts', 'utf8'));
  assert.match(s, /venteServieEntreTemps\(/, 'Le pulse ne revérifie plus la vente avant d’alerter.');
  assert.match(s, /!ignoree && !repetee && !servieEntreTemps/, 'L’alerte part même quand la vente a été servie entre-temps.');
  assert.match(s, /chariow_sale_id', idVente/, 'La revérification ne regarde plus l’abonnement porté par la vente.');
});
