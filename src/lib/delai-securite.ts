/**
 * UNE BASE LENTE NE DOIT JAMAIS TUER LE SITE.
 *
 * ── LA NUIT DU 25 AOÛT 2026 ───────────────────────────────────────────────
 *
 * Le serveur Supabase a saturé : processeur à 100 %, requêtes refusées. Ce qui
 * s'est passé ensuite n'était pas inévitable — c'était un défaut de notre côté.
 *
 * Aucun appel à la base ne portait de délai. Une page qui demandait les tarifs
 * attendait donc la réponse SANS LIMITE. Mesuré en production cette nuit-là :
 *
 *     /pricing   DÉPASSEMENT 30 s
 *     /matches   DÉPASSEMENT 30 s
 *     /preuves   6,4 s
 *
 * Le site n'était pas cassé. Il ATTENDAIT. Et pendant qu'il attendait, chaque
 * visiteur occupait un serveur, ce qui aggravait la saturation — un cercle qui
 * se referme sur lui-même.
 *
 * ── CE QUE FAIT CE FICHIER ────────────────────────────────────────────────
 *
 * Il donne à chaque appel une limite de temps et une porte de sortie. Passé le
 * délai, on cesse d'attendre et on rend une valeur de repli : le cache d'hier,
 * une liste vide, les réglages par défaut. La page s'affiche, incomplète mais
 * VIVANTE.
 *
 * Une page qui affiche des tarifs d'hier vaut infiniment mieux qu'une page qui
 * ne s'affiche pas. Un visiteur qui voit un écran blanc pendant trente secondes
 * ne revient pas ; un visiteur qui voit une page un peu ancienne ne s'en rend
 * même pas compte.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────
 *
 * Il n'empêche pas la base de tomber. Il empêche la chute de la base
 * d'emporter le site avec elle. C'est une ceinture de sécurité, pas un frein.
 */

/** Ce qui s'est réellement passé, pour le journal. */
type Issue = 'repondu' | 'delai' | 'erreur';

/**
 * Attend un travail, mais pas éternellement.
 *
 * @param travail  La promesse à surveiller — typiquement une lecture en base.
 * @param ms       Le temps au-delà duquel on renonce.
 * @param repli    Ce qu'on rend quand on renonce, ou quand le travail échoue.
 * @param nom      Nom lisible, pour retrouver la ligne dans le journal.
 *
 * Ne lève jamais d'exception : c'est tout l'intérêt. L'appelant reçoit toujours
 * une valeur utilisable, et n'a pas à envelopper chaque appel dans un `try`.
 */
export async function avecDelai<T>(
  travail: PromiseLike<T>,
  ms: number,
  repli: T,
  nom = 'lecture'
): Promise<T> {
  const debut = Date.now();
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  let issue: Issue = 'repondu';

  // Le constructeur de requête de Supabase est « attendable » sans être une
  // vraie promesse : il possède un `then`, mais ni `catch` ni `finally`. Or
  // `Promise.race` et `.catch` en ont besoin. On le normalise donc ici, une
  // seule fois, plutôt qu'à chaque appel dans le reste du code.
  const promesse = Promise.resolve(travail);

  const sentinelle = new Promise<typeof MARQUEUR_DELAI>((resolve) => {
    minuteur = setTimeout(() => resolve(MARQUEUR_DELAI), ms);
  });

  try {
    const resultat = await Promise.race([promesse, sentinelle]);

    if (resultat === MARQUEUR_DELAI) {
      issue = 'delai';
      // ── POURQUOI ON NE COUPE PAS LE TRAVAIL EN COURS ──────────────────
      //
      // On cesse de l'ATTENDRE ; on ne l'annule pas. La requête ira au bout
      // de son côté et remplira le cache, ce qui accélérera la visite
      // suivante. L'annuler ne libérerait rien côté base — la requête y est
      // déjà partie — et priverait le cache de son résultat.
      //
      // La promesse abandonnée doit tout de même être consommée, sans quoi
      // un rejet plus tard ferait tomber le processus entier.
      void promesse.catch(() => undefined);
      return repli;
    }

    return resultat as T;
  } catch {
    issue = 'erreur';
    return repli;
  } finally {
    if (minuteur) clearTimeout(minuteur);
    // On ne journalise QUE les incidents. Une ligne par lecture réussie
    // noierait le journal — et c'est précisément ce qui nous a empêchés de
    // voir les 332 erreurs par heure de `app_settings`.
    if (issue !== 'repondu') {
      console.warn(`[DÉLAI] ${nom} : ${issue} après ${Date.now() - debut} ms — repli servi.`);
    }
  }
}

/**
 * Marqueur interne du dépassement.
 *
 * Un `Symbol` plutôt que `null` ou `undefined` : une lecture peut légitimement
 * rendre `null`, et on confondrait alors « la base a répondu, il n'y a rien »
 * avec « la base n'a pas répondu ». Aucune valeur métier ne peut être égale à
 * ce symbole.
 */
const MARQUEUR_DELAI = Symbol('delai-depasse');

/**
 * Les délais retenus, en un seul endroit pour qu'ils restent cohérents.
 *
 * Ils sont volontairement COURTS. Une lecture qui met plus de deux secondes est
 * déjà perdue pour le visiteur : la moitié des gens auront quitté la page. Le
 * repli sert mieux le site que l'attente.
 */
export const DELAIS = {
  /**
   * Le middleware s'exécute sur CHAQUE requête. Un seul appel lent y bloque
   * tout le site — c'est le chemin le plus critique de l'application, et il
   * mérite le délai le plus serré.
   */
  middleware: 1_500,

  /** Contenu d'une page publique : tarifs, matchs, preuves. */
  page: 2_500,

  /** Lecture d'appoint, dont l'absence ne prive personne de l'essentiel. */
  secondaire: 1_500,
} as const;
