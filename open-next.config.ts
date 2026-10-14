/**
 * Traduction de la construction Next.js vers un worker Cloudflare.
 *
 * Rien n'est surchargé pour l'instant : pas de cache partagé entre instances.
 * Les pages à revalidation (la page d'accueil, par exemple) gardent donc leur
 * cache par instance. C'est volontaire — le cache partagé demande un seau R2,
 * qui n'existe pas encore sur le compte. À brancher plus tard si la page
 * d'accueil se met à diverger d'une visite à l'autre.
 */
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
