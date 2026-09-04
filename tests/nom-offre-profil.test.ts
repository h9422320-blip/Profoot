/**
 * ★ ACQUIS — LE PROFIL NOMME L'OFFRE RÉELLEMENT PAYÉE.
 *
 * ── LE BADGE DISAIT « PRO » À TOUT LE MONDE ───────────────────────────────
 *
 * Il se posait sur `isPro`, qui vaut vrai dès qu'un accès payant est ouvert,
 * quel qu'il soit. Constaté dans le navigateur le 4 septembre 2026 sur un
 * compte porteur d'un accès Essentiel : « Ui Test — PRO ».
 *
 * Deux personnes y perdaient :
 *
 *   — l'abonné Essentiel à 2 000 FCFA, à qui l'on annonçait l'offre à 5 000
 *     qui donne cinquante analyses. Il en a vingt. C'est une réclamation qui
 *     attend, et elle est fondée ;
 *   — l'abonné VIP Annuel à 15 000 FCFA, l'offre la plus chère, rétrogradé au
 *     même « Pro » que les autres.
 *
 * Le serveur nommait déjà l'offre exacte dans `planLabel`. Il suffisait de
 * l'afficher.
 *
 * Le lien voisin disait « Accès Pro » pour ce qui n'est qu'une porte vers les
 * tarifs. Il dit maintenant sa destination — et surtout pas « Mon abonnement » :
 * ProFoot vend un achat unique à durée fixe, sans prélèvement récurrent, et
 * c'est le mot pour lequel Chariow a fermé la boutique le 27 août 2026. Le test
 * de conformité l'a rattrapé au moment même où il allait partir.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const profil = sansCommentaires(lire('src/app/(dashboard)/history/page.tsx'));
const route = sansCommentaires(lire('src/app/api/payments/status/route.ts'));

test('★ ACQUIS — le serveur nomme l’offre, et le profil la lit', () => {
  assert.match(route, /planLabel:/, 'Le serveur ne nomme plus l’offre.');
  assert.match(
    profil,
    /setNomOffre\(data\.premium \? \(data\.planLabel \?\? null\) : null\)/,
    'Le profil ne lit plus le nom de l’offre envoyé par le serveur.'
  );
});

test('★ ACQUIS — le badge n’écrit plus « Pro » en dur', () => {
  const zone = profil.slice(profil.indexOf('rounded-full font-black uppercase') - 400);
  assert.doesNotMatch(
    zone.slice(0, 900),
    />Pro</,
    'Le badge est redevenu « Pro » pour tout le monde, Essentiel et VIP compris.'
  );
  assert.match(profil, /\{nomOffre \?\? 'Membre'\}/, 'Le badge n’affiche plus le nom de l’offre.');
});

test('★ ACQUIS — le lien vers les tarifs ne porte pas le nom d’une offre', () => {
  // « Accès Pro » désignait une offre précise pour ce qui n'est qu'une porte
  // vers la page des tarifs.
  assert.doesNotMatch(profil, /Accès Pro/, 'Le lien annonce de nouveau une offre au lieu de sa destination.');
  assert.match(
    profil,
    /\{isPro \? 'Mon accès' : 'Voir les offres'\}/,
    'Le lien ne s’adapte plus à celui qui le lit.'
  );
});
