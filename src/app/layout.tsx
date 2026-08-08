import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const SITE_URL = "https://profootai.com";
const DESCRIPTION =
  "Analyses de matchs par intelligence artificielle : scores probables, statistiques avancées, forme des équipes et pronostics sur les grands championnats européens et la CAN.";

export const metadata: Metadata = {
  // Sans cette base, Next.js ne peut pas construire d'adresse absolue : Google
  // et WhatsApp reçoivent alors des liens relatifs et ignorent l'aperçu.
  metadataBase: new URL(SITE_URL),

  title: {
    default: "ProFoot AI — Analyse IA Football",
    // Chaque page complète ce gabarit : le titre cesse d'être identique partout.
    template: "%s | ProFoot AI",
  },
  description: DESCRIPTION,

  // C'est ce nom que Google affiche AU-DESSUS du lien. Sans lui, il le déduit
  // du domaine — d'où le « Vercel » affiché tant que le site vivait sur
  // profoot-2lqq.vercel.app.
  applicationName: "ProFoot AI",
  authors: [{ name: "ProFoot AI" }],
  creator: "ProFoot AI",
  publisher: "ProFoot AI",

  keywords: [
    "analyse football IA", "pronostic football", "prédiction match football",
    "statistiques football", "Premier League", "La Liga", "Ligue 1",
    "Serie A", "Bundesliga", "Ligue des Champions", "CAN",
    "analyse tactique football", "xG football",
  ],

  // Adresse officielle de la page : évite que Google considère l'ancienne
  // adresse Vercel comme une page concurrente au contenu identique.
  alternates: { canonical: "/" },

  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "ProFoot AI",
    title: "ProFoot AI — Analyse IA Football",
    description: DESCRIPTION,
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "ProFoot AI" }],
  },

  twitter: {
    card: "summary_large_image",
    title: "ProFoot AI — Analyse IA Football",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className="h-full antialiased scroll-smooth"
    >
      <head>
        <link rel="icon" href="/icon.png?v=5" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

        {/*
          Données structurées : c'est ce qui permet à Google d'afficher
          « ProFoot AI » comme nom du site au lieu de le déduire du domaine
          d'hébergement. Le champ `url` déclare aussi l'adresse officielle.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: "ProFoot AI",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
                  description: DESCRIPTION,
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  name: "ProFoot AI",
                  alternateName: "ProFoot",
                  url: SITE_URL,
                  description: DESCRIPTION,
                  publisher: { "@id": `${SITE_URL}/#organization` },
                  inLanguage: "fr-FR",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "ProFoot AI",
                  applicationCategory: "SportsApplication",
                  operatingSystem: "Web",
                  url: SITE_URL,
                  description: DESCRIPTION,
                  offers: [
                    { "@type": "Offer", name: "Abonnement Mensuel", price: "15000", priceCurrency: "XOF" },
                    { "@type": "Offer", name: "Abonnement Annuel", price: "60000", priceCurrency: "XOF" },
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex bg-background text-foreground w-full transition-colors duration-300" style={{ fontFamily: "'Inter', sans-serif" }}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <Analytics />
            <SpeedInsights />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
