import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import SectionPreuves from "@/components/preuves/SectionPreuves";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nos pronostics vérifiés — ProFoot AI",
  description:
    "Les pronostics de ProFoot AI annoncés avant le match et confirmés par le résultat réel.",
};

/**
 * Le mur complet des pronostics vérifiés.
 *
 * La page /analyze n'en montre que les huit premiers pour ne pas noyer le
 * formulaire d'analyse. Ceux qui veulent vérifier davantage arrivent ici —
 * et c'est exactement le visiteur à convaincre : celui qui doute assez pour
 * cliquer sur « Voir tout ».
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

      <div className="px-1">
        <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
          Nos pronostics vérifiés
        </h1>
        <p className="text-[12px] text-white/45 mt-1.5 leading-relaxed max-w-prose">
          Chaque pronostic ci-dessous a été produit par ProFoot AI{" "}
          <strong className="text-white/70">avant le coup d&apos;envoi</strong>, puis confronté au
          résultat réel de la rencontre.
        </p>
      </div>

      <SectionPreuves limite={60} avecEntete={false} />
    </div>
  );
}
