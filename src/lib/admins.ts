/**
 * Qui a accès à l'administration.
 *
 * SOURCE UNIQUE
 *
 * Cette adresse était recopiée dans quatorze fichiers : le gabarit, le
 * portier de requêtes, chaque action serveur, les modules de statistiques.
 * Ajouter un administrateur demandait de tous les retrouver — et en oublier un
 * seul laisse un accès à moitié ouvert : une porte fermée à l'entrée, une autre
 * restée déverrouillée sur le côté.
 *
 * Tout contrôle d'accès à l'administration passe désormais par ici.
 *
 * LA COMPARAISON SE FAIT EN MINUSCULES
 *
 * Une adresse saisie « Traoreismaela753@gmail.com » à l'inscription est la même
 * que « traoreismaela753@gmail.com ». Comparer sans normaliser refuserait
 * l'accès à quelqu'un d'autorisé, à cause d'une majuscule — une panne
 * incompréhensible pour la personne qui la subit.
 *
 * CE QUE DONNE CET ACCÈS
 *
 * Tout : la liste des comptes, les paiements, les prix, les partenaires, les
 * accès offerts, le mode maintenance. Il n'y a pas de demi-administrateur.
 * N'ajouter ici que des personnes à qui l'on confierait les clés de la caisse.
 */

/** Adresses autorisées, en minuscules. */
export const ADMIN_EMAILS: readonly string[] = [
  'h9422320@gmail.com', // Fondateur
  'traoreismaela753@gmail.com', // Kader — ajouté le 16/08/2026
];

/**
 * Cette adresse a-t-elle l'accès administrateur ?
 *
 * Tolère l'absence d'adresse et les espaces autour : une valeur nulle ou mal
 * formée doit refuser l'accès, jamais faire tomber la page qui pose la
 * question.
 */
export function estAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalise = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalise);
}
