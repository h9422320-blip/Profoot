import {
  AlertOctagon, AlertTriangle, Crosshair, Gauge, Info, Lightbulb,
  ListChecks, Scale, Target, TrendingDown, Wrench,
} from "lucide-react";
import { MINIMUM_DIAGNOSTIC, getDiagnosticIA } from "@/lib/diagnostic-ia";
import { EnTete, Rapport } from "../_components/EnTete";
import { Indicateur } from "../_components/Indicateur";
import { Panneau } from "../_components/Panneaux";
import { Vide } from "../_components/Ui";

export const dynamic = "force-dynamic";

/**
 * Diagnostic de l'analyseur : ce qu'il a annoncé, ce qui est arrivé, et ce
 * qu'il faut corriger.
 *
 * Aucun appel payant n'intervient. Tout est déduit par le calcul des données
 * déjà en base : les prédictions d'un côté, les résultats réels de l'autre.
 * Les recommandations sont des règles appliquées à des écarts chiffrés, et
 * chacune porte les nombres qui la justifient — pour qu'aucune correction ne
 * soit appliquée sur une impression.
 */
export default async function DiagnosticPage() {
  const d = await getDiagnosticIA();

  const gravites = {
    critique: { fond: "bg-red-500/10 border-red-500/30", texte: "text-red-400", icone: AlertOctagon, mot: "Critique" },
    important: { fond: "bg-amber-500/10 border-amber-500/30", texte: "text-amber-400", icone: AlertTriangle, mot: "Important" },
    mineur: { fond: "bg-cyan-500/10 border-cyan-500/25", texte: "text-cyan-400", icone: Info, mot: "Mineur" },
  };

  return (
    <div className="space-y-6">
      <EnTete
        titre="Diagnostic de l'analyseur"
        sousTitre="Ce que l'application a annoncé, confronté à ce qui est réellement arrivé"
        icone={<Gauge className="w-6 h-6" />}
        teinte="violet"
        reperes={[
          { libelle: "Matchs vérifiés", valeur: String(d.verifiees) },
          { libelle: "En attente", valeur: String(d.enAttente) },
          {
            libelle: "Réussite réelle",
            valeur: d.reussiteVainqueur === null ? "—" : `${d.reussiteVainqueur} %`,
            accent: true,
          },
          {
            libelle: "Écart de confiance",
            valeur: d.surconfiance === null ? "—" : `${d.surconfiance > 0 ? "+" : ""}${d.surconfiance} pts`,
          },
        ]}
      />

      {d.echantillonInsuffisant ? (
        <div className="rounded-[22px] border border-amber-500/25 bg-amber-500/10 p-6">
          <p className="text-sm font-black text-amber-300">
            {d.verifiees === 0
              ? "Aucun match vérifié pour l'instant"
              : `${d.verifiees} match${d.verifiees > 1 ? "s" : ""} vérifié${d.verifiees > 1 ? "s" : ""} sur ${MINIMUM_DIAGNOSTIC} nécessaires`}
          </p>
          <p className="text-xs text-white/60 mt-2 leading-relaxed">
            Le diagnostic ne se déclenche qu&apos;à partir de {MINIMUM_DIAGNOSTIC} matchs joués. En dessous, un écart
            constaté décrit le hasard et non un défaut : corriger sur cette base abîmerait l&apos;analyseur au lieu de
            l&apos;améliorer.{" "}
            {d.enAttente > 0 &&
              `${d.enAttente} analyse${d.enAttente > 1 ? "s attendent" : " attend"} que le match se joue. La vérification
              tourne chaque nuit, sans intervention.`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Indicateur
              libelle="Vainqueur trouvé"
              valeur={`${d.reussiteVainqueur} %`}
              teinte="vert"
              icone={<Target className="w-4 h-4" />}
              aide={`Sur ${d.verifiees} matchs réellement joués`}
              delai={0.05}
            />
            <Indicateur
              libelle="Score exact"
              valeur={`${d.reussiteScoreExact} %`}
              teinte="cyan"
              icone={<Crosshair className="w-4 h-4" />}
              aide="Prédire un score au but près reste rare pour tout le monde"
              delai={0.1}
            />
            <Indicateur
              libelle="Confiance annoncée"
              valeur={`${d.confianceMoyenne} %`}
              teinte="violet"
              icone={<Gauge className="w-4 h-4" />}
              aide="Indice moyen que l'analyseur s'attribue"
              delai={0.15}
            />
            <Indicateur
              libelle="Écart de calibrage"
              valeur={`${d.surconfiance! > 0 ? "+" : ""}${d.surconfiance} pts`}
              teinte={Math.abs(d.surconfiance ?? 0) >= 10 ? "or" : "vert"}
              icone={<Scale className="w-4 h-4" />}
              aide={
                (d.surconfiance ?? 0) >= 10
                  ? "Il annonce plus de certitude qu'il n'en mérite"
                  : (d.surconfiance ?? 0) <= -10
                    ? "Il réussit mieux qu'il ne l'annonce"
                    : "L'assurance affichée correspond aux résultats"
              }
              delai={0.2}
            />
          </div>

          {/* Les corrections : c'est la raison d'être de la page. */}
          <Panneau
            titre="Ce qu'il faut corriger"
            sousTitre={
              d.recommandations.length
                ? `${d.recommandations.length} correction${d.recommandations.length > 1 ? "s" : ""} déduite${d.recommandations.length > 1 ? "s" : ""} des écarts constatés`
                : "Aucun défaut systématique détecté"
            }
            icone={<Wrench className="w-4 h-4" />}
            teinte="or"
          >
            {d.recommandations.length === 0 ? (
              <Vide message="Aucun écart suffisamment net et répété pour justifier une correction. C'est bon signe." />
            ) : (
              <div className="space-y-3">
                {d.recommandations.map((r, i) => {
                  const g = gravites[r.gravite];
                  const Icone = g.icone;
                  return (
                    <div key={i} className={`rounded-[18px] border p-5 ${g.fond}`}>
                      <div className="flex items-start gap-3">
                        <Icone className={`w-5 h-5 shrink-0 mt-0.5 ${g.texte}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-white">{r.titre}</h4>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${g.texte}`}>
                              {g.mot}
                            </span>
                          </div>

                          <p className="text-[12px] text-white/50 mt-1.5 leading-relaxed">{r.constat}</p>

                          <div className="mt-3 p-3 rounded-[12px] bg-black/25 border border-white/5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5 flex items-center gap-1.5">
                              <Lightbulb className="w-3 h-3" /> À appliquer
                            </p>
                            <p className="text-[13px] text-white/80 leading-relaxed">{r.correction}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panneau>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calibrage : la promesse tenue, tranche par tranche. */}
            <Panneau
              titre="La confiance annoncée tient-elle ?"
              sousTitre="Réussite réelle dans chaque tranche de certitude"
              icone={<Gauge className="w-4 h-4" />}
              teinte="violet"
            >
              <div className="space-y-3">
                {d.tranches.filter((t) => t.nombre > 0).length === 0 ? (
                  <Vide message="Aucune tranche assez fournie pour être jugée." />
                ) : (
                  d.tranches
                    .filter((t) => t.nombre > 0)
                    .map((t) => (
                      <Rapport
                        key={t.libelle}
                        libelle={t.libelle}
                        valeur={`${t.reussite} %`}
                        pourcentage={t.reussite ?? 0}
                        teinte={(t.ecart ?? 0) >= 15 ? "#fbbf24" : "#a78bfa"}
                        detail={`${t.nombre} pronostic${t.nombre > 1 ? "s" : ""} • ${t.confianceMoyenne} % annoncés, ${t.reussite} % réussis${(t.ecart ?? 0) >= 15 ? ` — ${t.ecart} points de trop` : ""}`}
                      />
                    ))
                )}
              </div>
            </Panneau>

            {/* Nature des échecs : où le raisonnement casse. */}
            <Panneau
              titre="Quand il se trompe, comment ?"
              sousTitre="Nature des erreurs, pour savoir quoi corriger"
              icone={<TrendingDown className="w-4 h-4" />}
              teinte="rose"
            >
              {d.typesErreurs.length === 0 ? (
                <Vide message="Aucune erreur enregistrée." />
              ) : (
                <div className="space-y-3">
                  {d.typesErreurs.map((t) => (
                    <Rapport
                      key={t.libelle}
                      libelle={t.libelle}
                      valeur={`${t.nombre}`}
                      pourcentage={t.part}
                      teinte="#fb7185"
                      detail={`${t.part} % des erreurs — ${t.explication}`}
                    />
                  ))}
                </div>
              )}
            </Panneau>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ce qu'il annonce contre ce qui arrive. */}
            <Panneau
              titre="Issues annoncées et issues réelles"
              sousTitre="Un écart systématique révèle un biais de lecture"
              icone={<Scale className="w-4 h-4" />}
              teinte="cyan"
            >
              <div className="space-y-4">
                {(
                  [
                    ["Victoire première équipe", "team1"],
                    ["Match nul", "draw"],
                    ["Victoire seconde équipe", "team2"],
                  ] as const
                ).map(([libelle, cle]) => {
                  const totalP = d.repartition.predit.team1 + d.repartition.predit.team2 + d.repartition.predit.draw;
                  const totalR = d.repartition.reel.team1 + d.repartition.reel.team2 + d.repartition.reel.draw;
                  const p = totalP ? Math.round((d.repartition.predit[cle] / totalP) * 100) : 0;
                  const r = totalR ? Math.round((d.repartition.reel[cle] / totalR) * 100) : 0;
                  return (
                    <div key={cle}>
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <p className="text-[12px] font-bold text-white/70">{libelle}</p>
                        <p className="text-[11px] text-white/40 tabular-nums">
                          annoncé <span className="text-cyan-400 font-bold">{p} %</span> • réel{" "}
                          <span className="text-[#10b981] font-bold">{r} %</span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 bg-[#111d25] rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${p}%` }} />
                        </div>
                        <div className="h-2 bg-[#111d25] rounded-full overflow-hidden">
                          <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${r}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {d.butsMoyens.predits !== null && d.butsMoyens.reels !== null && (
                  <div className="pt-4 border-t border-[#2e4757]">
                    <Rapport
                      libelle="Buts par match"
                      valeur={`${d.butsMoyens.predits} vs ${d.butsMoyens.reels}`}
                      teinte="#22d3ee"
                      detail={`${d.butsMoyens.predits} annoncés en moyenne, ${d.butsMoyens.reels} réellement marqués`}
                    />
                  </div>
                )}
              </div>
            </Panneau>

            {/* Où il est bon, où il ne l'est pas. */}
            <Panneau
              titre="Réussite par compétition"
              sousTitre="Là où l'analyseur est fiable, et là où il ne l'est pas"
              icone={<ListChecks className="w-4 h-4" />}
              teinte="vert"
            >
              {d.competitions.length === 0 ? (
                <Vide message="Aucune compétition enregistrée." />
              ) : (
                <div className="space-y-3">
                  {d.competitions.map((c) => (
                    <Rapport
                      key={c.competition}
                      libelle={c.competition}
                      valeur={`${c.reussite} %`}
                      pourcentage={c.reussite}
                      teinte={c.reussite >= 60 ? "#10b981" : c.reussite >= 40 ? "#fbbf24" : "#fb7185"}
                      detail={`${c.nombre} match${c.nombre > 1 ? "s" : ""} analysé${c.nombre > 1 ? "s" : ""} • ${c.scoresExacts} score${c.scoresExacts > 1 ? "s" : ""} exact${c.scoresExacts > 1 ? "s" : ""}`}
                    />
                  ))}
                </div>
              )}
            </Panneau>
          </div>
        </>
      )}

      <div className="flex items-start gap-2 text-[11px] text-white/25">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Ce diagnostic est entièrement calculé à partir de votre base, sans aucun service extérieur et sans
          aucun coût. Les résultats réels proviennent de la vérification quotidienne déjà en place. Chaque
          correction proposée est une règle appliquée à un écart chiffré, jamais une appréciation : elle
          n&apos;apparaît que si l&apos;écart est net et répété sur assez de matchs.
        </p>
      </div>
    </div>
  );
}
