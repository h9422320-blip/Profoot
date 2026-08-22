import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { PLANS } from "@/lib/subscription";
import { LanguageProvider } from "@/context/LanguageContext";

import Script from "next/script";
import { classesPolices } from "./polices";
import SignalReact from "@/components/SignalReact";
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
      // Les quatre familles sont servies depuis notre domaine (voir
      // `polices.ts`). Ces classes exposent leurs variables CSS partout.
      className={`h-full antialiased scroll-smooth ${classesPolices}`}
    >
      <head>
        {/*
          ── LE FILET DE SÉCURITÉ ────────────────────────────────────────────
          PLACÉ EN PREMIER, ET ÉCRIT EN JAVASCRIPT DE 2015.

          Ce script doit tourner sur le navigateur le plus vieux qui frappe à la
          porte. Ni fonction fléchée, ni `let`, ni gabarit de chaîne : la moindre
          syntaxe récente ici le ferait échouer, et c'est précisément lui qui
          doit survivre quand tout le reste échoue.

          IL FAIT DEUX CHOSES.

          1. Il pose `js-ok` sur la balise racine. Les sections de la page
             d'accueil sont en `opacity: 0` en attendant d'être révélées au
             défilement ; sans cette classe, la règle ne s'applique pas et le
             contenu envoyé par le serveur reste VISIBLE. Un navigateur trop
             ancien voit donc le site, sans animation, plutôt qu'un écran blanc.

          2. Il surveille les fichiers qui ne se chargent pas. Si l'un d'eux
             échoue, il affiche un message qui dit quoi faire — au lieu de
             laisser quelqu'un devant une page muette, qui repart sans jamais
             dire pourquoi.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var d=document,h=d.documentElement;" +
              "h.className=h.className+' js-ok';" +
              // Les polices distantes ont été chargées en « print » pour ne pas
              // retenir l'affichage. On les applique dès qu'elles arrivent.
              //
              // ATTENTION À L'ORDRE : ce script est le PREMIER élément de
              // l'en-tête, donc la balise des polices n'existe pas encore quand
              // il s'exécute. Une première version la cherchait tout de suite et
              // ne trouvait rien — les polices restaient en « print » pour
              // toujours, et le site s'affichait éternellement avec la police du
              // téléphone. On réessaie donc plus tard, à plusieurs reprises.
              // SI REACT N'A PAS PRIS LA MAIN AU BOUT DE QUATRE SECONDES, ON
              // REND TOUT VISIBLE.
              //
              // Les sections attendent d'être révélées au défilement, ce qui
              // suppose que React tourne. S'il ne démarre pas — fichier trop
              // lourd, connexion coupée, navigateur qui refuse — elles
              // resteraient invisibles pour toujours. On retire alors la classe
              // qui les masque : le visiteur voit le site sans animation, ce
              // qui vaut infiniment mieux qu'un écran vide.
              "setTimeout(function(){if(!h.getAttribute('data-react-ok')){" +
              "h.className=h.className.replace(' js-ok','');}},4000);" +
              "var prevenu=false;" +
              "function alerter(){if(prevenu)return;prevenu=true;" +
              "var b=d.body;if(!b)return;" +
              "var n=d.createElement('div');" +
              "n.setAttribute('style','position:fixed;left:0;right:0;bottom:0;z-index:2147483647;" +
              "background:#10B981;color:#06231a;font:600 15px/1.45 system-ui,-apple-system,Arial,sans-serif;" +
              "padding:16px 18px;text-align:center');" +
              "n.innerHTML='Votre navigateur est un peu ancien et ProFoot AI ne peut pas s\\'afficher correctement.<br>" +
              "Mettez-le \\u00e0 jour, ou ouvrez <b>profootai.com</b> dans Chrome ou Safari.';" +
              "b.appendChild(n);}" +
              "d.addEventListener('error',function(e){var c=e&&e.target;" +
              "if(c&&c.tagName==='SCRIPT'&&String(c.src).indexOf('/_next/')>-1){alerter();}},true);" +
              "window.addEventListener('error',function(e){" +
              "var m=e&&e.message?String(e.message):'';" +
              "if(m.indexOf('SyntaxError')>-1||m.indexOf('Unexpected')>-1){alerter();}});" +
              "}catch(e){}})();",
          }}
        />
        <noscript>
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2147483647,
              background: '#10B981',
              color: '#06231a',
              font: '600 15px/1.45 system-ui,-apple-system,Arial,sans-serif',
              padding: '16px 18px',
              textAlign: 'center',
            }}
          >
            ProFoot AI a besoin de JavaScript pour analyser les matchs. Activez-le dans les
            réglages de votre navigateur.
          </div>
        </noscript>

        <link rel="icon" href="/icon.png?v=5" />
        {/* La liaison au serveur de Clarity est ouverte pendant que la page se
            charge : la mesure ne coûte plus une négociation complète ensuite. */}
        <link rel="preconnect" href="https://www.clarity.ms" crossOrigin="anonymous" />
        {/* ── LES POLICES NE VIENNENT PLUS DE GOOGLE ──────────────────────

            Deux feuilles de style distantes vivaient ici : une balise <link>
            et un @import dans globals.css. 73 fichiers référencés, 741 Ko
            réellement téléchargés par un visiteur francophone, depuis un
            deuxième domaine — quinze secondes sur une 3G ouest-africaine.

            Elles étaient déjà rendues non bloquantes par une astuce
            (media="print" puis bascule en JavaScript), ce qui évitait l'écran
            blanc mais ne réduisait pas d'un octet ce qu'il fallait charger.

            Les polices sont maintenant servies depuis notre propre domaine,
            en latin seul, avec le CSS intégré à la page. Plus de domaine
            tiers, plus de bascule, plus d'astuce : voir `polices.ts`. */}

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
      <body className="min-h-full flex bg-background text-foreground w-full transition-colors duration-300" style={{ fontFamily: "var(--police-texte), sans-serif" }}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <SignalReact />
            <Analytics />
            <SpeedInsights />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
