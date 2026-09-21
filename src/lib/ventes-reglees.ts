/**
 * LES VENTES RÉGLÉES AUTREMENT, ET POURQUOI.
 *
 * ── LE PROBLÈME QUE CETTE LISTE RÉSOUT ────────────────────────────────────
 *
 * Certaines ventes encaissées ne seront JAMAIS portées par un abonnement, et
 * c'est normal. Le 20 septembre 2026, adjanohounk paie deux fois : une fois
 * avec son adresse Gmail, qui n'ouvre rien parce que son compte ProFoot porte
 * son adresse iCloud, et une fois — six heures plus tard — avec la bonne. Le
 * propriétaire décide de lui prolonger son accès d'un mois sur son abonnement
 * existant, ce qui est la bonne façon de faire : l'application CUMULE les
 * quotas de tous les abonnements actifs, et une seconde ligne lui aurait donné
 * deux fois le nombre d'analyses du mois.
 *
 * Résultat : le premier paiement reste sans abonnement à son nom. Il ressort
 * donc chaque jour comme « payé, jamais servi ».
 *
 * ── POURQUOI CE BRUIT EST DANGEREUX, ET PAS SEULEMENT AGAÇANT ─────────────
 *
 * Une alerte qui se répète tous les jours pour une raison connue cesse d'être
 * lue. Le jour où un VRAI acheteur n'est pas servi, il apparaît au milieu des
 * cas déjà réglés, et personne ne le distingue. Une liste d'alertes qu'on
 * n'ouvre plus ne protège plus personne.
 *
 * ── CE QUE CETTE LISTE N'EST PAS ──────────────────────────────────────────
 *
 * Ce n'est pas un endroit où faire taire un cas gênant. Chaque entrée porte la
 * date, ce qui a été fait, et par quelle décision. Une vente ne s'ajoute ici
 * qu'APRÈS que l'acheteur a reçu ce qu'il a payé — jamais avant, jamais à la
 * place.
 */

export interface VenteReglee {
  /** Ce que l'acheteur a reçu, et par quelle décision. */
  raison: string;
  /** Le jour où le règlement a été fait. */
  le: string;
}

/**
 * Par identifiant de vente de la boutique.
 *
 * L'identifiant complet, jamais un préfixe : deux ventes peuvent partager
 * leurs huit premiers caractères, et une comparaison partielle ferait taire
 * l'alerte de quelqu'un d'autre.
 */
export const VENTES_REGLEES: ReadonlyMap<string, VenteReglee> = new Map([
  [
    'ae767b30-9241-48d0-a473-b2bbdb3c8200',
    {
      raison:
        'adjanohounk a payé deux fois le 20 septembre 2026 : 2 000 F à 11 h 37 avec son ' +
        'adresse Gmail (aucun compte à cette adresse), puis 2 000 F à 17 h 51 avec son ' +
        'adresse iCloud, qui est celle de son compte. Sur décision du propriétaire, son ' +
        'abonnement existant a été prolongé de trente jours — du 20 octobre au 19 novembre — ' +
        'au lieu de créer une seconde ligne, qui lui aurait doublé son quota d’analyses. ' +
        'Il en a été informé par courriel aux deux adresses.',
      le: '2026-09-21',
    },
  ],
]);

/** Cette vente a-t-elle été réglée autrement qu'en la rattachant ? */
export function venteReglee(saleId: string | null | undefined): VenteReglee | null {
  const id = String(saleId ?? '').trim();
  return id ? VENTES_REGLEES.get(id) ?? null : null;
}
