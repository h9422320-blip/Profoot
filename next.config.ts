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
};

export default nextConfig;
