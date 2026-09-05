/**
 * ★ ACQUIS — DIRE CE QU'ON VEND, DANS CHAQUE MESSAGE ET SUR L'ÉCRAN.
 *
 * ── CE QUI A RENDU CES DEUX MENTIONS NÉCESSAIRES ──────────────────────────
 *
 * 5 septembre 2026. Un membre répond au courriel du matin : « Oui mais je
 * commence trop à perdre de l'argent il faut améliorer vos analyses. » Il
 * avait pris l'accès annuel trois jours plus tôt.
 *
 * Ses chiffres racontaient autre chose : dix-sept rencontres vérifiées, 41 %
 * de résultats justes contre 56 % en moyenne — et ses réussites toutes sur
 * des matchs très déséquilibrés, ses échecs tous sur des matchs serrés. Il
 * n'avait pas un problème d'analyse : il croyait acheter des certitudes.
 *
 * ── ET LE RISQUE QUE CELA FAIT COURIR ─────────────────────────────────────
 *
 * Sa phrase établit par écrit qu'il engage de l'argent sur nos analyses. Ce
 * projet a perdu sa boutique en août 2026 sur un contrôle « produits
 * interdits : paris sportifs, jeux de hasard ». Un échange pareil est
 * exactement la pièce qui déclenche le suivant.
 *
 * Ces deux mentions ne sont pas des formules pour se couvrir : elles disent
 * la vérité de ce qui est vendu, et elles sont ce qui permet de le démontrer.
 * Les retirer se paierait le jour d'un contrôle, pas avant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const campagnes = sansCommentaires(lire('src/lib/campagnes/index.ts'));
const rappel = sansCommentaires(lire('src/app/(dashboard)/analyze/RappelAnalyse.tsx'));
const ecran = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));

// ── LES COURRIELS ──────────────────────────────────────────────────────────

test('★ ACQUIS — aucune campagne ne part sans dire ce que sont nos analyses', () => {
  assert.match(
    campagnes,
    /const MENTION =/,
    'La mention a disparu des campagnes.'
  );
  assert.match(
    campagnes,
    /outil d'analyse statistique du football/,
    'La nature du service n’est plus énoncée dans les messages.'
  );
  assert.match(
    campagnes,
    /ne\s*'?\s*\+?\s*'?garantissent aucun résultat/,
    'La phrase qui refuse toute garantie a été retirée.'
  );
  // Elle vit DANS la signature : c'est ce qui la rend impossible à oublier,
  // les cinq campagnes empruntant le même bloc.
  assert.match(
    campagnes,
    /const SIGNATURE = \[[^\]]*MENTION\]/,
    'La mention est sortie de la signature : une campagne pourra partir sans elle.'
  );
});

test('★ ACQUIS — les cinq campagnes empruntent la même signature', () => {
  // Si l'une d'elles écrivait son propre pied, elle échapperait à la mention
  // sans que rien ne le signale.
  const emprunts = campagnes.split('...SIGNATURE').length - 1;
  assert.ok(
    emprunts >= 5,
    `Seulement ${emprunts} campagne(s) empruntent la signature commune : les autres partiraient sans la mention.`
  );
});

// ── L'ÉCRAN ────────────────────────────────────────────────────────────────

test('★ ACQUIS — le rappel s’affiche sur l’écran d’analyse', () => {
  assert.match(ecran, /<RappelAnalyse \/>/, 'Le rappel a été retiré de l’écran d’analyse.');
  assert.match(
    rappel,
    /ne garantissent aucun résultat|ne garantissent aucun|garantissent aucun résultat/,
    'Le rappel ne refuse plus toute garantie de résultat.'
  );
  assert.match(
    rappel,
    /N&apos;engagez jamais sur une analyse un argent dont vous avez besoin/,
    'La mise en garde sur l’argent engagé a disparu.'
  );
});

test('★ ACQUIS — le rappel revient, mais pas à chaque visite', () => {
  // Affiché à chaque passage, il cesserait d'être lu au troisième et
  // deviendrait un meuble. Jamais réaffiché, il ne toucherait que les
  // nouveaux venus.
  assert.match(
    rappel,
    /const UN_MOIS_MS = 30 \* 24 \* 60 \* 60 \* 1000/,
    'La période de réaffichage a changé — vérifier qu’elle reste lisible.'
  );
  assert.match(
    rappel,
    /Date\.now\(\) - vu > UN_MOIS_MS/,
    'Le rappel ne revient plus après un mois.'
  );
});

test('★ ACQUIS — un stockage refusé fait afficher le rappel, jamais l’inverse', () => {
  // Navigation privée, réglages stricts : sans repère lisible, on montre. Une
  // fois de trop ne coûte rien ; une fois de moins coûte la mention.
  const bloc = rappel.slice(rappel.indexOf('useEffect'), rappel.indexOf('if (!visible)'));
  assert.match(
    bloc,
    /catch\s*\{[\s\S]*setVisible\(true\)/,
    'Un stockage indisponible masque désormais le rappel.'
  );
});
