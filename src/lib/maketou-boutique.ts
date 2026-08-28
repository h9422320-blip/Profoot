/**
 * OÙ ENVOYER QUELQU'UN QUI VEUT ACHETER.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Le 27 août 2026, Chariow a fermé la boutique. Vérifié le lendemain :
 * `GET /v1/products` y répond « 200, data: [] » et le produit Essentiel rend
 * un 404. Le bouton d'achat de ProFoot appelait donc une caisse vide — plus
 * personne ne pouvait payer, et la page affichait une erreur.
 *
 * La vente passe désormais par MakeTou. Le chemin est différent de l'ancien :
 * Chariow créait une caisse à la demande, avec l'identité de l'acheteur
 * dedans ; MakeTou a une page produit fixe, publique, la même pour tout le
 * monde. C'est elle qu'on ouvre.
 *
 * ── CE QUE ÇA CHANGE POUR LE RATTACHEMENT ─────────────────────────────────
 *
 * Chariow nous renvoyait un identifiant de vente AVANT le paiement, qu'on
 * notait pour savoir qui achetait quoi. Ici, il n'y a rien à noter à l'aller :
 * c'est l'ADRESSE E-MAIL saisie sur la page de paiement qui relie la vente au
 * compte, au retour, quand le pulse arrive. D'où l'insistance, sur la page des
 * offres et dans le guide remis à l'achat, à payer avec l'adresse du compte.
 *
 * ── LES LIENS VIVENT ICI, PAS DANS DIX FICHIERS ───────────────────────────
 *
 * Une variable d'environnement peut remplacer chacun d'eux sans toucher au
 * code. Le repli écrit en clair n'est pas un secret : c'est une adresse
 * publique, imprimée sur la boutique.
 */

import type { PlanKey } from './subscription';

/** L'adresse publique de chaque offre sur la boutique MakeTou. */
export function lienMaketou(plan: PlanKey): string | null {
  const liens: Partial<Record<PlanKey, string | undefined>> = {
    essential_monthly:
      process.env.MAKETOU_LIEN_ESSENTIEL ||
      'https://profoot.mymaketou.shop/fr/products/profoot-ai-acces-essentiel-30-jours',
    // Publiés le 28 août 2026, adresses vérifiées une à une : chacune répond
    // 200, porte le bon nom de produit et le bon prix. Une adresse devinée
    // renverrait l'acheteur sur une page d'erreur, ce qui est pire qu'un
    // bouton qui refuse honnêtement.
    pro_monthly:
      process.env.MAKETOU_LIEN_PRO ||
      'https://profoot.mymaketou.shop/fr/products/profoot-ai-acces-pro-30-jours',
    vip_yearly:
      process.env.MAKETOU_LIEN_VIP ||
      'https://profoot.mymaketou.shop/fr/products/profoot-ai-acces-vip-1-an',
  };

  const lien = liens[plan];
  return lien && /^https:\/\//.test(lien) ? lien : null;
}

/** La boutique est-elle en mesure de vendre cette offre aujourd'hui ? */
export function offreEnVente(plan: PlanKey): boolean {
  return lienMaketou(plan) !== null;
}
