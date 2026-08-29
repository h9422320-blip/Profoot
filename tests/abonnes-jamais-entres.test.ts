/**
 * ★ ACQUIS — CELUI QUI A PAYÉ ET NE PEUT PAS ENTRER DOIT SE VOIR.
 *
 * ── CE QUE CETTE SURVEILLANCE AURAIT ÉVITÉ ────────────────────────────────
 *
 * Le 29 août 2026, un client a filmé son téléphone pour montrer qu'il
 * n'arrivait pas à entrer. Il avait payé, son abonnement était actif, et
 * l'application le renvoyait en boucle entre la connexion et l'inscription : il
 * n'avait pas de mot de passe, parce que c'est nous qui avions créé son compte.
 *
 * On ne l'a su que parce qu'il a pris la peine de filmer. C'est là le vrai
 * danger : celui qui ne prévient pas ne devient jamais un problème visible. Il
 * pose un avis d'une étoile, ou il se tait, et dans les deux cas on ne corrige
 * rien.
 *
 * Le signal existait pourtant, et il était exact : un abonnement actif sur un
 * compte qui ne s'est JAMAIS connecté. Ce soir-là il valait trois, et ces trois
 * étaient précisément les personnes bloquées.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MODULE = 'src/lib/abonnes-jamais-entres.ts';
const ENTRETIEN = 'src/lib/entretien-quotidien.ts';
const AUDIT = 'src/app/api/cron/audit/route.ts';

test('★ ACQUIS — le signal est « abonnement actif + jamais connecté »', () => {
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /\.eq\('status', 'active'\)/, 'On ne regarde plus les abonnements actifs.');
  assert.match(s, /last_sign_in_at/, 'La dernière connexion n’est plus lue : le signal a disparu.');
  assert.match(s, /if \(compte\.derniereEntree\) continue;/, 'Quelqu’un qui est déjà entré serait signalé.');
  assert.match(s, /new Date\(a\.expires_at\)\.getTime\(\) > maintenant/, 'Un abonnement expiré compterait encore.');
});

test('★ ACQUIS — on attend un jour avant de crier', () => {
  // Quelqu'un qui paie à 23 h et se connecte le lendemain matin n'est pas
  // bloqué : il dormait. Une alarme qui sonne toujours ne se lit plus.
  const s = sansCommentaires(lire(MODULE));
  const seuil = s.match(/SEUIL_HEURES = (\d+)/);
  assert.ok(seuil && Number(seuil[1]) >= 12, 'Le seuil est trop court : l’alerte sonnera pour tout le monde.');
  assert.ok(seuil && Number(seuil[1]) <= 48, 'Le seuil est trop long : le client attend trop avant d’être vu.');
  assert.match(s, /if \(heures < SEUIL_HEURES\) continue;/, 'Le seuil n’est plus appliqué.');
});

test('★ ACQUIS — un même nom n’est pas répété tous les matins', () => {
  // Redire le même nom chaque jour userait l'alerte jusqu'à ce qu'on cesse de
  // l'ouvrir — et le jour où elle porterait un nom nouveau, il passerait
  // inaperçu.
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /RAPPEL_JOURS = (\d+)/, 'Le rappel espacé a disparu : l’alerte redevient quotidienne.');
  assert.match(s, /\.like\('delivery_id', 'jamais-entre-%'\)/, 'On ne consulte plus qui a déjà été signalé.');
  assert.match(s, /dernierSignalement/, 'La date du dernier signalement n’est plus prise en compte.');
});

test('★ ACQUIS — pas de trace tant que l’alerte n’est pas partie', () => {
  // Écrire la trace avant l'envoi ferait passer le cas pour signalé alors que
  // personne n'a rien reçu — et il ne reviendrait qu'au rappel, sept jours
  // plus tard.
  const s = sansCommentaires(lire(MODULE));
  assert.match(
    s,
    /if \(bilan\.alerteEnvoyee\)[\s\S]{0,600}delivery_id: `jamais-entre-/,
    'La trace s’écrit même quand l’alerte n’est pas partie.'
  );
});

test('★ ACQUIS — la surveillance tourne sans personne devant l’écran', () => {
  // Deux passages par jour, comme la réconciliation des ventes : celui de
  // minuit et celui de 5 h 37. Si l'un échoue, l'autre rattrape.
  assert.match(
    sansCommentaires(lire(ENTRETIEN)),
    /signalerAbonnesJamaisEntres/,
    'L’entretien ne relève plus les abonnés bloqués dehors.'
  );
  assert.match(
    sansCommentaires(lire(AUDIT)),
    /signalerAbonnesJamaisEntres/,
    'L’audit ne relève plus les abonnés bloqués dehors.'
  );
});

test('★ ACQUIS — les comptes de test ne déclenchent pas l’alerte', () => {
  const s = sansCommentaires(lire(MODULE));
  assert.match(s, /DOMAINES_DE_TEST\.test\(compte\.email\)/, 'Une adresse de test ferait sonner l’alerte.');
});
