/**
 * ★ ACQUIS — UN GESTE COMMERCIAL DOIT ATTEINDRE LES CLIENTS RÉCENTS.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 10 SEPTEMBRE 2026 ─────────────────────────────
 *
 * Un client réclamait depuis des jours. Le propriétaire a demandé de créditer
 * son compte. L'outil prévu pour ça a répondu :
 *
 *     « AUCUN COMPTE avec cette adresse — rien fait. »
 *
 * Le compte existait pourtant depuis le 23 août. L'outil parcourait les
 * comptes par pages de deux cents, et s'arrêtait à la trentième : six mille
 * comptes lus sur les **dix mille trois cent soixante-quatorze** que porte le
 * projet. Tout inscrit récent était donc invisible — c'est-à-dire précisément
 * la population qui réclame, puisque ce sont les derniers à avoir acheté.
 *
 * ── POURQUOI CE DÉFAUT ÉTAIT INDÉTECTABLE ────────────────────────────────
 *
 * « AUCUN COMPTE avec cette adresse » ressemble à un diagnostic, pas à une
 * panne. Personne ne relance un outil qui vient d'expliquer calmement que la
 * personne n'existe pas — on va plutôt vérifier l'adresse, soupçonner une
 * faute de frappe, et renoncer.
 *
 * Un client qui a payé et à qui l'on répond que son compte n'existe pas parle
 * mal du produit. C'est la règle que le propriétaire pose avant toutes les
 * autres.
 *
 * ── CE QUI EST GARANTI ICI ───────────────────────────────────────────────
 *
 * La lecture s'arrête sur une page INCOMPLÈTE — le seul signal de fin
 * fiable — et non sur un nombre de tours choisi d'avance. Le plafond qui
 * subsiste n'est qu'un garde-fou contre une boucle infinie, et il prévient
 * quand il est atteint au lieu de se taire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const OUTIL = 'scripts/offrir-acces.mjs';

test('★ ACQUIS — la lecture des comptes va jusqu’au bout', () => {
  const s = sansCommentaires(lire(OUTIL));

  // Le signal de fin est la page incomplète, pas un compteur de tours.
  assert.match(
    s,
    /if \(lot\.length < PAR_PAGE\) break;/,
    'La lecture ne s’arrête plus sur une page incomplète : elle peut couper trop tôt.'
  );

  // La fenêtre de lecture doit rester largement au-dessus du nombre de
  // comptes réels — 10 374 au 10 septembre 2026.
  const parPage = Number(/const PAR_PAGE = (\d+)/.exec(s)?.[1] ?? 0);
  const pagesMax = Number(/const PAGES_MAX = (\d+)/.exec(s)?.[1] ?? 0);
  assert.ok(parPage > 0 && pagesMax > 0, 'La taille de page et le plafond ne sont plus lisibles.');
  assert.ok(
    parPage * pagesMax >= 100_000,
    `L’outil ne peut lire que ${parPage * pagesMax} comptes : le projet en a déjà plus de dix mille.`
  );
});

test('★ ACQUIS — un plafond atteint se dit, il ne se tait pas', () => {
  const s = sansCommentaires(lire(OUTIL));
  assert.match(
    s,
    /page > PAGES_MAX[\s\S]{0,200}console\.error/,
    'Le plafond de lecture peut être atteint sans que rien ne le signale.'
  );
  // Et une erreur de lecture ne doit pas se déguiser en liste vide.
  assert.match(
    s,
    /if \(error\)[\s\S]{0,160}console\.error/,
    'Une panne de lecture des comptes passerait pour « aucun compte ».'
  );
});

test('★ ACQUIS — l’outil dit combien de comptes il a lus', () => {
  // Sans ce chiffre, rien ne distingue « lu jusqu’au bout » de « coupé à
  // six mille ». C'est lui qui a rendu le défaut visible.
  const s = sansCommentaires(lire(OUTIL));
  assert.match(s, /comptes\.size/, 'Le nombre de comptes lus n’est plus affiché.');
});
