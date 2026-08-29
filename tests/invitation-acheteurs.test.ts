/**
 * ★ ACQUIS — CELUI QUI A PAYÉ SANS COMPTE NE DOIT PAS ATTENDRE EN SILENCE.
 *
 * ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────────
 *
 * Le 28 août 2026 à 12 h 43, quelqu'un paie 2 000 FCFA sur la vitrine publique
 * de la boutique. Il n'a pas de compte ProFoot : son accès est réservé et
 * s'ouvrira à l'inscription — mais rien ne le lui dit. Le lendemain matin, le
 * seul courrier qu'il a reçu est celui de la boutique lui demandant « Comment
 * s'est passé votre achat ? ». Il répond : « Je comprends rien d'abord. »
 *
 * ── LES DEUX FAÇONS DONT CE RATTRAPAGE PEUT NUIRE ─────────────────────────
 *
 *   1. écrire plusieurs fois à la même personne — trois « créez votre compte »
 *      font fuir plus sûrement que le silence ;
 *   2. écrire à quelqu'un qui a DÉJÀ un compte — le pire des courriels, celui
 *      qui fait douter de ce qu'on a sous les yeux.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MODULE = 'src/lib/invitation-acheteurs.ts';
const ENTRETIEN = 'src/lib/entretien-quotidien.ts';

test('★ ACQUIS — on n’écrit jamais deux fois pour la même vente', () => {
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /const reference = `invitation-\$\{sale\}`/, 'La référence unique a disparu.');
  assert.match(s, /\.eq\('delivery_id', reference\)/, 'La trace n’est plus consultée avant d’écrire.');
  assert.match(s, /if \(deja\?\.length\)/);
});

test('★ ACQUIS — un envoi manqué ne pose PAS de trace', () => {
  // Une trace posée sur un envoi qui a échoué condamnerait la personne au
  // silence définitif : la passe suivante la croirait déjà prévenue.
  const s = sansCommentaires(lire(MODULE));
  const iEchec = s.indexOf('bilan.echecs++');
  const iTrace = s.indexOf("provider: 'invitation'");
  assert.ok(iEchec > 0 && iTrace > 0);
  assert.ok(iEchec < iTrace, 'La trace est écrite avant de savoir si le message est parti.');
  assert.match(s, /if \(!parti\)/);
});

test('★ ACQUIS — les comptes existants sont lus EN ENTIER, une seule fois', () => {
  // Une première version relisait mille comptes à chaque vente. Il y en a près
  // de six mille : quelqu'un inscrit au-delà aurait été tenu pour inexistant,
  // et invité à créer un compte qu'il possède déjà.
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /const adressesConnues = new Set<string>\(\)/);
  assert.match(s, /for \(let page = 1; page <= 60; page\+\+\)/, 'La lecture des comptes n’est plus paginée.');
  assert.match(s, /adressesConnues\.has\(email\)/);
  assert.doesNotMatch(s, /perPage: 1000/, 'La lecture est repassée à une seule page de mille.');
});

test('★ ACQUIS — les adresses techniques ne reçoivent rien', () => {
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /\^\(verif\|diagnostic\)/);
  assert.match(s, /endsWith\('@profootai\.com'\)/);
});

test('★ ACQUIS — le rattrapage reste borné dans le temps et en volume', () => {
  // Relancer sur un paiement de six semaines rouvre une plaie oubliée ; et un
  // rattrapage sans plafond se transforme en envoi de masse le jour où une
  // requête rend trop de lignes.
  const s = sansCommentaires(lire(MODULE));
  const fenetre = s.match(/FENETRE_JOURS = (\d+)/);
  const plafond = s.match(/MAX_PAR_PASSE = (\d+)/);
  assert.ok(fenetre && Number(fenetre[1]) <= 60, 'La fenêtre de relance est trop large.');
  assert.ok(plafond && Number(plafond[1]) <= 50, 'Le plafond par passe est trop haut.');
  assert.match(s, /if \(bilan\.invites >= MAX_PAR_PASSE\) break;/);
});

test('★ ACQUIS — sans clé de courriel, on ne fait rien et on le dit', () => {
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /if \(!courrielDisponible\(\)\)/);
  assert.match(s, /return bilan;/);
});

test('★ ACQUIS — le rattrapage est branché à l’entretien quotidien', () => {
  const e = sansCommentaires(lire(ENTRETIEN));
  assert.match(e, /inviterAcheteursSansCompte/, 'Le rattrapage n’est plus appelé.');
  assert.match(e, /Inviter les acheteurs sans compte/);
});
