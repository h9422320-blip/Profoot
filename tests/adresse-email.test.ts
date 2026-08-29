/**
 * ★ ACQUIS — L'ADRESSE SAISIE EST LA SEULE CLÉ DU COMPTE.
 *
 * ── CE QUE SON ABSENCE DE CONTRÔLE A COÛTÉ ────────────────────────────────
 *
 * Relevé le 29 août 2026 sur les 5 932 comptes : QUINZE personnes payantes se
 * retrouvaient devant le mur de paiement. Aucune n'avait perdu son argent —
 * leur abonnement était actif, sur une adresse voisine d'une lettre. Et
 * quarante adresses structurellement impossibles avaient été acceptées.
 *
 * Deux d'entre elles ont écrit. L'une : « Vous êtes malade ou quoi, j'ai un
 * abonnement de 15 000 pour une année et je n'ai pas accès. » Son abonnement
 * VIP courait bien jusqu'en 2027 — sur `tkekoye5@gmail.com`, pendant qu'elle
 * regardait `tkekoye@gmail.com`.
 *
 * La confirmation d'e-mail est désactivée sur ce projet : rien, nulle part, ne
 * rattrape la faute de frappe. Elle ne se voit qu'un mois plus tard, quand
 * l'argent est parti.
 *
 * Les adresses ci-dessous ne sont pas inventées : elles ont toutes été lues
 * dans la base.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { verifierAdresse, normaliserAdresse } from '../src/lib/adresse-email';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

test('★ ACQUIS — les adresses impossibles relevées en base sont refusées', () => {
  // Toutes acceptées à l'inscription avant ce contrôle. Aucune ne peut
  // recevoir de message : ni reçu, ni lien de récupération de mot de passe.
  const impossibles = [
    'ibrahimadiallodembele@gamil',
    'dab@ire',
    'laminou250@gaimlcom',
    'avognongeoffred@gmail',
    'darrasesrom@icloud',
    'laminouhoumadou@gmilcom',
    'rolfngoma@com',
    'amadoucamara123@com',
    'amanichantal172@gmail',
    'djibri@djibril',
    'jay@381',
    'damsdesign07@gmail',
    'armandtuo15@gm',
  ];
  for (const a of impossibles) {
    assert.equal(verifierAdresse(a).ok, false, `${a} est de nouveau acceptée.`);
  }
});

test('★ ACQUIS — les fautes de frappe qui ont bloqué des clients payants sont refusées', () => {
  // Chacune correspond à un cas réel où la personne payait sur l'adresse
  // voisine et se voyait proposer de payer une seconde fois.
  for (const a of [
    'kmkaime01@gmai.co',
    'damsdesign07@gamil.com',
    'eshibachristophe@gmail.com.com',
    'quelquun@gmial.com',
    'quelquun@gmail.con',
    'quelquun@hotmial.com',
  ]) {
    const v = verifierAdresse(a);
    assert.equal(v.ok, false, `${a} est de nouveau acceptée.`);
    assert.ok(v.message && v.message.length > 10, `${a} est refusée sans explication.`);
  }
});

test('★ ACQUIS — le refus dit QUOI corriger', () => {
  // Un refus sec fait abandonner l'inscription : la personne ne voit pas ce
  // qui cloche dans une adresse qu'elle relit pour la troisième fois.
  const v = verifierAdresse('kmkaime01@gmai.com');
  assert.equal(v.ok, false);
  assert.match(v.message ?? '', /gmail\.com/, 'Le message ne propose pas la correction.');
  assert.match(v.message ?? '', /kmkaime01/, 'Le message ne reprend pas l’adresse saisie.');
});

test('★ ACQUIS — aucune adresse valide n’est refusée', () => {
  // Le risque inverse est pire que le mal soigné : refuser une adresse
  // valide parce qu'elle est inhabituelle fait perdre un client pour de bon.
  // Ces formes viennent toutes de vrais comptes de la base.
  for (const a of [
    'tkekoye5@gmail.com',
    'yao.prince@icloud.com',
    'whodragosanata12@icloud.com',
    'lassanacamara428@yahoo.com',
    'kouadiorodolphekouakou50@gmail.com',
    'm09997818@gmail.com',
    'prenom.nom+profoot@ma-societe.co.uk',
    'contact@profootai.com',
    'a@b.ci',
  ]) {
    assert.equal(verifierAdresse(a).ok, true, `${a} est refusée à tort.`);
  }
});

test('★ ACQUIS — deux adresses qui ne diffèrent que par la casse sont le même compte', () => {
  assert.equal(normaliserAdresse('  Traoreismaela753@Gmail.com '), 'traoreismaela753@gmail.com');
});

test('★ ACQUIS — le contrôle vit dans l’action serveur, pas seulement dans le formulaire', () => {
  // Le formulaire se contourne ; l'action serveur est le seul passage
  // obligé. C'est la même règle que pour les actions d'administration.
  const actions = lire('src/app/login/actions.ts');
  assert.match(actions, /verifierAdresse\(email\)/, 'L’inscription ne vérifie plus l’adresse.');
  assert.match(
    actions,
    /export async function signup[\s\S]{0,1200}verifierAdresse/,
    'La vérification n’est plus sur le chemin d’inscription.'
  );
});

test('★ ACQUIS — la connexion, elle, ne rejette personne', () => {
  // Les comptes déjà créés avec une adresse fautive existent : leur fermer la
  // porte les enfermerait dehors avec leur abonnement à l'intérieur.
  const actions = lire('src/app/login/actions.ts');
  const connexion = actions.slice(
    actions.indexOf('export async function login'),
    actions.indexOf('export async function signup')
  );
  assert.doesNotMatch(connexion, /verifierAdresse/, 'La connexion refuse des comptes existants.');
});
