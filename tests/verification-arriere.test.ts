/**
 * ★ ACQUIS — LE LOT DE VÉRIFICATION COUVRE UNE JOURNÉE ENTIÈRE.
 *
 * ── CE QUI MAIGRISSAIT SANS QUE RIEN NE LE DISE ───────────────────────────
 *
 * L'entretien vérifiait trois cents analyses par passage. L'application en
 * produit environ mille cinq cents par jour : chaque passage en laissait donc
 * mille deux cents de côté, et l'arriéré grossissait d'autant, tous les jours.
 *
 * Mesuré le 30 août 2026 — part des analyses confrontées à leur résultat :
 *
 *     22 août   96 %
 *     24 août   66 %
 *     27 août    8 %
 *     29 août   25 %
 *
 * 5 006 analyses de plus de trente-six heures n'avaient jamais été vérifiées,
 * dont 824 vieilles de plus d'une semaine.
 *
 * Rien n'était en panne, rien n'a jamais levé d'erreur. C'est le mur de preuves
 * qui maigrissait, et le taux de précision montré aux visiteurs qui se
 * calculait sur un échantillon de plus en plus vieux — pendant qu'un client
 * écrivait « les pronostics n'ont pas marché » sans qu'on puisse lui répondre,
 * faute d'avoir vérifié ses propres matchs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('★ ACQUIS — l’entretien vérifie au moins une journée d’analyses', () => {
  const s = sansCommentaires(lire('src/lib/entretien-quotidien.ts'));
  const lot = s.match(/verifierPronostics\((\d+)\)/);
  assert.ok(lot, 'La vérification des pronostics a disparu de l’entretien.');
  assert.ok(
    Number(lot![1]) >= 1500,
    `Lot de ${lot![1]} : en dessous du volume quotidien (~1 500), l’arriéré recommence à grossir chaque jour.`
  );
});

test('★ ACQUIS — l’entretien tourne APRÈS la réponse, jamais en vol', () => {
  // Sur une plateforme sans serveur, la fonction est arrêtée dès la réponse
  // envoyée : tout travail encore en vol est tué sans un mot. `after` garde la
  // fonction en vie jusqu'au bout, sans faire attendre le visiteur.
  const s = lire('src/app/(dashboard)/preuves/page.tsx');
  assert.match(s, /after\(async \(\) => \{/, 'L’entretien repart en vol : il sera tué avant la fin.');
  assert.match(s, /entretenirSiNecessaire/, 'La page ne déclenche plus l’entretien.');
});
