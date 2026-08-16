"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const VERT = "#0f766e";
const VERT_PALE = "#0f766e26";      // le même, très transparent
const VERT_PALE_BORD = "#0f766e66";

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Clé AAAA-MM-JJ en heure LOCALE. */
function cle(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Calendrier de sélection d'une plage de dates.
 *
 * Deux clics : le premier pose le début, le second la fin. Un troisième
 * recommence une nouvelle plage — c'est le geste attendu, et l'obligation de
 * vider un champ avant de recommencer est la première chose qui agace.
 *
 * Les dates sont manipulées en heure LOCALE, jamais via `toISOString()`. Celle
 * ci convertit en temps universel : passé une certaine heure du soir, le 16
 * août devient le 15, et l'administration afficherait la mauvaise journée.
 */
export default function CalendrierPlage({
  du,
  au,
  onChange,
}: {
  du: string;
  au: string;
  onChange: (du: string, au: string) => void;
}) {
  const aujourdhui = new Date();
  const depart = du ? new Date(du + "T12:00:00") : aujourdhui;
  const [moisAffiche, setMoisAffiche] = useState(
    new Date(depart.getFullYear(), depart.getMonth(), 1)
  );

  const maxCle = cle(aujourdhui);

  function choisir(jour: string) {
    // Une plage complète existe déjà, ou le clic précède le début : on
    // recommence à partir de ce jour.
    if ((du && au) || !du || jour < du) {
      onChange(jour, "");
      return;
    }
    onChange(du, jour);
  }

  const premier = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth(), 1);
  const nbJours = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + 1, 0).getDate();
  // Lundi en première colonne : getDay() met dimanche à 0.
  const decalage = (premier.getDay() + 6) % 7;

  const cases: (string | null)[] = [
    ...Array(decalage).fill(null),
    ...Array.from({ length: nbJours }, (_, i) =>
      cle(new Date(moisAffiche.getFullYear(), moisAffiche.getMonth(), i + 1))
    ),
  ];

  const aujourdhuiCle = cle(aujourdhui);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMoisAffiche(new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() - 1, 1))}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-[16px] font-black text-slate-900 capitalize tracking-tight">
          {MOIS[moisAffiche.getMonth()]} {moisAffiche.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setMoisAffiche(new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + 1, 1))}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {JOURS.map((j, i) => (
          <span
            key={i}
            className="text-[11px] font-black text-slate-400 text-center py-1 uppercase tracking-wide"
          >
            {j}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cases.map((jour, i) => {
          if (!jour) return <span key={i} />;

          const futur = jour > maxCle;
          const bord = jour === du || jour === au;
          const dansPlage = !!du && !!au && jour > du && jour < au;

          // Les couleurs de sélection sont posées EN STYLE DIRECT, pas en
          // classes.
          //
          // Écrites en classes utilitaires, elles ne s'appliquaient pas : les
          // bornes du 5 et du 16 restaient transparentes et la plage choisie
          // était tout simplement invisible. Or c'est LA chose que ce composant
          // doit montrer. Un style direct ne dépend d'aucune génération de CSS.
          const style: React.CSSProperties = bord
            ? { backgroundColor: VERT, color: "#ffffff" }
            : dansPlage
              ? { backgroundColor: VERT_PALE, color: VERT }
              : {};

          return (
            <button
              key={i}
              type="button"
              disabled={futur}
              onClick={() => choisir(jour)}
              style={{
                ...style,
                ...(jour === aujourdhuiCle && !bord && !dansPlage
                  ? { boxShadow: `inset 0 0 0 1.5px ${VERT_PALE_BORD}` }
                  : {}),
              }}
              // Cases hautes de 44 px : c'est la taille minimale qu'un pouce
              // atteint sans se tromper de jour.
              className={`h-11 rounded-[12px] text-[15px] font-bold transition-colors ${
                bord || dansPlage
                  ? ""
                  : futur
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {Number(jour.slice(-2))}
            </button>
          );
        })}
      </div>

      {/* Dire où on en est : après le premier clic, rien à l'écran n'indique
          qu'il faut en faire un second. */}
      <p
        className={`text-[13px] mt-4 text-center font-bold ${
          du && au ? "text-[#0f766e]" : "text-slate-500"
        }`}
      >
        {!du
          ? "Cliquez la date de début"
          : !au
            ? "Cliquez maintenant la date de fin"
            : `Du ${du.split("-").reverse().join("/")} au ${au.split("-").reverse().join("/")}`}
      </p>
    </div>
  );
}
