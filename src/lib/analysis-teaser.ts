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
  // L'aperçu proprement dit.
  'globalForm',
  'quickSummary',
  'scenario',
  'confidence',
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
export function toTeaser(data: Record<string, any>): TeaserResult {
  const teaser: Record<string, unknown> = {};

  for (const field of TEASER_FIELDS) {
    if (data[field] !== undefined) teaser[field] = data[field];
  }

  // Un seul scénario sur les trois : assez pour juger de la qualité, pas assez
  // pour se passer de l'abonnement.
  const scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
  if (scenarios.length > 0) teaser.scenarios = [scenarios[0]];

  return {
    ...teaser,
    locked: true,
    lockedScenarios: Math.max(0, scenarios.length - 1),
    lockedSections: Array.isArray(data.sections) ? data.sections.length : 0,
  } as TeaserResult;
}
