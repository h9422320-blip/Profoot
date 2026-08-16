import type { MetadataRoute } from 'next';

/**
 * Plan du site : la liste des pages que Google doit connaître.
 *
 * Sans ce fichier, le moteur devait deviner la structure en suivant les liens
 * — et les pages accessibles uniquement après connexion restaient invisibles.
 * Seules les pages PUBLIQUES y figurent : indexer une page privée n'apporte
 * rien et affiche un écran de connexion dans les résultats de recherche.
 */
const SITE_URL = 'https://profootai.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    // Le mur de preuves est PUBLIC et c'est la seule page qui porte du contenu
    // renouvelé : des pronostics datés confrontés à de vrais résultats. Il
    // était accessible mais absent d'ici, donc laissé à la découverte au
    // hasard. C'est pourtant la page qui distingue ce site de ses concurrents.
    { url: `${SITE_URL}/preuves`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/cgv`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
