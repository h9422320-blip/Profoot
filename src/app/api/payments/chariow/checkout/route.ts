/**
 * ANCIENNE ADRESSE DE LA CAISSE — CONSERVÉE LE TEMPS DES PAGES EN CACHE.
 *
 * ── POURQUOI ELLE N'EST PAS SIMPLEMENT SUPPRIMÉE ──────────────────────────
 *
 * La caisse vit désormais sur « /api/paiement/caisse » : la vente est passée à
 * MakeTou le 28 août 2026 et plus rien ne doit porter le nom de l'ancienne
 * boutique.
 *
 * Mais une page déjà ouverte dans un navigateur, ou servie depuis le cache du
 * réseau, continue d'appeler l'ancienne adresse pendant des heures. La retirer
 * le jour du changement, c'est refuser de vendre à tous ceux qui n'ont pas
 * rechargé — précisément le jour où l'on vient de réparer la vente.
 *
 * Elle ne fait rien d'autre que passer le relais : il n'y a pas deux
 * comportements à maintenir, seulement deux portes vers le même.
 *
 * Elle pourra disparaître quand plus aucune requête ne l'atteindra.
 */
export { POST } from '@/app/api/paiement/caisse/route';
export const dynamic = 'force-dynamic';
