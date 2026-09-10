/**
 * ★ ACQUIS — LA PAGE DES PARTENAIRES SE COMPARE À MAKETOU SANS CALCUL.
 *
 * ── CE QUI A DÉCLENCHÉ CE FICHIER ───────────────────────────────────────
 *
 * Le propriétaire, le 10 septembre 2026 : « les chiffres de MakeTou et ceux
 * de la page admin ne sont pas du tout pareils, il y a beaucoup d'écart, et
 * mon influenceur va penser que je suis en train de le manger ».
 *
 * L'écart était réel, permanent, et parfaitement normal : MakeTou affiche ce
 * que l'ACHETEUR a payé — le prix plus deux pour cent —, la page comptait le
 * prix de vente. Deux nombres différents pour la même journée, sans qu'aucune
 * ligne ne l'explique. Sur le seul 10 septembre : 55 080 chez MakeTou,
 * 54 000 sur la page.
 *
 * Le rapprochement existait pour le CUMUL, mais pas pour le JOUR — et c'est
 * le jour que le propriétaire regarde : « tu peux me dire hier combien on a
 * fait, avant-hier combien on a fait ».
 *
 * ── CE QUI EST MESURÉ, ET N'EST PLUS SUPPOSÉ ────────────────────────────
 *
 * Le taux de 2 % était une hypothèse à confirmer sur l'écran de la boutique.
 * Le journal du pulse garde le prix du produit ET le montant annoncé pour
 * chaque vente. Relevé sur 98 ventes réelles, aux quatre tarifs :
 *
 *     2 000 → 2 040 (79 fois)      5 000 → 5 100 (9 fois)
 *    15 000 → 15 300 (9 fois)      2 500 → 2 550 (1 fois)
 *
 * Exactement +2,00 % partout. Un forfait de 40 F aurait donné 5 040 et
 * 15 040 : c'est bien un pourcentage.
 *
 * ── CE QUE CE FICHIER GARANTIT ──────────────────────────────────────────
 *
 * Que les trois nombres qui parlent du même argent restent distincts,
 * nommés, et calculés sur la bonne base — parce que c'est un partenaire qu'on
 * paie avec, et qu'un partenaire qui doute ne redevient jamais confiant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  TAUX_MAKETOU_ACHETEUR,
  TAUX_MAKETOU_VENDEUR,
  surcoutAcheteurMaketou,
} from '../src/lib/recettes-boutique';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const PAGE = 'src/app/admin/partenaires/page.tsx';

test('★ ACQUIS — le supplément acheteur vaut ce que la boutique a réellement annoncé', () => {
  // Les quatre tarifs relevés dans le journal du pulse, au franc près.
  const releve = [
    { prix: 2000, annonce: 2040 },
    { prix: 5000, annonce: 5100 },
    { prix: 15000, annonce: 15300 },
    { prix: 2500, annonce: 2550 },
  ];
  for (const r of releve) {
    assert.equal(
      r.prix + surcoutAcheteurMaketou(r.prix),
      r.annonce,
      `Un produit à ${r.prix} F doit s'afficher ${r.annonce} F chez MakeTou.`
    );
  }
  // Et c'est bien un pourcentage, pas un forfait : sinon 5 000 donnerait 5 040.
  assert.notEqual(
    5000 + surcoutAcheteurMaketou(5000),
    5040,
    'Le supplément est redevenu un forfait : les gros tarifs ne tomberont plus juste.'
  );
});

test('★ ACQUIS — les deux prélèvements restent distincts', () => {
  // Les confondre ferait payer au partenaire une commission de 7 % que
  // personne n'a prélevée sur le projet : les 2 % de l'acheteur ne sont
  // jamais entrés dans la caisse.
  assert.notEqual(
    TAUX_MAKETOU_ACHETEUR,
    TAUX_MAKETOU_VENDEUR,
    'Le supplément acheteur et la commission vendeur ont été confondus.'
  );
  assert.equal(TAUX_MAKETOU_ACHETEUR, 0.02);
  assert.equal(TAUX_MAKETOU_VENDEUR, 0.05);
});

test('★ ACQUIS — le jour par jour porte le nombre lisible chez MakeTou', () => {
  const s = sansCommentaires(lire(PAGE));

  assert.match(s, /Chez MakeTou/, 'La colonne de rapprochement quotidien a disparu.');
  assert.match(
    s,
    /p\.xof \+ surcoutAcheteurMaketou\(p\.xof\)/,
    'La colonne n’affiche plus le prix augmenté du supplément acheteur.'
  );

  // Chariow est morte le 27 août : son tableau de bord n'est plus consultable,
  // et afficher un nombre à confronter à rien tromperait sur sa nature.
  assert.match(
    s,
    /jour <= DERNIER_JOUR_CHARIOW[\s\S]{0,80}"—"/,
    'Les journées Chariow affichent un nombre MakeTou qui n’a jamais existé.'
  );
});

test('★ ACQUIS — la base de la commission partenaire reste le prix de vente', () => {
  const s = sansCommentaires(lire(PAGE));
  // Le net dont le partenaire touche sa part se calcule sur `cumul.xof`, le
  // prix de vente — jamais sur le nombre affiché par la boutique, qui contient
  // 2 % d'argent qui n'est jamais entré chez nous.
  assert.match(
    s,
    /const net = Math\.max\(0, cumul\.xof - cumul\.frais\)/,
    'Le net du partenaire ne se calcule plus sur le prix de vente.'
  );
  assert.doesNotMatch(
    s,
    /const net = [\s\S]{0,60}afficheMaketou/,
    'Le partenaire serait payé sur de l’argent que le projet n’a jamais encaissé.'
  );
});
