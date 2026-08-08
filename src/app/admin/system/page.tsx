import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { Courbe } from "../_components/Graphique";
import { Vide, dateHeure } from "../_components/Ui";
import { Panneau, Classement } from "../_components/Panneaux";
import { Indicateur } from "../_components/Indicateur";
import { CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSystem({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);
  const m = await getAdminMetrics(periode);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Analyses IA</h1>
          <p className="text-sm text-white/40 mt-1">
            {m.analyses.total} analyse{m.analyses.total > 1 ? "s" : ""} enregistrée{m.analyses.total > 1 ? "s" : ""} au total — {m.periode.libelle.toLowerCase()}
          </p>
        </div>
        <SelecteurPeriode />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Analyses sur la période"
          valeur={m.analyses.surPeriode}
          precedent={m.periode.cle === "tout" ? undefined : m.analyses.surPeriodePrecedente}
          accent
        />
        <Indicateur libelle="Moyenne par jour" valeur={m.analyses.moyenneParJour} />
        <Indicateur libelle="Total historique" valeur={m.analyses.total} aide="Toutes périodes confondues" />
        <Indicateur
          libelle="Confiance moyenne de l'IA"
          valeur={m.analyses.confianceMoyenne === null ? "—" : `${m.analyses.confianceMoyenne} %`}
          aide="Indice que l'IA attribue elle-même à ses analyses"
        />
      </div>

      <Panneau titre="Volume d'analyses" sousTitre={`Analyses lancées — ${m.periode.libelle.toLowerCase()}`}>
        <Courbe donnees={m.analyses.serie} suffixe="analyse(s)" hauteur={280} />
      </Panneau>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panneau titre="Compétitions" sousTitre="Les plus analysées">
          <Classement lignes={m.analyses.topCompetitions} unite="analyses" />
        </Panneau>
        <Panneau titre="Clubs" sousTitre="Les plus recherchés">
          <Classement lignes={m.analyses.topClubs} unite="analyses" />
        </Panneau>
        <Panneau titre="Utilisateurs" sousTitre="Les plus actifs sur la période">
          <Classement lignes={m.analyses.topUtilisateurs} unite="analyses" />
        </Panneau>
      </div>

      <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e4757]">
          <h3 className="font-bold text-white text-sm">Dernières analyses</h3>
          <p className="text-[11px] text-white/40 mt-0.5">50 plus récentes sur la période</p>
        </div>

        {m.analyses.dernieres.length === 0 ? (
          <Vide message="Aucune analyse sur cette période." />
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
                {m.analyses.dernieres.map((a) => (
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
                    <td className="px-5 py-3 text-white/60 truncate max-w-[200px]">{a.email}</td>
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
          <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#10b981]" /> Match à venir</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-white/30" /> Match terminé</span>
        </div>
      </div>
    </div>
  );
}
