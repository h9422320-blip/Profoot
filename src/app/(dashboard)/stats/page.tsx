"use client";

import { useEffect, useState } from "react";
import { BarChart3, Target } from "lucide-react";
import { competitions } from "@/lib/data";

/**
 * Meilleurs buteurs — données réelles.
 *
 * Cette page affichait une liste écrite à la main dans le référentiel : Haaland
 * 29 buts, Lewandowski 26, et un sous-titre « Saison 2025-26 » figé. Ces
 * chiffres étaient ceux d'une saison révolue, présentés comme l'actualité.
 *
 * Ils viennent maintenant d'API-Football. Tant que la saison n'a pas produit de
 * statistiques, la liste reste vide et la page le dit — un classement vide est
 * honnête, un classement périmé ne l'est pas.
 */

interface Buteur {
  nom: string;
  club: string;
  logoClub: string | null;
  buts: number;
  passes: number;
}

const LIGUES = [
  { id: "epl", label: "Premier League" },
  { id: "laliga", label: "La Liga" },
  { id: "seriea", label: "Serie A" },
  { id: "ligue1", label: "Ligue 1" },
];

export default function StatsPage() {
  const [buteurs, setButeurs] = useState<Record<string, Buteur[]>>({});
  const [saison, setSaison] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    fetch("/api/topscorers/live")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (annule || !d) return;
        setButeurs(d.buteurs ?? {});
        setSaison(d.saison ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>
        <p className="text-foreground/50 text-sm mt-1">
          Meilleurs buteurs et passeurs{saison ? ` • Saison ${saison}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {LIGUES.map((ligue) => {
          const comp = competitions.find((c) => c.id === ligue.id);
          const liste = buteurs[ligue.id] ?? [];
          return (
            <div key={ligue.id} className="bg-card border border-border-card rounded-[16px] overflow-hidden">
              <div className="px-5 py-4 border-b border-border-card flex items-center gap-3">
                {comp && <img src={comp.logo} alt={comp.shortName} className="w-5 h-5 object-contain" />}
                <h2 className="text-sm font-bold text-foreground">{ligue.label}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  Buteurs
                </span>
              </div>

              {chargement ? (
                <div className="divide-y divide-border-card/50">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3 animate-pulse">
                      <div className="w-5 h-3 rounded bg-foreground/10" />
                      <div className="w-6 h-6 rounded-full bg-foreground/10" />
                      <div className="flex-1 h-3 rounded bg-foreground/10" />
                      <div className="w-8 h-3 rounded bg-foreground/10" />
                    </div>
                  ))}
                </div>
              ) : liste.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-xs text-foreground/40">
                    Aucun buteur pour l'instant — la saison n'a pas encore produit de statistiques.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border-card/50">
                  {liste.map((b, i) => (
                    <div
                      key={`${b.nom}-${i}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-sidebar/30 transition-colors"
                    >
                      <span
                        className={`text-xs font-black w-5 text-center ${
                          i === 0 ? "text-warning" : i < 3 ? "text-primary" : "text-foreground/40"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {b.logoClub && (
                        <img src={b.logoClub} alt={b.club} className="w-6 h-6 rounded-full bg-card p-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{b.nom}</p>
                        <p className="text-[10px] text-foreground/40">{b.club}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <div className="text-sm font-black text-foreground">{b.buts}</div>
                          <div className="text-[9px] text-foreground/30 uppercase tracking-wider">Buts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-black text-foreground/60">{b.passes}</div>
                          <div className="text-[9px] text-foreground/30 uppercase tracking-wider">Passes</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-foreground/30">
        <BarChart3 className="w-3.5 h-3.5" />
        <Target className="w-3.5 h-3.5" />
        <span>Chiffres relevés en direct sur la compétition en cours.</span>
      </div>
    </div>
  );
}
