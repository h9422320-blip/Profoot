'use client';

/**
 * LA BARRIÈRE DE L'ESPACE ABONNÉ.
 *
 * Posée sur le segment `(dashboard)`, elle entoure l'analyse, l'historique,
 * les classements, les fiches de club, les preuves et le paiement. Le gabarit
 * reste rendu AU-DESSUS d'elle : la barre latérale et la navigation restent
 * en place, et seul le contenu central porte le message.
 *
 * Avant elle, une lecture de base qui abandonnait sur une fiche de club
 * emportait l'application entière — voir `EcranErreurSegment`.
 */

import EcranErreurSegment, { type ProprietesErreurSegment } from '@/components/EcranErreurSegment';

export default function ErreurEspaceAbonne(props: ProprietesErreurSegment) {
  return <EcranErreurSegment {...props} />;
}
