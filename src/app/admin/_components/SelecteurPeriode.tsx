"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, X } from "lucide-react";

const RACCOURCIS = [
  { cle: "7j", libelle: "7 jours" },
  { cle: "30j", libelle: "30 jours" },
  { cle: "90j", libelle: "90 jours" },
  { cle: "12m", libelle: "12 mois" },
  { cle: "tout", libelle: "Tout" },
];

/**
 * Filtre de période, partagé par toutes les pages de l'admin.
 *
 * L'état vit dans l'URL (?periode=30j ou ?du=…&au=…) : la page est ainsi
 * partageable, rechargeable et remontable dans l'historique, et le calcul reste
 * fait côté serveur sur des données fraîches.
 */
export default function SelecteurPeriode() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const periodeActive = params.get("periode") ?? (params.get("du") ? "perso" : "30j");
  const [ouvert, setOuvert] = useState(false);
  const [du, setDu] = useState(params.get("du") ?? "");
  const [au, setAu] = useState(params.get("au") ?? "");

  function appliquerRaccourci(cle: string) {
    router.push(`${pathname}?periode=${cle}`);
    setOuvert(false);
  }

  function appliquerPlage() {
    if (!du || !au) return;
    router.push(`${pathname}?du=${du}&au=${au}`);
    setOuvert(false);
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {RACCOURCIS.map((r) => (
          <button
            key={r.cle}
            onClick={() => appliquerRaccourci(r.cle)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              periodeActive === r.cle
                ? "bg-[#10b981] text-black border-[#10b981]"
                : "bg-[#1d2f3a] text-white/60 border-[#2e4757] hover:text-white hover:border-[#10b981]/40"
            }`}
          >
            {r.libelle}
          </button>
        ))}

        <button
          onClick={() => setOuvert(!ouvert)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border inline-flex items-center gap-1.5 ${
            periodeActive === "perso"
              ? "bg-[#10b981] text-black border-[#10b981]"
              : "bg-[#1d2f3a] text-white/60 border-[#2e4757] hover:text-white hover:border-[#10b981]/40"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Dates précises
        </button>
      </div>

      {ouvert && (
        <div className="absolute right-0 mt-2 z-50 w-[280px] bg-[#16242e] border border-[#2e4757] rounded-[18px] p-4 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Choisir des dates</span>
            <button onClick={() => setOuvert(false)} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-white/50">Du</span>
            <input
              type="date"
              value={du}
              max={au || aujourdhui}
              onChange={(e) => setDu(e.target.value)}
              className="w-full bg-[#1d2f3a] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981]"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-white/50">Au</span>
            <input
              type="date"
              value={au}
              min={du || undefined}
              max={aujourdhui}
              onChange={(e) => setAu(e.target.value)}
              className="w-full bg-[#1d2f3a] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981]"
            />
          </label>

          <button
            onClick={appliquerPlage}
            disabled={!du || !au}
            className="w-full py-2 rounded-[12px] bg-[#10b981] text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0ea472] transition-colors"
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  );
}
