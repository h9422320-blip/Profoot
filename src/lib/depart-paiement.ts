/**
 * PARTIR PAYER SANS PERDRE LE CHEMIN DU RETOUR.
 *
 * ── LE PROBLÈME QUE ÇA RÉSOUT ─────────────────────────────────────────────
 *
 * Chariow revenait sur ProFoot tout seul après le paiement : on lui donnait une
 * adresse de retour, il y renvoyait l'acheteur, et la page d'attente ouvrait
 * l'analyse dès que l'accès arrivait.
 *
 * MakeTou n'a pas ce réglage — vérifié dans l'éditeur du produit le 28 août
 * 2026, il n'existe aucun champ de redirection. Laissé tel quel, l'acheteur
 * finit son paiement sur la boutique et doit retaper « profootai.com » de
 * mémoire pour trouver ce qu'il vient d'acheter. C'est exactement le pas de
 * trop qui a fait écrire des clients : « j'ai payé, et maintenant ? »
 *
 * ── LE CHEMIN RETENU ──────────────────────────────────────────────────────
 *
 * La boutique s'ouvre dans un SECOND onglet, et celui de ProFoot reste ouvert
 * sur la page d'attente. Quand l'acheteur revient — en fermant l'onglet de la
 * boutique, ou simplement en changeant d'onglet — la page d'attente le voit
 * revenir, constate que l'accès est ouvert, et l'emmène sur son analyse. Le
 * retour est donc automatique de notre côté, faute de pouvoir l'être du leur.
 *
 * L'onglet doit être ouvert PENDANT le clic, avant tout appel réseau : un
 * navigateur bloque une fenêtre ouverte après coup, la prenant pour une
 * publicité. D'où l'onglet vide ouvert d'abord, rempli ensuite.
 *
 * Et si le navigateur le bloque quand même — certains téléphones le font —, on
 * part dans l'onglet courant comme avant. L'acheteur paiera ; il lui manquera
 * seulement le retour automatique.
 */

/** Ouvre l'onglet qui recevra la caisse. À appeler DANS le gestionnaire de clic. */
export function reserverOngletPaiement(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.open('', '_blank');
  } catch {
    return null;
  }
}

/**
 * Envoie l'acheteur vers la caisse et place ProFoot en attente.
 *
 * `onglet` est celui réservé au clic. `attente` est l'adresse de la page qui
 * guette l'ouverture de l'accès.
 */
export function partirPayer(
  onglet: Window | null,
  caisse: string,
  attente: string
): void {
  if (onglet && !onglet.closed) {
    onglet.location.href = caisse;
    window.location.href = attente;
    return;
  }
  // Onglet refusé par le navigateur : on garde le comportement d'avant plutôt
  // que d'immobiliser quelqu'un qui voulait payer.
  window.location.href = caisse;
}

/** Referme l'onglet réservé quand le paiement ne peut finalement pas partir. */
export function libererOnglet(onglet: Window | null): void {
  try {
    if (onglet && !onglet.closed) onglet.close();
  } catch {
    /* Un onglet qu'on ne peut pas fermer n'empêche rien. */
  }
}
