'use client';

import { useEffect } from 'react';

/**
 * DIT AU FILET DE SÉCURITÉ QUE L'APPLICATION EST BIEN PARTIE.
 *
 * LE DÉFAUT QU'IL CORRIGE, ET C'ÉTAIT LE MIEN
 *
 * Le filet posé le 18 août rendait le contenu visible quand le petit script en
 * tête de page ne s'exécutait pas. Sauf que ce script-là est écrit en
 * JavaScript de 2015 : il ne rate jamais. Ce qui rate, c'est React — le gros
 * fichier, celui qui peut être trop lourd, trop lent, ou refusé par un vieux
 * navigateur.
 *
 * Résultat : le script posait `js-ok`, les sections passaient en `opacity: 0`
 * en attendant d'être révélées au défilement, React ne démarrait pas, et rien
 * n'était jamais révélé. Le filet ne rattrapait pas le seul cas pour lequel il
 * avait été construit.
 *
 * COMMENT ON S'EN SORT
 *
 * Ce composant ne rend rien. Il pose simplement une marque quand React a
 * réellement pris la main. Le script en tête de page attend quatre secondes :
 * sans marque, il retire `js-ok` et tout le contenu redevient visible.
 *
 * Quatre secondes : assez pour une connexion mobile lente qui finit par
 * aboutir, assez court pour que personne ne reste devant un écran vide.
 */
export default function SignalReact() {
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-react-ok', '1');
    } catch {
      /* rien à faire : le filet se déclenchera, et c'est très bien ainsi */
    }
  }, []);

  return null;
}
