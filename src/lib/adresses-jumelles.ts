/**
 * QUAND L'ADRESSE QUI A PAYÉ N'EST PAS CELLE DU COMPTE.
 *
 * ── CE QUI EST ARRIVÉ À AMON, LE 29 AOÛT 2026 ─────────────────────────────
 *
 *   18 h 34  il crée son compte : essanamon231@gmail.com
 *   18 h 46  il paie 2 000 F — en tapant essanon231@gmail.com
 *   19 h 02  il revient se connecter sur son vrai compte : rien
 *   19 h 28  un avis d'une étoile arrive
 *
 * Douze minutes séparent la création de son compte du paiement. Entre les
 * deux, il a retapé son adresse à la main dans le formulaire de la boutique,
 * sur un téléphone, et il a perdu deux lettres.
 *
 * L'adresse qu'il a tapée N'EXISTE PAS : le serveur de Gmail répond
 * « 550 5.1.1 Address not found ». Aucun message ne pouvait donc lui parvenir,
 * ni celui de l'application, ni celui du fondateur. Et l'accès qu'on lui avait
 * ouvert l'attendait sur un compte auquel il n'aurait jamais accès.
 *
 * ── POURQUOI CE N'EST PAS UN CAS RARE ─────────────────────────────────────
 *
 * Deux acheteurs sur quatre, le même soir. Saliou avait payé avec
 * mbayesaliou2024@icloud.com alors que son compte était mbayesaliou2004 — un
 * chiffre d'écart. Retaper son adresse est le seul endroit du parcours où le
 * client peut se tromper sans que rien ne le lui dise.
 *
 * ── LA RÈGLE, ET POURQUOI ELLE EST SERRÉE ─────────────────────────────────
 *
 * Ouvrir un accès payé sur le compte de quelqu'un d'autre serait pire que le
 * problème qu'on répare. Quatre conditions, toutes obligatoires :
 *
 *   • même domaine — un @gmail et un @icloud n'appartiennent pas au même
 *     doigt qui glisse ;
 *   • au plus deux caractères d'écart sur la partie avant l'arobase ;
 *   • une partie locale d'au moins six caractères — sur « ali@ » et « ela@ »,
 *     deux caractères d'écart ne veulent plus rien dire ;
 *   • UNE SEULE candidate. Deux comptes également proches, et l'on ne sait
 *     pas lequel est le bon : on préfère alors ne rien faire.
 */

/**
 * Distance d'édition, arrêtée dès qu'elle dépasse le plafond.
 *
 * Le calcul complet est inutile ici : on ne veut pas savoir si deux adresses
 * sont à quinze caractères l'une de l'autre, seulement si elles sont à deux ou
 * moins. S'arrêter tôt évite de parcourir six mille comptes en entier.
 */
export function distance(a: string, b: string, plafond = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > plafond) return plafond + 1;

  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const courante = [i];
    let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(
        courante[j - 1] + 1, // insertion
        precedente[j] + 1, // suppression
        precedente[j - 1] + cout // substitution
      );
      courante.push(v);
      if (v < minimum) minimum = v;
    }
    // Toute la ligne dépasse déjà le plafond : le résultat final aussi.
    if (minimum > plafond) return plafond + 1;
    precedente = courante;
  }

  return precedente[b.length];
}

/** Ce qu'on sait d'un compte, pour décider s'il peut être la jumelle. */
export interface CompteConnu {
  email: string;
  id: string;
  /** Un compte qui a déjà un accès payé n'est pas celui qu'on cherche. */
  aUnAccesActif: boolean;
  /** Créé APRÈS la vente, il ne peut pas être celui de l'acheteur d'alors. */
  creeLe: string;
}

/** Le plus petit nombre de caractères avant l'arobase pour oser comparer. */
const LOCALE_MINIMALE = 6;

/**
 * Cherche l'unique compte dont l'adresse ne diffère que par une faute de
 * frappe. Rend `null` dès qu'il y a le moindre doute.
 */
export function jumelleProbable(
  adressePayee: string,
  comptes: CompteConnu[],
  avantLe?: string
): CompteConnu | null {
  const paye = adressePayee.trim().toLowerCase();
  const at = paye.lastIndexOf('@');
  if (at < LOCALE_MINIMALE) return null;

  const localePayee = paye.slice(0, at);
  const domainePaye = paye.slice(at + 1);

  const candidates: CompteConnu[] = [];
  for (const c of comptes) {
    const email = c.email.trim().toLowerCase();
    if (email === paye) return null; // L'adresse existe : rien à deviner.
    if (c.aUnAccesActif) continue;

    const k = email.lastIndexOf('@');
    if (k < LOCALE_MINIMALE) continue;
    if (email.slice(k + 1) !== domainePaye) continue;

    // Un compte créé après la vente n'est pas celui de l'acheteur d'alors :
    // ce serait un homonyme arrivé depuis.
    if (avantLe && c.creeLe && c.creeLe > avantLe) continue;

    if (distance(localePayee, email.slice(0, k), 2) <= 2) {
      candidates.push(c);
      // Deux candidates suffisent à renoncer : inutile de continuer.
      if (candidates.length > 1) return null;
    }
  }

  return candidates.length === 1 ? candidates[0] : null;
}
