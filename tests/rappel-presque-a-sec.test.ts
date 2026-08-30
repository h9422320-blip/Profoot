/**
 * ★ ACQUIS — ON PRÉVIENT AVANT LE MUR, PAS APRÈS.
 *
 * ── CE QUE LE COMPTEUR NE DISAIT PAS ──────────────────────────────────────
 *
 * Un compteur existait déjà : une barre qui se remplit. Personne ne surveille
 * une barre. L'abonné découvrait sa limite en la heurtant — au moment précis
 * où il voulait une analyse, donc au pire moment possible.
 *
 * Mesuré le 30 août 2026 : un abonné à 40/40 et un autre à 55/60, aucun des
 * deux prévenu. Le premier n'avait plus rien et l'ignorait.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ECRAN = 'src/app/(dashboard)/analyze/AnalyzeClient.tsx';

test('★ ACQUIS — le rappel n’apparaît que dans les dernières analyses', () => {
  const s = sansCommentaires(lire(ECRAN));
  const seuil = s.match(/SEUIL_PRESQUE_SEC = (\d+)/);
  assert.ok(seuil, 'Le seuil a disparu.');
  assert.ok(Number(seuil![1]) >= 1 && Number(seuil![1]) <= 5,
    'Trop bas, le rappel arrive quand il est déjà trop tard ; trop haut, il s’affiche la moitié du mois et on cesse de le voir.');
  assert.match(s, /quota\.remaining <= SEUIL_PRESQUE_SEC/, 'Le seuil n’est plus appliqué.');
});

test('★ ACQUIS — jamais à zéro, jamais en illimité', () => {
  // À zéro c'est la carte « limite atteinte » qui parle : deux messages sur le
  // même sujet au même moment se contredisent plus qu'ils n'aident. Et un
  // compte illimité n'a rien à recharger.
  const s = sansCommentaires(lire(ECRAN));
  assert.match(s, /!quota\.unlimited &&/, 'Un compte illimité verrait un rappel de recharge.');
  assert.match(s, /quota\.remaining > 0 &&/, 'Le rappel s’affiche en même temps que la carte de limite atteinte.');
  assert.match(s, /isPremium &&/, 'Un compte gratuit verrait un rappel de quota, alors qu’il relève du paywall.');
});

test('★ ACQUIS — le rappel emprunte le MÊME chemin d’achat que la carte de limite', () => {
  // Deux chemins d'achat écrits séparément finiraient par diverger : une étape
  // de mesure oubliée d'un côté, une offre différente de l'autre — et un
  // membre Pro qui rachèterait l'Essentiel perdrait son argent.
  const s = sansCommentaires(lire(ECRAN));
  const debut = s.indexOf('{presqueASec && offreActuelle && (');
  assert.ok(debut > 0, 'Le bloc de rappel est introuvable.');
  const bloc = s.slice(debut, debut + 1800);
  assert.match(bloc, /signalerEtape\('offre-cliquee', offreActuelle\.cle\)/, 'L’étape de mesure a sauté.');
  assert.match(bloc, /setNoticeRecharge\(true\)/, 'Le rappel n’ouvre plus la notice de paiement.');
  assert.match(bloc, /offreActuelle\.prixXof/, 'Le rappel n’affiche plus le prix de SON offre.');
  assert.doesNotMatch(bloc, /fetch\(/, 'Le rappel parle au serveur de son côté : ce n’est plus le même chemin.');
  assert.match(bloc, /min-h-\[44px\]/, 'Le bouton passe sous la taille d’une zone de tap confortable.');
});
