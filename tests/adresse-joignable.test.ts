import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adresseJoignable } from '../src/lib/livraison-sans-compte';

/**
 * ── UNE INVITATION ENVOYÉE DANS LE VIDE NE SERT À PERSONNE ────────────────
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 9 SEPTEMBRE 2026 ──────────────────────────────
 *
 * Un acheteur a payé DEUX FOIS — le 5 septembre à 19 h 10 et le 6 à 7 h 22,
 * deux mille francs chacune — et n'a jamais rien reçu. L'adresse portée sur la
 * vente était `babaoulare@4gmail.com` : un domaine qui n'existe pas, le `4`
 * étant un doigt qui a glissé juste au-dessus du `g`.
 *
 * Les deux invitations sont parties dans le vide. Aucune n'a rebondi vers
 * nous, aucune alerte ne s'est levée, et le client a attendu quatre jours avec
 * quatre mille francs de perdus.
 */
test("★ ACQUIS — un domaine cassé de façon certaine est corrigé", () => {
  // Le cas réel, qui a coûté 4 000 F.
  assert.equal(adresseJoignable('babaoulare@4gmail.com'), 'babaoulare@gmail.com');

  // Les autres déformations relevées sur des adresses de clients.
  assert.equal(adresseJoignable('a@gmial.com'), 'a@gmail.com');
  assert.equal(adresseJoignable('a@gmail.co'), 'a@gmail.com');
  assert.equal(adresseJoignable('a@gmail.con'), 'a@gmail.com');
  assert.equal(adresseJoignable('a@yaho.com'), 'a@yahoo.com');
  assert.equal(adresseJoignable('a@hotmial.com'), 'a@hotmail.com');

  // La casse du domaine ne doit pas empêcher la reconnaissance.
  assert.equal(adresseJoignable('a@4Gmail.COM'), 'a@gmail.com');
});

/**
 * ── ON NE DEVINE JAMAIS AU-DELÀ DU DOMAINE ───────────────────────────────
 *
 * Corriger la partie avant l'arobase reviendrait à envoyer l'invitation d'un
 * client à un autre : « jean.dupont » et « jeandupont » sont deux personnes
 * possibles, et l'accès suit l'invitation.
 */
test("★ ACQUIS — rien d'autre que le domaine n'est touché", () => {
  // Un domaine parfaitement valable reste intact, même rare.
  for (const a of [
    'client@gmail.com',
    'client@orange.ci',
    'client@yahoo.fr',
    'client@moov-africa.bj',
    'prenom.nom+profoot@societe.com',
  ]) {
    assert.equal(adresseJoignable(a), a, `${a} a été modifié alors qu'il est valable.`);
  }

  // La partie locale n'est jamais touchée, même quand elle ressemble à une faute.
  assert.equal(adresseJoignable('gmial@gmail.com'), 'gmial@gmail.com');
  assert.equal(adresseJoignable('jean.dupont@4gmail.com'), 'jean.dupont@gmail.com');

  // Un domaine inconnu n'est pas corrigé au jugé : mieux vaut une invitation
  // qui part à une adresse douteuse qu'une invitation détournée.
  assert.equal(adresseJoignable('client@gmaul.example'), 'client@gmaul.example');

  // Et ce qui n'est pas une adresse ressort tel quel, sans exception levée.
  assert.equal(adresseJoignable(''), '');
  assert.equal(adresseJoignable('sans-arobase'), 'sans-arobase');
  assert.equal(adresseJoignable('@gmail.com'), '@gmail.com');
});
