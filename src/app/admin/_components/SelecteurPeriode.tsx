"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, X } from "lucide-react";
import CalendrierPlage from "./CalendrierPlage";

/**
 * Choix de la période affichée par l'administration.
 *
 * L'état vit dans l'URL (?du=…&au=…) : la page est ainsi partageable,
 * rechargeable et remontable dans l'historique, et le calcul reste fait côté
 * serveur sur des données fraîches.
 *
 * LE CALENDRIER S'OUVRE HORS DE LA PAGE, ET C'EST INDISPENSABLE.
 *
 * Il était auparavant posé en position absolue à l'intérieur de l'en-tête. Or
 * celui-ci masque ce qui dépasse de ses bords arrondis : le calendrier était
 * coupé en deux, on n'en voyait que les initiales des jours et les cases
 * étaient inatteignables. Une fenêtre montée à la racine du document échappe à
 * ce découpage, quel que soit le conteneur d'où on l'ouvre.
 */
export default function SelecteurPeriode() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [ouvert, setOuvert] = useState(false);
  const [du, setDu] = useState(params.get("du") ?? "");
  const [au, setAu] = useState(params.get("au") ?? "");

  const duActif = params.get("du");
  const auActif = params.get("au");
  const enFrancais = (iso: string) => iso.split("-").reverse().join("/");

  function appliquer() {
    if (!du || !au) return;
    router.push(`${pathname}?du=${du}&au=${au}`);
    setOuvert(false);
  }

  const fenetre = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Fond assombri : il isole le calendrier du reste de la page et sert de
          zone de fermeture. */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOuvert(false)}
      />

      {/* Fond CLAIR, volontairement.
          Le calendrier sombre se confondait avec la page : on ne distinguait ni
          les jours disponibles, ni la plage sélectionnée. Un choix de dates doit
          se lire d'un coup d'œil. */}
      <div className="relative w-full max-w-[380px] bg-white rounded-[24px] shadow-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-black text-slate-900 tracking-tight">
              Choisir une période
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Cliquez la date de début, puis celle de fin
            </p>
          </div>
          <button
            onClick={() => setOuvert(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <CalendrierPlage
          du={du}
          au={au}
          onChange={(d, a) => {
            setDu(d);
            setAu(a);
          }}
        />

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => {
              setDu("");
              setAu("");
            }}
            className="px-4 py-3 min-h-[48px] rounded-[14px] text-[13px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Effacer
          </button>
          <button
            onClick={appliquer}
            disabled={!du || !au}
            className="flex-1 py-3 min-h-[48px] rounded-[14px] bg-[#0f766e] text-white font-black text-[14px] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:bg-[#115e59] transition-colors"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className={`px-4 py-2.5 min-h-[44px] rounded-full text-[13px] font-bold transition-all border inline-flex items-center gap-2 ${
          duActif
            ? "bg-[#10b981] text-black border-[#10b981]"
            : "bg-[#1d2f3a] text-white/70 border-[#2e4757] hover:text-white hover:border-[#10b981]/50"
        }`}
      >
        <CalendarDays className="w-4 h-4" />
        {duActif && auActif ? `${enFrancais(duActif)} → ${enFrancais(auActif)}` : "Choisir une période"}
      </button>

      {/* Monté à la racine du document : c'est ce qui l'affranchit du
          découpage de l'en-tête. */}
      {ouvert && typeof document !== "undefined" && createPortal(fenetre, document.body)}
    </>
  );
}
