import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import SectionPreuves from "@/components/preuves/SectionPreuves";

export const dynamic = "force-dynamic";

export const metadata = {
  // LE TITRE D'ONGLET NE BOUGE PAS, ET C'EST VOLONTAIRE.
  //
  // C'est lui que Google affiche dans ses résultats, et il porte les mots que
  // les gens tapent — « pronostics vérifiés ». Le titre accrocheur vit dans la
  // page ; celui-ci reste celui qui la fait trouver.
  title: "Nos pronostics vérifiés — ProFoot AI",
  description:
    "Les pronostics de ProFoot AI annoncés avant le match et confirmés par le résultat réel.",
};

/**
 * Le mur complet des pronostics vérifiés.
 *
 * La page /analyze n'en montre que les premiers pour ne pas noyer le
 * formulaire d'analyse. Ceux qui veulent vérifier davantage arrivent ici —
 * et c'est exactement le visiteur à convaincre : celui qui doute assez pour
 * cliquer sur « Voir tout ».
 *
 * L'EN-TÊTE, REPRISE LE 17 AOÛT 2026
 *
 * Le mur avait été refait la veille, mais cette page gardait son titre plat
 * au-dessus : le visiteur le plus motivé du site — celui qui a cliqué pour
 * vérifier — arrivait sur la page la moins soignée. Elle porte désormais la
 * même promesse que sur /analyze.
 *
 * Les mots qui font trouver la page restent à leur place : le titre d'onglet
 * et la phrase d'introduction gardent « pronostics » et « vérifiés ».
 */
export default function PagePreuves() {
  return (
    <div className="space-y-5 pb-8">
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

      <SectionPreuves limite={60} avecEntete={false} />
    </div>
  );
}
