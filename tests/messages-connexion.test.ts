import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { messageAuth } from '../src/lib/messages-auth';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * LE SEUL MESSAGE QUI DÉCIDE SI QUELQU'UN ENTRE NE DOIT PAS ÊTRE EN ANGLAIS.
 *
 * Le 23 août 2026, la mesure maison a enregistré ce passage depuis le Bénin :
 *
 *     /login (13 s) → /mot-de-passe-oublie (4 s) → /login (3 s)
 *     → /mot-de-passe-oublie (12 s) → /login (3 s) → / (3 s)
 *
 * Soixante-sept secondes, trois allers-retours, jamais entré. L'application
 * renvoyait « Invalid login credentials » — l'anglais brut de Supabase — sur un
 * produit entièrement en français destiné à l'Afrique de l'Ouest.
 */
test('★ ACQUIS — aucun message d authentification ne part en anglais', () => {
  const actions = lire('src/app/login/actions.ts');

  assert.ok(
    !/return \{ error: error\.message \}/.test(actions),
    "Le message brut de Supabase est de nouveau renvoyé tel quel. Il est en " +
      "anglais, et il ne dit pas qu'on peut simplement ne pas avoir de compte."
  );

  assert.ok(
    /messageAuth\(error\.message\)/.test(actions),
    '`messageAuth` n\'est plus appelée : la traduction est court-circuitée.'
  );
});

test('★ ACQUIS — « identifiants invalides » propose de créer un compte', () => {
  const m = messageAuth('Invalid login credentials');

  assert.ok(
    !/invalid|credentials/i.test(m.texte),
    `Le message contient encore de l'anglais : « ${m.texte} »`
  );

  // Le point qui brise la boucle : nommer la deuxième possibilité.
  assert.ok(
    /compte/i.test(m.texte),
    "Le message ne mentionne pas la possibilité de ne pas avoir de compte. " +
      "C'est précisément ce qui manquait : la personne demande un nouveau mot de " +
      "passe pour une adresse qui n'en a pas, attend un courriel qui n'arrivera " +
      "jamais, et repart."
  );

  const href = (m.liens ?? []).map((l) => l.href);

  assert.ok(
    href.includes('/signup'),
    "Aucune porte de sortie vers l'inscription. Sans lien, la personne relit le " +
      'même message et recommence.'
  );

  // ── LA DEUXIÈME SORTIE, AJOUTÉE LE 29 AOÛT 2026 ─────────────────────────
  //
  // Depuis ce soir, l'application crée le compte de celui qui a payé sans en
  // avoir un. Cette personne possède donc un compte dont elle n'a JAMAIS choisi
  // le mot de passe — et les deux écrans se renvoyaient l'un à l'autre :
  //
  //   Connexion   → « sinon, CRÉEZ UN COMPTE »
  //   Inscription → « ce compte existe déjà, CONNECTEZ-VOUS »
  //   Connexion   → …
  //
  // Un client a filmé son téléphone tournant dans cette boucle. Il avait payé,
  // son abonnement était actif, et rien ne lui proposait la seule action qui
  // l'aurait fait entrer.
  assert.ok(
    href.includes('/mot-de-passe-oublie'),
    "Aucune sortie vers le choix du mot de passe. C'est la seule issue pour " +
      "quelqu'un dont nous avons créé le compte après son paiement : il ne " +
      'connaîtra jamais un mot de passe qu\'il n\'a pas choisi.'
  );
});

test('★ ACQUIS — « ce compte existe déjà » ne renvoie pas seulement vers la connexion', () => {
  // L'autre moitié de la boucle. Renvoyer vers la connexion quelqu'un qui n'a
  // pas de mot de passe, c'est le renvoyer d'où il vient.
  const m = messageAuth('User already registered');
  const href = (m.liens ?? []).map((l) => l.href);
  assert.ok(
    href.includes('/mot-de-passe-oublie'),
    'La boucle est rouverte : l’inscription renvoie vers la connexion, qui renvoie ' +
      'vers l’inscription.'
  );
});

test('★ ACQUIS — un message inconnu reste en français', () => {
  const m = messageAuth('Some brand new Supabase error nobody has seen yet');
  assert.ok(
    !/brand new|error nobody/i.test(m.texte),
    "Un message non prévu repart en anglais vers l'utilisateur. Le repli doit " +
      'rester français, quoi que Supabase renvoie.'
  );
});

test('★ ACQUIS — la page de récupération dit qu on peut ne pas avoir de compte', () => {
  const page = lire('src/app/mot-de-passe-oublie/page.tsx');

  // L'écran de confirmation s'affiche même sans compte — c'est volontaire, pour
  // ne pas révéler quelles adresses en ont un. Mais alors rien n'arrive, et
  // rien ne le laissait deviner.
  assert.ok(
    /aucun compte n&apos;existe|aucun compte n'existe/.test(page),
    "L'écran « Vérifiez votre boîte mail » ne mentionne plus qu'aucun compte " +
      "n'existe peut-être. C'est la moitié manquante : sans elle, on attend " +
      'indéfiniment un courriel qui ne partira jamais.'
  );

  assert.ok(
    /href="\/signup"/.test(page),
    'Le lien vers la création de compte a disparu de cet écran.'
  );
});
