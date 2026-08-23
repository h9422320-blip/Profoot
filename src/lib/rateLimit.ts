/**
 * LIMITE DE DÉBIT EN MÉMOIRE — POUR LE BRUIT, PAS POUR L'ARGENT.
 *
 * ── CE QU'ELLE VAUT VRAIMENT ──────────────────────────────────────────────
 *
 * Les compteurs vivent dans un `Map`, en mémoire. Sur Vercel, chaque requête
 * peut atterrir sur une instance différente, et chaque instance a sa propre
 * mémoire : « quarante par minute » devient quarante par minute PAR INSTANCE.
 * Le serveur redémarre aussi plusieurs fois par heure, ce qui remet tout à
 * zéro.
 *
 * Autrement dit : cette limite freine le bruit, elle n'arrête pas une attaque.
 *
 * ── POURQUOI ELLE RESTE, MALGRÉ TOUT ──────────────────────────────────────
 *
 * Elle ne protège plus rien de coûteux. Les deux routes où un abus coûte de
 * l'argent réel — l'analyse et l'Agent VIP — sont passées à
 * `limite-partagee.ts`, qui compte en base et vaut pour toutes les instances.
 *
 * Les quatre routes qui l'utilisent encore — `fixtures`, `search`,
 * `standings`, `competitions/live` — servent des données football. On aurait
 * pu les basculer aussi ; on ne l'a pas fait, et c'est délibéré :
 *
 *   • LEUR QUOTA EST DÉJÀ PROTÉGÉ AILLEURS. `apiFootball()` lit la réserve
 *     avant d'appeler le fournisseur. Mille requêtes identiques ne consomment
 *     qu'un seul appel : c'est le cache qui garde le quota, pas ce compteur.
 *   • LEUR CLÉ EST UNE ADRESSE IP, qu'un attaquant change en une seconde. Une
 *     limite plus stricte ne l'arrêterait pas davantage.
 *   • ÉCRIRE EN BASE À CHAQUE APPEL COÛTERAIT PLUS QUE ÇA NE PROTÈGE. À
 *     quarante requêtes par minute et par visiteur, on ajouterait des milliers
 *     d'écritures par minute pour freiner ce que le cache absorbe déjà.
 *
 * ── LA RÈGLE, POUR LA SUITE ───────────────────────────────────────────────
 *
 * Si une route dépense de l'argent — un modèle d'IA, un envoi, un paiement —
 * elle utilise `limite-partagee.ts`. Ce module-ci ne convient qu'aux routes
 * dont l'abus ne coûte qu'un peu de calcul.
 */

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
 * Cache borné : au-delà de `maxSize` entrées, les plus anciennes sont évincées.
 * Les clés étant dérivées d'entrées utilisateur, un cache sans plafond peut
 * être gonflé jusqu'à saturer la mémoire du serveur.
 */
export function setBounded(cache: Map<string, any>, key: string, value: any, maxSize = 500) {
  // Rafraîchir une clé existante ne doit évincer personne.
  if (!cache.has(key) && cache.size >= maxSize) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
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
  // ── DERRIÈRE CLOUDFLARE, `x-vercel-forwarded-for` DÉSIGNE CLOUDFLARE ──────
  //
  // Depuis le 19 août 2026 le domaine passe par Cloudflare. L'adresse que
  // Vercel inscrit est celle du relais, pas celle du visiteur : tous les
  // utilisateurs d'un même point de présence — donc toute l'Afrique de l'Ouest,
  // qui passe par Londres — partageaient un SEUL compteur de limitation. Il
  // suffisait qu'une personne s'active pour que les autres soient refusées.
  //
  // `cf-connecting-ip` est posé par Cloudflare lui-même et écrase toute valeur
  // que le client aurait tenté d'y mettre : il est aussi peu falsifiable que
  // l'en-tête Vercel, et il désigne la bonne personne.
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

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
    // Première requête ou la fenêtre de temps a expiré (réinitialisation).
    // Ce cache est le seul dont les clés viennent du réseau : il doit être
    // borné, sinon un attaquant peut le gonfler entre deux passes de nettoyage.
    if (!rateLimiterCache.has(key) && rateLimiterCache.size >= 10000) {
      cleanupCache();
      if (rateLimiterCache.size >= 10000) {
        const oldest = rateLimiterCache.keys().next();
        if (!oldest.done) rateLimiterCache.delete(oldest.value);
      }
    }
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
