// Rate Limiting Anti-Spam - ProFoot AI
// Protège les ressources de l'Agent IA contre les requêtes excessives.

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

const rateLimiterCache = new Map<string, RateLimitTracker>();

/**
 * Nettoie le cache pour éviter les fuites de mémoire.
 * On supprime les entrées qui ont dépassé leur date de reset.
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of rateLimiterCache.entries()) {
    if (value.resetAt < now) {
      rateLimiterCache.delete(key);
    }
  }
}

// Nettoyage périodique toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 5 * 60 * 1000);
}

/**
 * Identifie l'appelant de façon non falsifiable.
 *
 * `x-forwarded-for` est une liste "client, proxy1, proxy2…" à laquelle un
 * attaquant peut préfixer ce qu'il veut ; seule la valeur ajoutée par
 * l'hébergeur fait foi. Sur Vercel, `x-vercel-forwarded-for` contient l'IP
 * réelle et n'est pas modifiable par le client. À défaut, on prend la DERNIÈRE
 * entrée de `x-forwarded-for` (celle écrite par le proxy le plus proche) plutôt
 * que la première, qui est sous contrôle de l'attaquant.
 */
export function clientIp(req: Request): string {
  const vercelIp = req.headers.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0].trim();

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown-ip';
}

/**
 * Vérifie si l'utilisateur (ou l'IP) a dépassé sa limite de requêtes.
 * @param identifier Identifiant unique (ex: User ID ou Adresse IP)
 * @param action L'action effectuée (ex: 'analyze' ou 'agent')
 * @param maxRequests Le nombre maximum de requêtes autorisées par fenêtre
 * @param windowMs La fenêtre de temps en millisecondes
 * @returns boolean - true si la limite est dépassée (bloqué), false si c'est autorisé
 */
export function isRateLimited(
  identifier: string | null,
  action: string,
  maxRequests: number,
  windowMs: number = 60 * 1000 // 1 minute par défaut
): boolean {
  if (!identifier) {
    // Si on n'arrive pas à identifier l'utilisateur, on utilise une clé fallback générique
    // pour au moins limiter le spam global si nécessaire, mais on l'évite autant que possible.
    identifier = 'anonymous';
  }

  const key = `${action}_${identifier}`;
  const now = Date.now();
  const record = rateLimiterCache.get(key);

  if (!record || record.resetAt < now) {
    // Première requête ou la fenêtre de temps a expiré (réinitialisation)
    rateLimiterCache.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    // Limite atteinte
    return true;
  }

  // Incrémenter le compteur
  record.count += 1;
  return false;
}
