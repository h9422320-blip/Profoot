import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

const PAYWALL = 'src/app/(dashboard)/analyze/MurAbonnement.tsx';
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
test('★ ACQUIS — le mur d abonnement n a PAS de caisse a lui', () => {
  // Il a eu la sienne jusqu'au 2 septembre 2026, pour vendre un match seul a
  // 600 FCFA. Le proprietaire a retire cette offre du catalogue : deux ventes
  // en tout, les 13 aout, par la meme personne.
  //
  // Le mur envoie desormais lire les prix, et rien d'autre. La notice de
  // paiement, la detection du pays et l'appel a la caisse vivent sur /pricing,
  // en UN SEUL exemplaire — deux chemins d'achat a maintenir d'accord entre eux
  // finissent toujours par diverger.
  //
  // Benefice mesurable au passage : les quarante-huit kilo-octets de la table
  // des moyens de paiement ne partent plus du tout dans le telephone des
  // visiteurs gratuits, qui sont l'ecrasante majorite.
  const src = lire(PAYWALL);

  assert.ok(
    !/NoticePaiement/.test(src),
    'Le mur a de nouveau sa propre notice de paiement : la caisse doit rester sur /pricing.'
  );
  assert.ok(
    !src.includes('/api/paiement/caisse'),
    'Le mur appelle de nouveau la caisse directement.'
  );
  assert.ok(
    src.includes('href="/pricing"'),
    'Le mur ne mene plus a la page des tarifs : le visiteur gratuit n a plus aucune sortie.'
  );
});

test('★ ACQUIS — la page des tarifs compte ses étapes', () => {
  for (const chemin of [TARIFS]) {
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

/**
 * LA VÉRIFICATION DOIT TENIR DANS LE TEMPS QUE LA PLATEFORME ACCORDE.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 24 AOÛT 2026 ───────────────────────────────────
 *
 * Chaque analyse demandait un aller-retour vers la base, attendu avant de
 * passer à la suivante. Trois cents analyses faisaient donc trois cents
 * allers-retours en file indienne : plus de dix minutes, alors que la tâche
 * quotidienne dispose de cent vingt secondes.
 *
 * Elle était donc coupée en plein travail, chaque nuit, sans que rien ne le
 * signale. Relevé ce jour-là : 9 180 analyses, 2 329 vérifiées, 6 851 en
 * attente — un arriéré qui ne se résorbait jamais.
 *
 * Après correction : trois cents analyses en 11,6 secondes, cinquante fois
 * plus vite.
 */
test('★ ACQUIS — la vérification traite les analyses par paquets', () => {
  const src = lire('src/lib/precision-reelle.ts');

  assert.ok(
    /TAILLE_PAQUET/.test(src) && /Promise\.all\(/.test(src),
    'La vérification est revenue à un traitement une-par-une. Trois cents ' +
      "allers-retours en file indienne dépassent les cent vingt secondes que la " +
      'plateforme accorde : la tâche serait coupée en plein travail, chaque nuit.'
  );

  // La réserve doit garder la PROMESSE, pas la valeur : sinon dix analyses de
  // la même affiche lancées ensemble déclenchent dix appels au fournisseur.
  assert.ok(
    /Map<string, Promise</.test(src),
    "La réserve des résultats garde de nouveau la valeur et non la promesse. " +
      "En parallèle, dix analyses de la même affiche déclencheraient dix appels " +
      'au fournisseur — dont le quota est la ressource la plus rare du projet.'
  );
});
