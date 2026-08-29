/**
 * ★ ACQUIS — OUVRIR UN ACCÈS À LA MAIN NE DOIT NI SE PERDRE, NI SE CONFONDRE
 * AVEC UNE VENTE.
 *
 * ── POURQUOI CET OUTIL EXISTE ─────────────────────────────────────────────
 *
 * Chariow a encaissé 358 ventes ; 354 abonnements ont été créés. Quatre
 * personnes ont payé sans jamais recevoir leur accès, dont deux le 13 août. La
 * boutique a fermé le 27 : ces ventes ne sont consultables nulle part, et
 * aucune réconciliation ne peut les retrouver.
 *
 * ── LES DEUX FAÇONS DONT CET OUTIL PEUT NUIRE ─────────────────────────────
 *
 *   1. il compte l'accès offert comme une recette — et la part du partenaire
 *      se calcule alors sur de l'argent qui n'est jamais entré ;
 *   2. il n'écrit pas pourquoi — et trois mois plus tard personne ne sait si
 *      cet abonnement a été payé ou donné.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ACTION = 'src/app/admin/users/actions.ts';
const ECRAN = 'src/app/admin/users/[id]/OuvrirAcces.tsx';

test('★ ACQUIS — un accès ouvert à la main n’est jamais compté comme une recette', () => {
  // Le montant inscrit doit être zéro. L'y mettre le prix de l'offre
  // gonflerait les recettes du mois et, avec elles, la part due aux
  // partenaires : on paierait quelqu'un sur de l'argent jamais encaissé.
  const a = sansCommentaires(lire(ACTION));
  assert.match(a, /amount: 0/, 'L’accès manuel inscrit un montant : il entre dans les recettes.');
  assert.match(a, /provider: "manuel"/, 'L’accès manuel ne se distingue plus d’une vente.');
});

test('★ ACQUIS — l’action est fermée aux non-administrateurs', () => {
  // Une action serveur ne traverse pas le gabarit et n'hérite d'aucune de ses
  // protections. Sans ce contrôle, n'importe quel compte connecté s'offrirait
  // un abonnement VIP.
  const a = lire(ACTION);
  assert.match(
    a,
    /export async function ouvrirAccesManuel[\s\S]{0,300}await administrateur\(\)/,
    'L’ouverture d’accès ne vérifie plus qui la demande.'
  );
  assert.match(a, /estAdmin\(user\?\.email\)/);
});

test('★ ACQUIS — le motif est obligatoire et il est conservé', () => {
  const a = sansCommentaires(lire(ACTION));
  assert.match(a, /raison\.length < 5/, 'Un accès peut de nouveau être ouvert sans motif.');
  assert.match(a, /from\("webhook_events"\)/, 'La trace de l’ouverture n’est plus écrite.');
  assert.match(a, /motif: raison/, 'Le motif n’est plus conservé.');
  assert.match(a, /par,/, 'On ne sait plus QUI a ouvert l’accès.');
});

test('★ ACQUIS — un accès déjà plus long n’est pas raccourci', () => {
  // Quelqu'un qui a un abonnement valide et à qui l'on en ouvre un autre ne
  // doit pas y perdre les jours qui lui restaient.
  const a = sansCommentaires(lire(ACTION));
  assert.match(a, /finLaPlusLoin/, 'Le garde-fou contre le raccourcissement a sauté.');
  assert.match(a, /new Date\(finLaPlusLoin\) > fin/);
});

test('★ ACQUIS — la durée reste dans des bornes raisonnables', () => {
  const a = sansCommentaires(lire(ACTION));
  assert.match(a, /duree < 1 \|\| duree > 400/, 'Une durée absurde est de nouveau acceptée.');
});

test('★ ACQUIS — le formulaire est replié par défaut', () => {
  // Ouvrir un accès sans encaissement est rare et coûteux. Un formulaire
  // déployé en permanence finit par être utilisé sans réfléchir.
  const e = sansCommentaires(lire(ECRAN));
  assert.match(e, /if \(!ouvert\)/, 'Le formulaire est déployé en permanence.');
  assert.match(e, /Motif/, 'Le champ de motif a disparu de l’écran.');
});
