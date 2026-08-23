import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

const PAYWALL = 'src/app/(dashboard)/analyze/PaywallDeuxChemins.tsx';
const TARIFS = 'src/app/(dashboard)/pricing/PricingClient.tsx';

/**
 * LES DEUX PORTES D'ACHAT SONT MESURÉES, ET AIDENT PAREIL.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 24 AOÛT 2026 ───────────────────────────────────
 *
 * L'application vend à deux endroits : la page des tarifs, et le paywall qui
 * s'affiche quand un visiteur gratuit ouvre une analyse.
 *
 * La page des tarifs montrait la notice de paiement depuis le 22 août — « voici
 * comment payer depuis la Côte d'Ivoire, avec Wave ou Orange Money ». Le
 * paywall, lui, envoyait chez Chariow sans un mot, et sans compter personne.
 *
 * Or c'est par là que passe le plus gros du trafic : 1 381 visites sur la page
 * d'analyse contre 900 sur les tarifs. La moitié des acheteurs n'avaient aucune
 * aide, et aucun d'eux n'apparaissait dans le tunnel.
 */
test('★ ACQUIS — le paywall montre la notice de paiement', () => {
  const src = lire(PAYWALL);

  assert.ok(
    /NoticePaiement/.test(src),
    "Le paywall renvoie de nouveau vers Chariow sans explication. Un acheteur à " +
      "Abidjan y arrive sans savoir qu'il peut payer avec Wave ou Orange Money."
  );

  // Chargée à la demande : ce paywall s'affiche à CHAQUE visiteur gratuit, et
  // la table des moyens de paiement pèse quarante-huit kilo-octets.
  assert.ok(
    /dynamic\(\(\) => import\("@\/components\/NoticePaiement"\)/.test(src),
    'La notice est de nouveau importée en dur : ses quarante-huit kilo-octets ' +
      'partiraient dans le téléphone de chaque visiteur gratuit, y compris ceux ' +
      'qui ne cliquent jamais.'
  );
});

test('★ ACQUIS — les deux portes d achat comptent leurs étapes', () => {
  for (const chemin of [PAYWALL, TARIFS]) {
    const src = lire(chemin);

    assert.ok(
      src.includes("signalerEtape('offre-cliquee'"),
      `${chemin} ne compte plus les clics sur une offre. C'est le dénominateur ` +
        'du tunnel : sans lui, on ignore combien de personnes ont vraiment voulu payer.'
    );

    assert.ok(
      src.includes("signalerEtape('depart-caisse'"),
      `${chemin} ne compte plus les départs vers la caisse. C'est le dernier ` +
        'point de mesure avant de quitter le site.'
    );

    assert.ok(
      src.includes("signalerEtape('echec-lien'"),
      `${chemin} ne distingue plus un échec technique d'un abandon volontaire. ` +
        "Les confondre ferait chercher un problème de persuasion là où le lien " +
        'de paiement ne se créait simplement pas.'
    );
  }
});

/**
 * ── LE PAYWALL VEND DEUX CHOSES, ET ELLES NE SE MÉLANGENT PAS ────────────
 *
 * Un match seul à 600 FCFA, et l'abonnement à partir de 2 000. Ni le même prix,
 * ni le même acheteur. Les compter ensemble ferait croire à un seul tunnel là
 * où il y en a deux.
 */
test('★ ACQUIS — le match seul et l abonnement sont comptés séparément', () => {
  const src = lire(PAYWALL);

  assert.ok(
    src.includes("'match-unique'"),
    "L'achat d'un match seul n'est plus étiqueté : il se confondrait avec " +
      "l'abonnement, qui n'a ni le même prix ni le même acheteur."
  );

  assert.ok(
    src.includes("'vers-tarifs'"),
    "Le départ vers la page des tarifs n'est plus compté. On ignorerait combien " +
      'de gens préfèrent l\'abonnement au match seul.'
  );
});

/**
 * ── LES ÉTAPES NE SONT PAS DES PAGES ──────────────────────────────────────
 *
 * Elles vivent dans la même table, sous un chemin commençant par « /~ », pour
 * hériter de l'identifiant de visite, du pays et du signal qui survit à la
 * fermeture de l'onglet. Mais les mêler aux pages fausserait tout : une étape
 * n'a pas de durée, ne s'ouvre pas, et compterait comme une sortie.
 */
test('★ ACQUIS — les étapes du tunnel sont écartées des statistiques de pages', () => {
  const src = lire('src/lib/mesure-visites.ts');

  assert.ok(
    /estEtape/.test(src) && /startsWith\('\/~'\)/.test(src),
    "Les étapes du tunnel ne sont plus distinguées des pages. Elles gonfleraient " +
      'les vues, fausseraient les durées et apparaîtraient comme des sorties.'
  );

  assert.ok(
    /pagesSeules/.test(src),
    "L'agrégation par page ne filtre plus les étapes."
  );
});
