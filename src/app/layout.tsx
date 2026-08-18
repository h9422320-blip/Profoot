import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { PLANS } from "@/lib/subscription";
import { LanguageProvider } from "@/context/LanguageContext";

import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Microsoft Clarity — cartes de chaleur et enregistrements de session.
 *
 * POURQUOI IL EST LÀ
 *
 * Quatre-vingt-douze pour cent des paiements n'aboutissent pas : 348 abandons
 * et 41 échecs sur 424 tentatives. On sait QUE ça casse, on ne sait pas OÙ.
 * Clarity montre le parcours réel — où le doigt s'arrête, où la page est
 * quittée, quel bouton n'est jamais touché.
 *
 * L'identifiant est public : il figure en clair dans le code de n'importe
 * quelle page mesurée. Le placer dans une variable d'environnement ne
 * protégerait rien et rendrait la mesure muette en cas d'oubli au déploiement.
 */
const CLARITY_ID = "y4gues5jnw";

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
    // L'image d'aperçu n'est plus déclarée ici : elle est générée par
    // opengraph-image.tsx, donc toujours au format 1200×630 attendu. La
    // déclaration précédente pointait vers /logo.png en annonçant ces
    // dimensions, alors que ce fichier est un JPEG au format tout autre —
    // WhatsApp et Facebook recadraient de travers ou n'affichaient rien.
  },

  twitter: {
    card: "summary_large_image",
    title: "ProFoot AI — Analyse IA Football",
    description: DESCRIPTION,
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
        {/* La liaison au serveur de Clarity est ouverte pendant que la page se
            charge : la mesure ne coûte plus une négociation complète ensuite. */}
        <link rel="preconnect" href="https://www.clarity.ms" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

        {/*
          MICROSOFT CLARITY.

          `afterInteractive` : le script part une fois la page utilisable, jamais
          avant. Sur un téléphone en 3G — la quasi-totalité des visiteurs — une
          mesure qui retarde l'affichage coûte plus de visiteurs qu'elle n'en
          explique.

          Le fragment officiel crée lui-même sa balise avec `async = 1` : le
          téléchargement ne bloque donc rien, et un serveur Clarity injoignable
          laisse le site intact.
        */}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");`}
        </Script>

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
                    // Ces montants sont ceux que Google affiche dans ses
                    // résultats : ils doivent suivre les tarifs réels, sinon le
                    // visiteur arrive sur un prix différent de celui annoncé.
                    //
                    // Ils sont lus dans le code et NON dans le réglage de
                    // l'administration, volontairement : cette page enveloppe
                    // tout le site, et une lecture en base ici rendrait chaque
                    // page dynamique — la page d'accueil comprise. Après un
                    // changement de prix durable, reporter la valeur ici.
                    ...Object.values(PLANS).map((p) => ({
                      "@type": "Offer",
                      name: p.label,
                      price: String(p.amountXof),
                      priceCurrency: "XOF",
                    })),
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
