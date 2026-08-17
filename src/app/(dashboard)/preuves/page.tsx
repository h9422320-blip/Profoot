import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { MurPreuves } from "@/components/preuves/SectionPreuves";
import { getPreuvesPubliques, libelleCompetition } from "@/lib/preuves";

export const dynamic = "force-dynamic";

const SITE = "https://profootai.com";

export const metadata: Metadata = {
  // LE TITRE D'ONGLET NE BOUGE PAS, ET C'EST VOLONTAIRE.
  //
  // C'est lui que Google affiche dans ses résultats, et il porte les mots que
  // les gens tapent — « pronostics vérifiés ». Le titre accrocheur vit dans la
  // page ; celui-ci reste celui qui la fait trouver.
  title: "Nos pronostics vérifiés — ProFoot AI",
  description:
    "Les pronostics de ProFoot AI annoncés avant le match et confirmés par le résultat réel.",
  // L'adresse de référence manquait. Sans elle, la même page atteinte avec un
  // paramètre de suivi — un lien partagé sur WhatsApp, une campagne — compte
  // comme une page distincte, et le peu de crédit qu'elle a se divise.
  alternates: { canonical: `${SITE}/preuves` },
  openGraph: {
    title: "Nos pronostics vérifiés — ProFoot AI",
    description:
      "Chaque pronostic est publié avant le coup d'envoi, puis confronté au résultat réel du match.",
    url: `${SITE}/preuves`,
    type: "website",
  },
};

/**
 * Le mur complet des pronostics vérifiés.
 *
 * La page /analyze n'en montre que les premiers pour ne pas noyer le
 * formulaire d'analyse. Ceux qui veulent vérifier davantage arrivent ici —
 * et c'est exactement le visiteur à convaincre : celui qui doute assez pour
 * cliquer sur « Voir tout ».
 *
 * CE QUI MANQUAIT CÔTÉ RÉFÉRENCEMENT
 *
 * La page était déclarée au plan du site, mais rien d'autre : pas d'adresse de
 * référence, pas d'aperçu pour les réseaux, aucune donnée structurée, et
 * surtout aucun lien sortant. Soixante rencontres réelles y étaient citées —
 * PSG-Lens, City-Arsenal — sans jamais renvoyer vers leur fiche, alors que ces
 * fiches existent et sont indexables. Un moteur découvre les pages en suivant
 * les liens ; ceux-là n'existaient pas.
 *
 * Les données sont lues UNE fois ici et passées au mur : les interroger à
 * nouveau pour bâtir les données structurées doublerait la requête.
 */
export default async function PagePreuves() {
  const { preuves, bilan, total } = await getPreuvesPubliques(60);

  /**
   * Ce que Google lit, et ce qu'il n'y trouvera pas.
   *
   * Une liste de rencontres réelles, chacune renvoyant à sa fiche. Rien sur la
   * justesse des pronostics : aucun vocabulaire normalisé ne permet de le
   * déclarer, et inventer une propriété pour s'auto-décerner un taux de
   * réussite est précisément ce qui fait sanctionner un site.
   */
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE },
          {
            "@type": "ListItem",
            position: 2,
            name: "Pronostics vérifiés",
            item: `${SITE}/preuves`,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: "Pronostics ProFoot AI vérifiés après le match",
        numberOfItems: preuves.length,
        itemListElement: preuves.map((p, i) => {
          const competition = libelleCompetition(p.competition);
          const nom = `${p.equipe1} ${p.scoreReel ?? ""} ${p.equipe2}`.replace(/\s+/g, " ").trim();
          return {
            "@type": "ListItem",
            position: i + 1,
            name: competition ? `${nom} — ${competition}` : nom,
            ...(p.fixtureId ? { url: `${SITE}/match/${p.fixtureId}` } : {}),
          };
        }),
      },
    ],
  };

  return (
    <div className="space-y-5 pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />

      <Link
        href="/analyze"
        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/40 hover:text-white/70 transition-colors min-h-[44px]"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour à l&apos;analyse
      </Link>

      <header className="px-1 flex flex-col gap-3">
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-[#34D399]">
          <Sparkles className="w-3 h-3" />
          Preuves publiques
        </span>

        <h1 className="text-[23px] sm:text-[30px] font-black text-white leading-[1.08] tracking-tight">
          L&apos;IA l&apos;avait dit{" "}
          <span className="bg-gradient-to-r from-[#10B981] to-[#2DD4BF] bg-clip-text text-transparent">
            avant tout le monde
          </span>
        </h1>

        <p className="text-[12.5px] text-white/50 leading-relaxed max-w-prose">
          Chaque pronostic ci-dessous a été produit par ProFoot AI{" "}
          <span className="text-white/75 font-semibold">avant le coup d&apos;envoi</span>, puis
          confronté au résultat réel de la rencontre.
        </p>
      </header>

      <MurPreuves preuves={preuves} bilan={bilan} total={total} avecEntete={false} />
    </div>
  );
}
