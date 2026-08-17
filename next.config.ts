import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
      },
      {
        protocol: "https",
        hostname: "v3.football.api-sports.io",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        // Photos des ambassadeurs, envoyées depuis l'administration.
        // Sans cette autorisation, next/image refuse de servir l'image et la
        // section apparaît vide.
        protocol: "https",
        hostname: "rhxagubyuidautkejbfm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  /**
   * En-têtes de sécurité.
   *
   * POURQUOI ILS ONT ÉTÉ AJOUTÉS
   *
   * Le navigateur intégré de TikTok affiche « ce site peut être dangereux » sur
   * profootai.com. Ce n'est pas la cause du signalement — un domaine récent
   * suffit à le déclencher — mais ces en-têtes sont exactement ce qu'inspectent
   * les outils qui notent la réputation d'un site, et leur absence n'aide pas
   * un domaine qui doit faire ses preuves.
   *
   * Ils sont surtout utiles en eux-mêmes : ils ferment des portes réellement
   * ouvertes.
   */
  async headers() {
    return [
      {
        source: "/:chemin*",
        headers: [
          // Empêche qu'un fichier soit interprété comme autre chose que ce
          // qu'il annonce — une image traitée comme du code, par exemple.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Interdit d'enfermer le site dans le cadre d'un autre : c'est ainsi
          // qu'on fait cliquer quelqu'un sur un bouton qu'il ne voit pas.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // L'adresse complète de la page n'est plus transmise aux sites
          // tiers ; seul le domaine l'est.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Caméra, micro et position ne servent jamais ici : autant les
          // refuser explicitement.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
