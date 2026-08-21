/**
 * Découpe de l'analyse pour les comptes sans abonnement.
 *
 * Le teaser doit être construit ICI, côté serveur. Envoyer l'analyse entière
 * puis la flouter dans le navigateur ne protège rien : le contenu payant est
 * déjà arrivé chez le visiteur, qui n'a qu'à ouvrir les outils de développement
 * ou retirer une classe CSS pour tout lire.
 *
 * Ce qui reste visible correspond exactement à ce que l'interface affiche
 * au-dessus du paywall — l'aperçu qui donne envie de s'abonner.
 */

/** Champs autorisés pour un compte gratuit. Tout le reste est retiré. */
const TEASER_FIELDS = [
  // Contexte du match : informations publiques, jamais payantes.
  'competition',
  'date',
  'time',
  'venue',
  'venueCity',
  'isFinished',
  'team1',
  'team2',
  'fixtureId',
  'status',
  // Rencontre déjà jouée : le score et la chronologie sont des faits publics.
  'score',
  'events',
  // Match en cours : le score, la minute et les buteurs sont publics — Google
  // les affiche. Les cacher n aurait fait fuir personne vers l abonnement.
  // La projection de l issue finale, elle, n est PAS dans cette liste : c est
  // une prediction, donc du contenu payant.
  'live',
  'enDirect',
  // L'aperçu proprement dit : la forme récente, et rien d'autre.
  //
  // ── CE QUI A ÉTÉ RETIRÉ D'ICI LE 21 AOÛT 2026, ET POURQUOI ───────────────
  //
  // Cette liste autorisait `quickSummary`, `scenario` et `confidence`. Ces
  // trois champs DONNENT LA RÉPONSE :
  //
  //   quickSummary — « Les buts attendus penchent vers Olympique de Marseille :
  //                   1.9 contre 1.36 ». Le favori et les buts attendus, en
  //                   une phrase.
  //   scenarios[0] — « ...un deuxième but de Courtois (penalty) scelle la
  //                   victoire 2-1 ». Le score final, les buteurs, les minutes.
  //   confidence   — la jauge et son libellé « Très élevée ».
  //
  // Un visiteur avait donc l'analyse entière sans payer. Les ventes se sont
  // arrêtées net.
  //
  // Ils sont remplacés par `apercu` : une bande-annonce composée à partir des
  // mêmes données de forme, spécifique à chaque affiche, équilibrée entre les
  // deux équipes, et qui ne peut structurellement pas révéler le verdict —
  // aucune de ces valeurs n'entre dans sa composition.
  'globalForm',
] as const;

export interface TeaserResult {
  locked: true;
  /** Nombre de scénarios réservés aux abonnés, pour l'annoncer honnêtement. */
  lockedScenarios: number;
  /** Nombre de sections d'analyse détaillée réservées aux abonnés. */
  lockedSections: number;
  [key: string]: unknown;
}

/**
 * Ne conserve que l'aperçu gratuit. Les probabilités, le score prédit, les
 * métriques avancées, les points forts, la comparaison et les sections
 * détaillées ne quittent jamais le serveur pour un compte non abonné.
 */
/**
 * Nombre de sections que comporte une analyse complète.
 *
 * L'aperçu annonce au visiteur combien de sections l'abonnement débloque. Ce
 * décompte se lisait sur les sections réellement présentes — ce qui marchait
 * tant que l'analyse complète était générée pour tout le monde, puis jetée.
 * Depuis qu'un compte gratuit ne fait plus rédiger ces sections, le décompte
 * serait tombé à zéro : l'aperçu aurait annoncé « 0 section réservée », soit
 * exactement l'inverse de l'argument de vente.
 *
 * Le chiffre est donc une constante, et il est exact : la structure demandée
 * au modèle pour une analyse complète contient toujours ces sept sections.
 */
const SECTIONS_ANALYSE_COMPLETE = 7;

/**
 * Devenue asynchrone le 21 août 2026 : la bande-annonce est désormais rédigée
 * par le modèle le moins cher, une seule fois par match, puis relue en réserve.
 * Le gabarit reste le filet — il sert si le modèle est absent, trop lent, ou
 * si son texte trahit le verdict.
 */
export async function toTeaser(data: Record<string, any>): Promise<TeaserResult> {
  const teaser: Record<string, unknown> = {};

  for (const field of TEASER_FIELDS) {
    if (data[field] !== undefined) teaser[field] = data[field];
  }

  // ── PLUS AUCUN SCÉNARIO N'EST SERVI ─────────────────────────────────────
  //
  // Le premier des trois était offert : « assez pour juger de la qualité, pas
  // assez pour se passer de l'abonnement ». C'était faux. Un scénario nomme le
  // buteur, la minute, et finit par le score — « scelle la victoire 2-1 ».
  // Offrir le premier, c'était offrir la réponse et garder l'emballage.
  //
  // On annonce leur nombre, on n'en montre aucun.
  const scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];

  // La bande-annonce. Le modèle ne reçoit QUE la forme et les buts : ni score,
  // ni probabilités, ni confiance, ni scénarios n'entrent dans son prompt. On
  // ne peut pas divulguer ce qu'on n'a pas transmis — c'est la protection
  // principale, le prompt n'étant que la seconde.
  const { obtenirApercu } = await import('./apercu-ia');
  const apercu = await obtenirApercu(
    data?.team1?.name ?? data?.team1 ?? '',
    data?.team2?.name ?? data?.team2 ?? '',
    data?.globalForm?.team1,
    data?.globalForm?.team2
  );
  teaser.apercu = apercu.texte;

  return {
    ...teaser,
    locked: true,
    lockedScenarios: scenarios.length || 3,
    // Les sections présentes si l'analyse complète a été générée (elle peut
    // provenir du cache) ; sinon le nombre qu'un abonnement débloquerait.
    lockedSections: Array.isArray(data.sections) && data.sections.length > 0
      ? data.sections.length
      : SECTIONS_ANALYSE_COMPLETE,
  } as TeaserResult;
}
