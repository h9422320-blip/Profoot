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
          // '/ia-center' retirée le 24/08/2026, en même temps que la page.
          //
          // L'interdiction n'est PAS conservée, et c'est délibéré : une adresse
          // interdite aux robots reste dans l'index de Google, marquée
          // « bloquée ». Pour qu'elle en sorte, il faut au contraire laisser le
          // robot venir constater qu'elle n'existe plus.
          '/payment-success',
          '/payment-failed',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
