'use client';

/**
 * LA BARRIÈRE DES PAGES PUBLIQUES.
 *
 * Accueil, tarifs, connexion, inscription, mentions légales, assistance : tout
 * ce qui ne vit pas dans l'espace abonné. Ce sont les pages que voit quelqu'un
 * qui n'a pas encore payé — une page noire à cet endroit ne coûte pas un
 * client mécontent, elle coûte une vente.
 *
 * Elle rend à l'intérieur du gabarit racine, qui reste donc en place.
 * `global-error.tsx` demeure au-dessus pour le seul cas qu'elle ne peut pas
 * couvrir : une panne du gabarit racine lui-même.
 */

import EcranErreurSegment, { type ProprietesErreurSegment } from '@/components/EcranErreurSegment';

export default function ErreurPagePublique(props: ProprietesErreurSegment) {
  return <EcranErreurSegment {...props} titre="Cette page n’a pas pu s’afficher" />;
}
