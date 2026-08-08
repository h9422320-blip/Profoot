import { timingSafeEqual } from 'crypto';

/** Nom du cookie déposé par le lien d'accès personnel à l'administration. */
export const COOKIE_ADMIN = 'pf_admin_key';

/**
 * Clé attendue, lue dans la configuration serveur.
 *
 * Renvoie `null` quand aucune clé n'est configurée : dans ce cas le verrou par
 * lien est simplement désactivé, et seule la vérification du compte
 * administrateur s'applique. Mieux vaut un verrou en moins qu'un administrateur
 * enfermé dehors par une variable oubliée.
 */
export function cleAdminAttendue(): string | null {
  const cle = process.env.ADMIN_ACCESS_KEY?.trim();
  return cle && cle.length >= 16 ? cle : null;
}

/**
 * Comparaison à durée constante : une comparaison naïve révèle, par le temps
 * qu'elle met à échouer, combien de caractères initiaux sont corrects.
 */
export function cleValide(fournie: string | undefined | null, attendue: string): boolean {
  if (!fournie) return false;
  const a = Buffer.from(fournie);
  const b = Buffer.from(attendue);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
