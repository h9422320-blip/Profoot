"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Search } from "lucide-react";
import { LienCompte, Vide, dateHeure } from "../_components/Ui";

export interface LigneAnalyse {
  id: string;
  userId: string;
  email: string;
  match: string;
  competition: string | null;
  score: string | null;
  confiance: number | null;
  termine: boolean;
  date: string;
}

/**
 * Les analyses produites, avec une recherche.
 *
 * POURQUOI UNE RECHERCHE
 *
 * Le tableau se coupait aux cinquante lignes les plus récentes. Sur une journée
 * chargée — cent une analyses le 11 août — la moitié devenait INTROUVABLE :
 * pas de pagination, pas de recherche, et rien qui signale qu'il en manque.
 * Retrouver l'analyse d'un utilisateur précis, celle dont il vous envoie une
 * capture, était impossible.
 *
 * Le filtrage se fait à l'écran, sur les lignes déjà chargées : pas d'attente,
 * et le compte affiché dit toujours combien de lignes correspondent sur combien
 * de chargées — pour qu'on sache quand la période sélectionnée est trop étroite.
 */
export default function TableauAnalyses({ lignes }: { lignes: LigneAnalyse[] }) {
  const [recherche, setRecherche] = useState("");

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return lignes;
    return lignes.filter((a) =>
      [a.match, a.competition, a.email, a.score].some((champ) =>
        String(champ ?? "").toLowerCase().includes(q)
      )
    );
  }, [lignes, recherche]);

  return (
    <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2e4757] space-y-3">
        <div>
          <h3 className="font-bold text-white text-sm">Analyses produites</h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            {recherche
              ? `${filtrees.length} résultat${filtrees.length > 1 ? "s" : ""} sur ${lignes.length} chargées`
              : `${lignes.length} sur la période, de la plus récente à la plus ancienne`}
          </p>
        </div>

        {/* Quarante-quatre pixels de haut : la taille d'un pouce sur un écran
            tactile. L'administration se consulte aussi depuis un téléphone. */}
        <div className="relative">
          <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un match, un compte, une compétition…"
            className="w-full min-h-[44px] pl-10 pr-4 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#10b981]/50 transition-colors"
          />
        </div>
      </div>

      {filtrees.length === 0 ? (
        <Vide
          message={
            recherche
              ? `Aucune analyse ne correspond à « ${recherche} » sur cette période. Élargissez la période si vous cherchez plus ancien.`
              : "Aucune analyse sur cette période."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-white/35 border-b border-[#2e4757]">
                <th className="font-bold px-5 py-3">Match</th>
                <th className="font-bold px-5 py-3">Compétition</th>
                <th className="font-bold px-5 py-3">Compte</th>
                <th className="font-bold px-5 py-3">Score</th>
                <th className="font-bold px-5 py-3 text-right">Confiance</th>
                <th className="font-bold px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((a) => (
                <tr key={a.id} className="border-b border-[#2e4757]/50 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-white">
                    <div className="flex items-center gap-2">
                      {a.termine ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                      )}
                      <span className="truncate max-w-[220px]">{a.match}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-white/60 truncate max-w-[160px]">{a.competition ?? "—"}</td>
                  <td className="px-5 py-3 text-white/60 truncate max-w-[200px]">
                    <LienCompte userId={a.userId} email={a.email} />
                  </td>
                  <td className="px-5 py-3 text-white/80 font-medium">{a.score ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-white/80">
                    {a.confiance !== null ? `${a.confiance} %` : "—"}
                  </td>
                  <td className="px-5 py-3 text-white/50 whitespace-nowrap">{dateHeure(a.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3 border-t border-[#2e4757] flex items-center gap-4 text-[11px] text-white/30">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#10b981]" /> Match à venir
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-white/30" /> Match terminé
        </span>
      </div>
    </div>
  );
}
