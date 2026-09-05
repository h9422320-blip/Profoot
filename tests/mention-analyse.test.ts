/**
 * ★ ACQUIS — DIRE CE QU'ON VEND, DANS CHAQUE MESSAGE ENVOYÉ.
 *
 * ── CE QUI A RENDU CETTE MENTION NÉCESSAIRE ───────────────────────────────
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
 * Cette mention n'est pas une formule pour se couvrir : elle dit la vérité de
 * ce qui est vendu, et elle est ce qui permet de le démontrer, message après
 * message.
 *
 * ── CE QUI A ÉTÉ RETIRÉ, ET PAR QUI ───────────────────────────────────────
 *
 * Un rappel du même esprit avait été posé sur l'écran d'analyse, une fois par
 * mois et par personne. Le propriétaire l'a fait retirer le jour même, après
 * l'avoir vu : c'est sa décision, et l'écran ne le porte plus. Les courriels,
 * eux, le gardent — c'est là que la trace écrite existe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const campagnes = sansCommentaires(lire('src/lib/campagnes/index.ts'));

test('★ ACQUIS — aucune campagne ne part sans dire ce que sont nos analyses', () => {
  assert.match(campagnes, /const MENTION =/, 'La mention a disparu des campagnes.');
  assert.match(
    campagnes,
    /outil d'analyse statistique du football/,
    'La nature du service n’est plus énoncée dans les messages.'
  );
  assert.match(
    campagnes,
    /garantissent aucun résultat/,
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
