import type { Metadata } from "next";
import Link from "next/link";
import { Home, Trophy, CalendarDays, ShieldCheck } from "lucide-react";

/**
 * La page « introuvable ».
 *
 * POURQUOI ELLE EXISTE
 *
 * Il n'y en avait aucune. Une adresse inconnue — /club/nimportequoi — renvoyait
 * la coquille de chargement du tableau de bord, avec le code 200 : « tout va
 * bien, voici votre page ». Un moteur de recherche appelle cela une fausse
 * page trouvée, et il finit par dépenser son temps sur des adresses qui
 * n'existent pas au lieu des mille pages réelles du site.
 *
 * Rendue ici, elle porte le code 404 attendu.
 *
 * DES LIENS, PAS UNE IMPASSE
 *
 * Quelqu'un qui atterrit sur une adresse morte — un lien partagé, une faute de
 * frappe — doit pouvoir repartir vers ce que le site fait de mieux, plutôt que
 * de fermer l'onglet.
 */

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas ou n'existe plus.",
  robots: { index: false, follow: true },
};

const RACCOURCIS = [
  { href: "/", libelle: "Accueil", icone: Home },
  { href: "/preuves", libelle: "Nos analyses vérifiées", icone: ShieldCheck },
  { href: "/matches", libelle: "Matchs du jour", icone: CalendarDays },
  { href: "/standings", libelle: "Classements", icone: Trophy },
];

export default function Introuvable() {
  return (
    <div className="min-h-screen bg-[#101c24] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center space-y-7">
        <div className="space-y-3">
          <p className="text-[64px] leading-none font-black text-white/10 tabular-nums">404</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Page introuvable</h1>
          <p className="text-[14px] text-white/50 leading-relaxed">
            Cette adresse n&apos;existe pas, ou la page a été retirée. Voici par où continuer.
          </p>
        </div>

        <div className="space-y-2">
          {RACCOURCIS.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="flex items-center gap-3 w-full px-5 py-4 min-h-[52px] rounded-[16px] border border-[#2e4757] bg-[#16242e] text-white hover:border-[#10B981]/50 transition-colors"
            >
              <r.icone className="w-4 h-4 text-[#10B981] shrink-0" />
              <span className="text-[14px] font-bold">{r.libelle}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/analyze"
          className="inline-flex items-center justify-center w-full px-6 py-4 min-h-[52px] rounded-full font-black text-[14px] text-[#06231a] bg-[#10B981] hover:bg-[#0ea371] transition-colors"
        >
          Analyser un match avec l&apos;IA
        </Link>
      </div>
    </div>
  );
}
