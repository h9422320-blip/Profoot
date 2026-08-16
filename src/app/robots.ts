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
        // Ne sont interdits que les chemins qui n'ont rien à faire dans un
        // moteur de recherche : le produit payant, les espaces personnels, et
        // les pages qui affichent encore des données écrites à la main.
        //
        // Les compétitions, les classements et les tarifs en sont sortis le
        // 16/08/2026 : ils ne contiennent que des données publiques, et les
        // interdire revenait à n'offrir à Google que la page d'accueil.
        disallow: [
          '/api/',
          '/admin',
          // Le produit payant lui-même.
          '/analyze',
          '/expert',
          // Espaces personnels : rien d'indexable, et rien à exposer.
          '/history',
          '/settings',
          '/search',
          '/ia-center',
          '/payment-success',
          '/payment-failed',
          // Fermés tant qu'ils affichent des rencontres écrites à la main,
          // datées d'avril 2026, avec des pronostics inventés. À rouvrir dès
          // qu'ils seront alimentés par de vraies données — c'est ce qui vient
          // d'être fait pour /matches.
          '/stats',
          '/club',
          '/match',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
