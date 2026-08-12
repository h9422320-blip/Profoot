/**
 * Même aperçu pour X/Twitter que pour les autres réseaux : une seule image à
 * maintenir, donc aucun risque qu'elles finissent par se contredire.
 *
 * `runtime` doit être écrit ici littéralement : Next.js lit ce champ dans le
 * fichier lui-même et ne suit pas les réexportations.
 */
export const runtime = 'edge';
export { default, alt, size, contentType } from './opengraph-image';
