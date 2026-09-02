import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ★ ACQUIS — L'ENTONNOIR ATTRIBUE CHAQUE ÉTAPE À LA BONNE OFFRE.
 *
 * ── LES DEUX DÉFAUTS QUE CES ÉPREUVES FERMENT ─────────────────────────────
 *
 * Mesuré du 22 au 24 août 2026, l'entonnoir affichait une fuite de 49 % :
 * 244 personnes sur 494 auraient cliqué sur une offre puis se seraient
 * évaporées. Les deux causes étaient dans notre code, pas chez les acheteurs.
 *
 * 1. LE BOUTON « VOIR LES TARIFS » SE FAISAIT PASSER POUR UN CLIC D'ACHAT.
 *    Il partageait l'étape « offre-cliquee » et pesait 377 des 579 clics
 *    comptés — les deux tiers. Or il n'ouvre aucune notice et ne mène à
 *    aucune caisse : il envoie lire les prix. Ces gens n'abandonnaient rien.
 *
 * 2. LA NOTICE ÉMETTAIT SES SORTIES SANS NOM D'OFFRE. Les 192 « Continuer »
 *    tombaient dans un panier commun, séparé des 146 clics sur l'Essentiel
 *    qui les avaient provoqués. L'entonnoir par offre affichait « 267 % ont
 *    cliqué Continuer » — un pourcentage impossible.
 *
 * Une fois séparés, les vrais chiffres : 91 % de ceux qui cliquent l'offre
 * d'entrée arrivent en caisse. Il n'y avait pas de fuite.
 */

const RACINE = join(process.cwd(), 'src');
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');

const NOTICE = 'components/NoticePaiement.tsx';
const PAYWALL = 'app/(dashboard)/analyze/MurAbonnement.tsx';
const TARIFS = 'app/(dashboard)/pricing/PricingClient.tsx';
const MESURE = 'lib/mesure-visites.ts';

test('★ ACQUIS — les trois sorties de la notice portent le nom de l’offre', () => {
  const src = lire(NOTICE);

  for (const appel of [
    'signalerEtape(cause, cleOffre)',
    "signalerEtape('notice-fermee', cleOffre)",
  ]) {
    assert.ok(
      src.includes(appel),
      `La notice n’émet plus « ${appel} ». Sans le nom de l’offre, ses sorties ` +
        'retombent dans un panier commun et l’entonnoir par offre redevient ' +
        'illisible — on a mesuré « 267 % ont cliqué Continuer » à cause de ça.'
    );
  }

  assert.ok(
    src.includes('cleOffre?: string'),
    'La notice n’accepte plus de clé d’offre. C’est l’appelant qui sait ce qu’il ' +
      'vend : le paywall un match seul, la page des tarifs trois abonnements.'
  );
});

/**
 * ── LE MUR NE VEND PLUS RIEN LUI-MÊME ────────────────────────────────────
 *
 * Il a proposé deux issues jusqu'au 2 septembre 2026 : débloquer LA rencontre
 * pour 600 FCFA, ou prendre un abonnement. Le propriétaire a retiré le premier
 * du catalogue — il avait produit DEUX ventes en tout, les 13 août, par la même
 * personne.
 *
 * Le mur ne fait donc plus qu'une chose : envoyer lire les prix. La notice de
 * paiement, la détection du pays et l'appel à la caisse vivent sur /pricing, en
 * un seul exemplaire. Ces tests protègent ce qui reste : une seule porte, et le
 * comptage qui la distingue.
 */
test('★ ACQUIS — la page des tarifs transmet sa clé d’offre', () => {
  assert.ok(
    !lire(PAYWALL).includes('NoticePaiement'),
    'Le mur a de nouveau sa propre caisse : elle doit vivre sur /pricing, en un seul exemplaire.'
  );

  assert.ok(
    lire(TARIFS).includes('cleOffre={noticePour}'),
    'La page des tarifs ne transmet plus la clé de l’offre cliquée. Les trois ' +
      'abonnements se retrouveraient mélangés dans un seul compteur.'
  );
});

test('★ ACQUIS — « voir les tarifs » n’est pas compté comme un clic d’achat', () => {
  const src = lire(PAYWALL);

  assert.ok(
    src.includes("signalerEtape('vers-tarifs')"),
    'Le départ du paywall vers la page des tarifs n’a plus son étape propre. ' +
      'Remis sous « offre-cliquee », il pèserait de nouveau les deux tiers du ' +
      'haut de l’entonnoir et ferait réapparaître une fuite de 49 % imaginaire.'
  );

  assert.ok(
    !src.includes("signalerEtape('offre-cliquee', 'vers-tarifs')"),
    'Le bouton « voir les tarifs » émet de nouveau un « offre-cliquee ». Il ' +
      'n’ouvre aucune notice et ne mène à aucune caisse : le compter comme un ' +
      'clic d’achat fabrique des abandons qui n’existent pas.'
  );
});

test('★ ACQUIS — l’ancien chemin reste écarté du haut de l’entonnoir', () => {
  const src = lire(MESURE);

  assert.ok(
    src.includes("ANCIEN_VERS_TARIFS = '/~offre-cliquee/vers-tarifs'"),
    'L’exclusion de l’ancien chemin a disparu. Les semaines déjà enregistrées ' +
      'sous « /~offre-cliquee/vers-tarifs » regonfleraient le haut de ' +
      'l’entonnoir jusqu’à sortir de la fenêtre de lecture.'
  );

  assert.ok(
    src.includes("c.startsWith('/~offre-cliquee') && c !== ANCIEN_VERS_TARIFS"),
    'Le compteur des clics sur une offre ne filtre plus l’ancien chemin du ' +
      'bouton « voir les tarifs ».'
  );

  assert.ok(
    src.includes("cle: 'vers-tarifs'"),
    'L’étape « vers les tarifs » n’est plus affichée. Elle dit combien de ' +
      'lecteurs d’analyse préfèrent l’abonnement au match seul — une ' +
      'information qu’on perdrait en la supprimant plutôt qu’en la déplaçant.'
  );
});
