/**
 * ★ ACQUIS — L'AUDIT JUGE SUR UNE JOURNÉE, PAS SUR QUARANTE ANALYSES.
 *
 * ── CE QU'IL ANNONÇAIT À TORT ─────────────────────────────────────────────
 *
 * Le contrôle de qualité lisait les quarante analyses les plus récentes.
 * L'application en produit environ mille quatre cents par jour : il jugeait
 * donc le moteur sur trois pour cent de sa production.
 *
 * Mesuré le 1er septembre 2026, au même instant :
 *
 *     sur 40 analyses  ->  27 affiches, « 2-1 » à 48 %   ANOMALIE
 *     sur la journée   -> 126 affiches, « 2-1 » à 33 %   normal
 *
 * Le seuil est à 45 %. L'audit annonçait un moteur en panne alors qu'il
 * tournait juste — et « 2-1 » est le score le plus fréquent du football réel,
 * il DOIT arriver en tête.
 *
 * Un signal qui se déclenche à tort finit ignoré, et c'est précisément celui-là
 * qui doit attraper le vrai défaut : le « 2-1 » servi à 82 % des analyses est
 * passé inaperçu pendant des jours faute d'être mesuré.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const AUDIT = 'src/lib/audit.ts';

test('★ ACQUIS — l’échantillon couvre une journée d’analyses', () => {
  const s = sansCommentaires(lire(AUDIT));
  const n = s.match(/ANALYSES_EXAMINEES = (\d+)/);
  assert.ok(n, 'La taille de l’échantillon a disparu.');
  assert.ok(
    Number(n![1]) >= 500,
    `Échantillon de ${n![1]} analyses : trop petit pour juger un moteur qui en produit ~1 400 par jour. À 40, l’audit annonçait 48 % là où la journée disait 33 %.`
  );
});

test('★ ACQUIS — une affiche compte pour une, pas pour vingt', () => {
  // Vingt personnes analysent le même match : le moteur rend évidemment vingt
  // fois le même score. Ce n'est pas un défaut, c'est un match populaire. Le
  // vrai défaut du « 2-1 » dominait sur des affiches DIFFÉRENTES.
  const s = sansCommentaires(lire(AUDIT));
  assert.match(s, /const parMatch = new Map<string, Map<string, number>>\(\)/, 'Le regroupement par affiche a sauté.');
  assert.match(s, /const avecScore = parMatch\.size;/, 'Le pourcentage se calcule de nouveau sur les analyses.');
});

test('★ ACQUIS — en dessous de dix affiches, on ne conclut pas', () => {
  // Sur six matchs, deux fois le même score font déjà 33 %.
  const s = sansCommentaires(lire(AUDIT));
  assert.match(s, /if \(avecScore < 10\)/, 'Le garde-fou des petits échantillons a disparu.');
});
