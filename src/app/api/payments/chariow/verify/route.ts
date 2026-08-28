/**
 * ANCIENNE ADRESSE DE LA VÉRIFICATION — CONSERVÉE LE TEMPS DES PAGES EN CACHE.
 *
 * La vérification vit désormais sur « /api/paiement/verification ». Une page
 * d'attente déjà ouverte dans un navigateur continue d'appeler celle-ci
 * pendant plusieurs minutes : c'est exactement quelqu'un qui vient de payer et
 * qui guette son accès. Lui répondre « adresse inconnue » à cet instant-là
 * serait le pire moment possible.
 *
 * Elle passe le relais, sans rien maintenir en double.
 */
export { POST } from '@/app/api/paiement/verification/route';
export const dynamic = 'force-dynamic';
