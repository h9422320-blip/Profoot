import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ★ ACQUIS — L'OFFRE MISE EN AVANT EST CELLE QUI CONVERTIT.
 *
 * ── CE QUI A ÉTÉ MESURÉ LE 24 AOÛT 2026 ───────────────────────────────────
 *
 * Sur 1 974 arrivées à la caisse depuis l'ouverture :
 *
 *     Essentiel  2 000 F   1 248 arrivées   203 payés   16,3 %
 *     Pro        5 000 F     508 arrivées    39 payés    7,7 %
 *     Annuel    15 000 F     211 arrivées    13 payés    6,2 %
 *
 * Et 199 des 241 acheteurs ont pris l'Essentiel.
 *
 * Or la page des tarifs mettait le PRO en vedette — halo, ombre portée,
 * position surélevée — sous un badge « Plus populaire » qui était FAUX. La
 * carte la plus poussée était celle qui fait le plus renoncer, et elle
 * affirmait être la plus choisie.
 *
 * Sept cent dix-neuf personnes sont arrivées en caisse sur Pro ou Annuel, où
 * plus de neuf sur dix renoncent devant le montant.
 *
 * ── ET LE RAPPEL DU SOLDE ─────────────────────────────────────────────────
 *
 * 267 paiements ont échoué sur ces 1 974 arrivées — 13,5 %. Ce ne sont pas des
 * hésitants : ils ont saisi leur numéro et validé. Le motif le plus banal d'un
 * refus mobile money est un solde insuffisant, et personne ne le vérifie avant
 * de partir.
 */

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');

const TARIFS = 'src/app/(dashboard)/pricing/PricingClient.tsx';
const NOTICE = 'src/components/NoticePaiement.tsx';
const PAYWALL = 'src/app/(dashboard)/analyze/PaywallDeuxChemins.tsx';

/** Le bloc de définition d'une offre, du début de sa clé à la suivante. */
function blocOffre(src: string, cle: string): string {
  const debut = src.indexOf(`cle: '${cle}'`);
  assert.ok(debut > 0, `L'offre ${cle} a disparu de la page des tarifs.`);
  const suite = src.indexOf("    cle: '", debut + 10);
  return src.slice(debut, suite > 0 ? suite : debut + 2500);
}

test('★ ACQUIS — c est l Essentiel qui est mis en vedette, pas le Pro', () => {
  const src = lire(TARIFS);

  assert.ok(
    blocOffre(src, 'essential_monthly').includes('vedette: true'),
    "L'offre Essentiel n'est plus mise en vedette. C'est elle qui convertit à " +
      '16,3 % contre 7,7 % pour le Pro, et 199 des 241 acheteurs l’ont choisie.'
  );

  assert.ok(
    !blocOffre(src, 'pro_monthly').includes('vedette: true'),
    'Le Pro est de nouveau mis en vedette. Neuf personnes sur dix qui arrivent ' +
      'en caisse sur cette offre renoncent devant le montant.'
  );

  assert.ok(
    !blocOffre(src, 'vip_yearly').includes('vedette: true'),
    "L'offre annuelle est mise en vedette. Elle convertit à 6,2 %, le plus bas des trois."
  );
});

test('★ ACQUIS — aucun badge ne ment sur ce que les gens choisissent', () => {
  const src = lire(TARIFS);

  assert.ok(
    !blocOffre(src, 'pro_monthly').includes('Plus populaire'),
    'Le badge « Plus populaire » est revenu sur le Pro. Il est faux : 199 des ' +
      '241 acheteurs ont pris l’Essentiel. Un badge qui ment sur les choix des ' +
      'autres se retourne contre celui qui l’affiche.'
  );

  assert.ok(
    blocOffre(src, 'essential_monthly').includes('badge:'),
    "L'offre Essentiel n'a plus de badge : rien ne signale plus laquelle regarder."
  );
});

test('★ ACQUIS — le prix de l offre mise en avant est plus gros que les autres', () => {
  const src = lire(TARIFS);

  assert.ok(
    src.includes("offre.vedette ? 'text-5xl") && src.includes("'text-3xl'"),
    'Les trois prix sont revenus à la même taille. Sur téléphone — 92 % du ' +
      'trafic — les cartes s’empilent : la position ne suffit pas à distinguer, ' +
      'c’est la taille qui dit laquelle regarder.'
  );
});

test('★ ACQUIS — le rappel du solde est affiche avant le depart', () => {
  const src = lire(NOTICE);

  assert.ok(
    src.includes('sur votre compte mobile money avant de payer'),
    'Le rappel du solde a disparu de la notice. 267 paiements ont échoué sur ' +
      '1 974 arrivées en caisse, et un solde insuffisant en est le motif le plus banal.'
  );

  assert.ok(
    src.includes('montantXof?: number'),
    'La notice n’accepte plus de montant. Sans lui, la consigne ne peut pas dire ' +
      'combien il faut avoir — et une consigne sans chiffre ne sert à rien.'
  );
});

test('★ ACQUIS — le rappel ne s affiche QUE pour le mobile money, et avec un montant', () => {
  const src = lire(NOTICE);

  assert.ok(
    src.includes('{parMobile && Number.isFinite(montantXof) && (montantXof as number) > 0 && ('),
    'La condition d’affichage a changé. Servie à un acheteur qui paie par carte, ' +
      'la consigne décrirait une manipulation qui n’existe pas chez lui — et une ' +
      'consigne qui ne correspond pas à l’écran fait douter de tout le reste. ' +
      'Sans montant, elle ne dirait rien d’utile.'
  );
});

test('★ ACQUIS — les deux portes d achat transmettent le vrai montant', () => {
  assert.ok(
    lire(PAYWALL).includes('montantXof={prixMatch}'),
    'Le paywall ne transmet plus le prix du match à la notice.'
  );

  assert.ok(
    lire(TARIFS).includes('montantXof={offres[noticePour]?.prixBrut}'),
    'La page des tarifs ne transmet plus le montant. Il doit venir du prix ' +
      'RÉELLEMENT réglé dans l’administration : un montant écrit en dur mentirait ' +
      'le jour où le tarif change.'
  );
});
