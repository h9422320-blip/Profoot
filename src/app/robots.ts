import type { MetadataRoute } from 'next';

/**
 * Règles d'exploration pour les moteurs de recherche.
 *
 * On interdit les zones privées : les routes techniques, l'espace
 * d'administration et les pages accessibles seulement après connexion.
 * Les indexer ferait apparaître des écrans de connexion dans les résultats de
 * recherche, ce qui donne une mauvaise image et n'attire aucun client.
 */
const SITE_URL = 'https://profootai.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/analyze',
          '/competitions',
          '/expert',
          '/history',
          '/pricing',
          '/settings',
          '/matches',
          '/standings',
          '/stats',
          '/search',
          '/ia-center',
          '/club',
          '/match',
          '/payment-success',
          '/payment-failed',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
