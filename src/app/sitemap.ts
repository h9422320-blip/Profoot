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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ── LES FICHES DE CLUB SONT LE VOLUME ────────────────────────────────────
  //
  // Sept pages étaient déclarées à Google, dont quatre pages légales. Un site
  // de football sans surface indexable ne peut pas être trouvé, quels que
  // soient ses titres et ses balises.
  //
  // Chaque club suivi porte une fiche réelle — classement, bilan, forme — et
  // devient une porte d'entrée : quelqu'un qui cherche « classement Real
  // Madrid » peut arriver ici, puis découvrir l'analyse.
  //
  // La liste est lue en base et non calculée : le plan du site ne doit jamais
  // dépendre du fournisseur de données pour s'afficher.
  let clubs: MetadataRoute.Sitemap = [];
  try {
    const { listerClubs } = await import('@/lib/club-reel');
    clubs = (await listerClubs()).map((c) => ({
      url: `${SITE_URL}/club/${c.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    // Réserve illisible : le plan du site garde ses pages principales plutôt
    // que d'échouer entièrement.
  }

  return [
    ...clubs,
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    // Le mur de preuves est PUBLIC et c'est la seule page qui porte du contenu
    // renouvelé : des pronostics datés confrontés à de vrais résultats. Il
    // était accessible mais absent d'ici, donc laissé à la découverte au
    // hasard. C'est pourtant la page qui distingue ce site de ses concurrents.
    { url: `${SITE_URL}/preuves`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    // Ouvertes au public le 16/08/2026. Ce sont, avec le mur de preuves, les
    // seules pages du site qui portent du contenu football indexable : tout le
    // reste vit derrière la connexion, et Google ne voyait donc rien à référencer.
    { url: `${SITE_URL}/matches`, lastModified: now, changeFrequency: 'hourly', priority: 0.95 },
    { url: `${SITE_URL}/competitions`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/standings`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/cgv`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
