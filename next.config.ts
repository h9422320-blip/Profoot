import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * ── « CETTE PAGE N'A PAS PU S'AFFICHER » : LA VRAIE CAUSE ────────────────
   *
   * CE QUI SE PASSAIT
   *
   * Constaté en production le 15 septembre 2026, l'erreur en main :
   * `An unexpected response was received from the server.` (Next E394), sur une
   * session ouverte AVANT une mise en ligne.
   *
   * Le navigateur garde la version qu'il a chargée en arrivant. Chaque mise en
   * ligne change celle du serveur. Quand l'abonné déclenche alors une action —
   * lancer une analyse, se connecter, changer de page — le serveur répond dans
   * une version que son navigateur ne sait plus lire. Next abandonne, et la
   * barrière d'erreur affiche « Cette page n'a pas pu s'afficher ».
   *
   * POURQUOI ÇA TOMBAIT SUR L'ANALYSE, ET PAS AILLEURS
   *
   * Une analyse dure une minute et demie. C'est la fenêtre la plus large de
   * toute l'application pour qu'une mise en ligne tombe au milieu — et c'est
   * exactement là que le propriétaire l'a rencontrée, deux jours de suite, sur
   * le match mis en avant de la page d'accueil. Quelqu'un qui découvre
   * l'application et clique sur ce match reçoit une page d'erreur : il ne va
   * pas plus loin, et il n'achète pas.
   *
   * CE QUE CETTE LIGNE CHANGE
   *
   * Avec un identifiant de version, le serveur renvoie le sien dans un en-tête.
   * Le navigateur compare, voit le décalage, et RECHARGE LA PAGE au lieu
   * d'échouer. L'abonné voit un rafraîchissement, pas une erreur.
   *
   * L'identifiant est celui du commit déployé : il ne change qu'à une mise en
   * ligne, il est le même sur toutes les instances, et il est disponible à la
   * construction — ce qui est indispensable, la valeur étant figée dans le
   * paquet. Hors Vercel, il vaut `undefined` et rien ne change.
   */
  deploymentId:
    process.env.NEXT_DEPLOYMENT_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    undefined,

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
