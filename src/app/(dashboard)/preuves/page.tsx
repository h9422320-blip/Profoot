import { after } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { MurPreuves } from "@/components/preuves/SectionPreuves";
import { getPreuvesPubliques, libelleCompetition } from "@/lib/preuves";

/**
 * DIX MINUTES DE CACHE, ET NON PLUS UN RECALCUL PAR VISITEUR.
 *
 * Cette page était refabriquée intégralement à chaque ouverture. Or elle est
 * publique, déclarée à Google en priorité 0,95, et donc visitée ET explorée
 * sans arrêt : chaque passage réveillait le serveur pour reconstruire une liste
 * qui, elle, ne bouge que quelques fois par jour — un pronostic ne devient
 * « vérifié » qu'au coup de sifflet final.
 *
 * Dix minutes de retard sur un résultat déjà acquis ne se voient pas. La
 * facture, si.
 */
export const revalidate = 600;

const SITE = "https://profootai.com";

export const metadata: Metadata = {
  // LE TITRE D'ONGLET NE BOUGE PAS, ET C'EST VOLONTAIRE.
  //
  // C'est lui que Google affiche dans ses résultats, et il porte les mots que
  // les gens tapent — « analyses vérifiées ». Le titre accrocheur vit dans la
  // page ; celui-ci reste celui qui la fait trouver.
  title: "Nos analyses vérifiées — ProFoot AI",
  description:
    "Les analyses de ProFoot AI annoncées avant le match et confirmées par le résultat réel.",
  // L'adresse de référence manquait. Sans elle, la même page atteinte avec un
  // paramètre de suivi — un lien partagé sur WhatsApp, une campagne — compte
  // comme une page distincte, et le peu de crédit qu'elle a se divise.
  alternates: { canonical: `${SITE}/preuves` },
  openGraph: {
    title: "Nos analyses vérifiées — ProFoot AI",
    description:
      "Chaque analyse est publiée avant le coup d'envoi, puis confrontée au résultat réel du match.",
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
  // ── LE RÉVEIL PARESSEUX ───────────────────────────────────────────────────
  //
  // La planification quotidienne n'est pas fiable : une seule exécution
  // enregistrée en base depuis sa mise en place — le 20 août à 00 h 22, alors
  // qu'elle annonce 5 h 37. Le mur restait figé jusqu'à ce qu'on le
  // reconstruise à la main, chaque jour, en cliquant un bouton.
  //
  // Servir ce mur est le moment idéal pour vérifier qu'il est à jour : c'est
  // exactement ici qu'un contenu périmé se verrait. Si l'entretien date de plus
  // de vingt heures, il repart — EN ARRIÈRE-PLAN, sans que le visiteur attende.
  //
  // Ce déclencheur ne dépend d'aucun planificateur, d'aucun jeton, d'aucun
  // réglage dans une interface tierce. Il suffit qu'une personne ouvre le site
  // une fois par jour, et il y en a des centaines.
  //
  // `after` ET NON UNE PROMESSE LAISSÉE DE CÔTÉ.
  //
  // Première tentative : `void import(...).then(...)`. Elle n'a jamais rien
  // déclenché, et le piège mérite d'être écrit. Sur une plateforme sans
  // serveur, la fonction est arrêtée dès la réponse envoyée : tout travail
  // encore en vol est tué sans un mot. Mesuré — trois visites de cette page,
  // aucune trace en base, aucune erreur nulle part.
  //
  // `after` est l'outil prévu pour ça : la plateforme garde la fonction en vie
  // jusqu'à la fin de la tâche, APRÈS avoir servi la page. Le visiteur n'attend
  // rien, et le travail va au bout.
  after(async () => {
    try {
      const { entretenirSiNecessaire } = await import('@/lib/entretien-quotidien');
      const r = await entretenirSiNecessaire();
      if (r.lance)
        console.log(
          `[PREUVES] Entretien déclenché par une visite : ${r.etapes.filter((e) => e.ok).length}/${r.etapes.length} étape(s) réussie(s) en ${r.dureeMs} ms.`
        );
    } catch (e: any) {
      console.error('[PREUVES] Entretien impossible :', e?.message);
    }
  });

  // ── ICI, TOUT LE PALMARÈS ────────────────────────────────────────────────
  //
  // Le bouton de la page d'analyse promet « voir les 211 preuves » ; cette
  // page en montrait soixante. Quelqu'un venu vérifier la promesse trouvait un
  // tiers de ce qu'on lui avait annoncé — et rien ne lui disait où était le
  // reste.
  //
  // Elle montre donc désormais toutes les réussites : les issues justes comme
  // les scores exacts, dans l'ordre du mur. La page d'analyse ouvre avec les
  // quarante scores exacts ; celle-ci répond à « et tout le reste ? ».
  const { preuves, bilan, total } = await getPreuvesPubliques(1000);

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
            name: "Analyses vérifiées",
            item: `${SITE}/preuves`,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: "Analyses ProFoot AI vérifiées après le match",
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
          Chaque analyse ci-dessous a été produite par ProFoot AI{" "}
          <span className="text-white/75 font-semibold">avant le coup d&apos;envoi</span>, puis
          confrontée au résultat réel de la rencontre.
        </p>
      </header>

      <MurPreuves preuves={preuves} bilan={bilan} total={total} avecEntete={false} />
    </div>
  );
}
