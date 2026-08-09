/**
 * Modèles Gemini, essayés dans cet ordre.
 *
 * En formule gratuite, le quota journalier n'est pas global : il est compté
 * PAR MODÈLE (`GenerateRequestsPerDayPerProjectPerModel`). Vérifié sur la clé
 * du projet : un modèle renvoyait 429 pendant que les deux autres répondaient
 * normalement.
 *
 * Quand le premier modèle est à court, on bascule donc sur le suivant plutôt
 * que de servir un texte de secours générique. Les modèles sont classés du
 * plus capable au plus léger : la qualité ne baisse qu'une fois le quota du
 * précédent réellement épuisé.
 *
 * Cette liste reste utile une fois la facturation activée : elle sert alors
 * de filet en cas d'incident sur un modèle.
 */
export const MODELES_GEMINI = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
];

/** Reconnaît un dépassement de quota, seul cas où basculer de modèle a un sens. */
export function estQuotaEpuise(erreur: any): boolean {
  const message = String(erreur?.message ?? erreur ?? '');
  return (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    /quota/i.test(message)
  );
}

/**
 * Exécute `action` avec chaque modèle jusqu'à ce que l'un réponde.
 *
 * Seul un quota épuisé déclenche la bascule : une autre erreur (prompt
 * invalide, panne réseau) se reproduirait à l'identique sur les autres
 * modèles et doit remonter immédiatement.
 */
export async function avecBasculeDeModele<T>(
  action: (modele: string) => Promise<T>
): Promise<T> {
  let derniereErreur: any;

  for (const modele of MODELES_GEMINI) {
    try {
      return await action(modele);
    } catch (erreur: any) {
      derniereErreur = erreur;
      if (!estQuotaEpuise(erreur)) throw erreur;
      console.warn(`[GEMINI] Quota épuisé sur ${modele} — bascule sur le modèle suivant.`);
    }
  }

  throw derniereErreur;
}
