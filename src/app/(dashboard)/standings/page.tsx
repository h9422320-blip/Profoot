"use client";

import { Trophy, Loader2, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { competitions } from "@/lib/data";
import { getSeasonLabel } from "@/lib/api-football";
// Le MÊME calcul que celui qui a rempli la réserve d'équipes : un lien de
// classement doit tomber exactement sur l'identifiant de la fiche, sinon il
// mène à une page introuvable.
import { slugify as slugClub } from "@/lib/teams-live";

const leagueOrder = ["epl", "laliga", "seriea", "bundesliga", "ligue1"];

interface Ligne {
  rang: number; equipe: string; logo: string; joues: number;
  gagnes: number; nuls: number; perdus: number;
  bp: number; bc: number; diff: number; points: number; forme: string[];
}
interface Classement { saison: string; aCommence: boolean; lignes: Ligne[]; }

export default function StandingsPage() {
  const [classements, setClassements] = useState<Record<string, Classement>>({});
  const [statuts, setStatuts] = useState<Record<string, any>>({});
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/standings/live').then(r => (r.ok ? r.json() : { classements: {} })),
      fetch('/api/competitions/status').then(r => (r.ok ? r.json() : { statuses: {} })),
    ])
      .then(([c, s]) => { setClassements(c.classements || {}); setStatuts(s.statuses || {}); })
      .catch(() => { /* on n'affiche rien plutôt que des chiffres faux */ })
      .finally(() => setChargement(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Classements</h1>
        <p className="text-foreground/50 text-sm mt-1">
          Classements officiels des 5 grands championnats européens • Saison {getSeasonLabel('epl')}
        </p>
      </div>

      {chargement && (
        <div className="flex items-center justify-center py-16 gap-3 text-foreground/50">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Récupération des classements officiels…</span>
        </div>
      )}

      {!chargement && leagueOrder.map(leagueId => {
        const comp = competitions.find(c => c.id === leagueId);
        const cl = classements[leagueId];
        if (!comp) return null;

        return (
          <div key={leagueId} className="bg-card border border-border-card rounded-[16px] overflow-hidden">
            <Link href={`/competitions/${leagueId}`} className="px-5 py-4 border-b border-border-card flex items-center gap-3 hover:bg-sidebar/50 transition-colors">
              <img src={comp.logo} alt={comp.shortName} className="w-6 h-6 object-contain" />
              <h2 className="text-sm font-bold text-foreground">{comp.name}</h2>
              {statuts[leagueId]?.status && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  {statuts[leagueId].status}
                </span>
              )}
            </Link>

            {/* Tant qu'aucun match n'est joué, le classement est vide : on le dit
                clairement au lieu d'afficher un tableau de la saison passée. */}
            {!cl || !cl.aCommence ? (
              <div className="px-5 py-10 flex flex-col items-center text-center gap-2">
                <CalendarClock className="w-6 h-6 text-foreground/30" />
                <p className="text-sm font-semibold text-foreground/70">La saison n'a pas encore commencé</p>
                <p className="text-xs text-foreground/40 max-w-sm">
                  {statuts[leagueId]?.status
                    ? `${statuts[leagueId].status}. Le classement s'affichera dès la première journée.`
                    : "Le classement s'affichera dès la première journée."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] text-foreground/40 uppercase bg-sidebar/30 border-b border-border-card">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium w-8">#</th>
                      <th className="px-4 py-3 text-left font-medium">Club</th>
                      <th className="px-4 py-3 text-center font-medium">MJ</th>
                      <th className="px-4 py-3 text-center font-medium">V</th>
                      <th className="px-4 py-3 text-center font-medium">N</th>
                      <th className="px-4 py-3 text-center font-medium">D</th>
                      <th className="px-4 py-3 text-center font-medium">BP</th>
                      <th className="px-4 py-3 text-center font-medium">BC</th>
                      <th className="px-4 py-3 text-center font-medium">Diff</th>
                      <th className="px-4 py-3 text-center font-medium">Forme</th>
                      <th className="px-4 py-3 text-right font-medium">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-card/50">
                    {cl.lignes.map((row, i) => {
                      const isChampion = i === 0;
                      const isUCL = i < 4;
                      return (
                        <tr key={row.equipe} className={`hover:bg-sidebar/30 transition-colors ${isChampion ? "bg-primary/5" : ""}`}>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${isUCL ? "text-primary" : "text-foreground/50"}`}>{row.rang}</span>
                          </td>
                          <td className="px-4 py-3">
                            {/* Chaque club mène à sa fiche.
                                Le classement cite les huit cents clubs suivis
                                sans jamais y renvoyer : un moteur découvre les
                                pages en suivant les liens, et ces fiches
                                n'étaient atteignables que par le plan du site.
                                C'est aussi le geste attendu par le lecteur —
                                voir le détail d'une équipe du tableau. */}
                            <Link
                              href={`/club/${slugClub(row.equipe)}`}
                              className="flex items-center gap-2 group/club"
                            >
                              <img src={row.logo} alt={row.equipe} className="w-6 h-6 rounded-full bg-card" />
                              <span className="text-xs font-semibold text-foreground group-hover/club:text-primary transition-colors">
                                {row.equipe}
                              </span>
                              {isChampion && <Trophy className="w-3 h-3 text-warning" />}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.joues}</td>
                          <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.gagnes}</td>
                          <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.nuls}</td>
                          <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.perdus}</td>
                          <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.bp}</td>
                          <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.bc}</td>
                          <td className="px-4 py-3 text-center text-xs font-medium">
                            <span className={row.diff > 0 ? "text-primary" : row.diff < 0 ? "text-danger" : "text-foreground/50"}>
                              {row.diff > 0 ? "+" : ""}{row.diff}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-0.5 justify-center">
                              {row.forme.map((f, j) => (
                                <span key={j} className={`w-4 h-4 rounded-full text-[7px] font-bold flex items-center justify-center ${f === "W" ? "bg-primary/20 text-primary" : f === "D" ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger"}`}>{f}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-black text-foreground">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
