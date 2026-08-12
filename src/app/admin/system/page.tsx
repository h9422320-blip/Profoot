import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import { getBilanEchecs } from "@/lib/echecs-analyse";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { Courbe } from "../_components/Graphique";
import { LienCompte, Vide, dateHeure } from "../_components/Ui";
import { Panneau, Classement } from "../_components/Panneaux";
import { Indicateur } from "../_components/Indicateur";
import { EnTete, Rapport } from "../_components/EnTete";
import { Brain, CheckCircle2, Clock, Gauge, ShieldAlert, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSystem({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);
  const [m, echecs] = await Promise.all([getAdminMetrics(periode), getBilanEchecs()]);

  return (
    <div className="space-y-6">
      <EnTete
        titre="Analyses IA"
        sousTitre={`${m.analyses.total} analyse${m.analyses.total > 1 ? "s" : ""} enregistrée${m.analyses.total > 1 ? "s" : ""} au total — ${m.periode.libelle.toLowerCase()}`}
        icone={<Brain className="w-6 h-6" />}
        teinte="cyan"
        action={<SelecteurPeriode />}
        reperes={[
          { libelle: "Par abonné", valeur: String(m.liens.analysesParAbonne) },
          { libelle: "Confiance affichée", valeur: m.liens.confianceIA === null ? "—" : `${m.liens.confianceIA} %` },
          {
            libelle: "Précision constatée",
            valeur: m.liens.precisionReelle === null ? "—" : `${m.liens.precisionReelle} %`,
            accent: true,
          },
          { libelle: "Pronostics vérifiés", valeur: String(m.liens.pronosticsVerifies) },
        ]}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Analyses sur la période"
          valeur={m.analyses.surPeriode}
          precedent={m.periode.cle === "tout" ? undefined : m.analyses.surPeriodePrecedente}
          teinte="cyan"
          icone={<Brain className="w-4 h-4" />}
          aide={`${m.liens.analysesParAbonne} par abonné actif`}
          delai={0.05}
        />
        <Indicateur
          libelle="Moyenne par jour"
          valeur={m.analyses.moyenneParJour}
          teinte="violet"
          icone={<Clock className="w-4 h-4" />}
          aide={`${m.liens.tauxUsage} % des comptes ont déjà analysé`}
          delai={0.1}
        />
        <Indicateur
          libelle="Total historique"
          valeur={m.analyses.total}
          teinte="neutre"
          icone={<CheckCircle2 className="w-4 h-4" />}
          aide="Toutes périodes confondues"
          delai={0.15}
        />
        <Indicateur
          libelle="Précision constatée"
          valeur={m.liens.precisionReelle === null ? "—" : `${m.liens.precisionReelle} %`}
          teinte={m.liens.precisionReelle === null ? "neutre" : "vert"}
          icone={<Target className="w-4 h-4" />}
          aide={
            m.liens.precisionReelle === null
              ? `${m.liens.pronosticsVerifies} pronostic${m.liens.pronosticsVerifies > 1 ? "s" : ""} vérifié${m.liens.pronosticsVerifies > 1 ? "s" : ""} — pas encore assez pour un taux fiable`
              : `Mesurée sur ${m.liens.pronosticsVerifies} matchs réellement joués`
          }
          delai={0.2}
        />
      </div>

      {/* Le rapprochement qui manquait : l'IA s'attribue une assurance, on la
          confronte à ce qu'elle réussit vraiment. Un chiffre de confiance seul
          ne dit rien — c'est l'écart qui informe. */}
      <Panneau
        titre="L'IA est-elle aussi sûre qu'elle le prétend ?"
        sousTitre="L'assurance qu'elle s'attribue, confrontée à ses résultats réels"
        icone={<Gauge className="w-4 h-4" />}
        teinte={m.liens.ecartConfiance === null ? "cyan" : m.liens.ecartConfiance > 10 ? "or" : "vert"}
      >
        {m.liens.precisionReelle === null ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-white/70 leading-relaxed">
                L&apos;IA s&apos;attribue une confiance moyenne de{" "}
                <span className="font-black text-cyan-400">
                  {m.liens.confianceIA === null ? "—" : `${m.liens.confianceIA} %`}
                </span>
                . Impossible de dire pour l&apos;instant si elle est justifiée :{" "}
                {m.liens.pronosticsVerifies === 0
                  ? "aucun pronostic n'a encore été confronté à un résultat."
                  : `seulement ${m.liens.pronosticsVerifies} pronostic${m.liens.pronosticsVerifies > 1 ? "s ont" : " a"} été vérifié${m.liens.pronosticsVerifies > 1 ? "s" : ""}.`}
              </p>
              <p className="text-[11px] text-white/30 mt-2">
                Les matchs analysés se jouent dans les jours qui viennent. La comparaison apparaîtra d&apos;elle-même.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Rapport
              libelle="Confiance affichée"
              valeur={`${m.liens.confianceIA} %`}
              pourcentage={m.liens.confianceIA ?? 0}
              teinte="#22d3ee"
              detail="Indice que l'IA s'attribue à elle-même sur ses analyses"
            />
            <Rapport
              libelle="Précision réelle"
              valeur={`${m.liens.precisionReelle} %`}
              pourcentage={m.liens.precisionReelle}
              detail={`Vainqueur correct sur ${m.liens.pronosticsVerifies} matchs joués`}
            />
            <Rapport
              libelle="Écart"
              valeur={`${m.liens.ecartConfiance! > 0 ? "+" : ""}${m.liens.ecartConfiance} pts`}
              teinte={m.liens.ecartConfiance! > 10 ? "#fbbf24" : "#10b981"}
              detail={
                m.liens.ecartConfiance! > 10
                  ? "L'IA se surestime : elle annonce plus de certitude qu'elle n'en mérite."
                  : m.liens.ecartConfiance! < -10
                    ? "L'IA se sous-estime : elle réussit mieux qu'elle ne l'annonce."
                    : "L'assurance affichée correspond aux résultats."
              }
            />
          </div>
        )}
      </Panneau>

      <Panneau
        titre="Volume d'analyses"
        sousTitre={`Analyses lancées — ${m.periode.libelle.toLowerCase()}`}
        icone={<Brain className="w-4 h-4" />}
        teinte="cyan"
      >
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
                    <td className="px-5 py-3 text-white/60 truncate max-w-[200px]"><LienCompte userId={a.userId} email={a.email} /></td>
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

      {/* Les échecs du moteur, visibles ICI et nulle part ailleurs.
          L'abonné reçoit son analyse normalement — score et probabilités
          calculés — et ne sait jamais que le modèle n'a pas répondu. Sans cette
          section, l'échec resterait invisible et ne serait jamais corrigé. */}
      <Panneau
        titre="Échecs du moteur d'analyse"
        sousTitre="Réservé à l'administration — l'abonné reçoit son analyse sans rien voir"
        icone={<ShieldAlert className="w-4 h-4" />}
        teinte={echecs.recents > 0 ? "or" : "vert"}
      >
        {echecs.total === 0 ? (
          <Vide
            message={
              echecs.analysesTotales > 0
                ? `Aucun échec enregistré sur ${echecs.analysesTotales} analyses.`
                : "Aucun échec enregistré. La collecte démarre au premier incident."
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Rapport
                libelle="Taux d'échec"
                valeur={echecs.tauxEchec === null ? "—" : `${echecs.tauxEchec} %`}
                pourcentage={echecs.tauxEchec ?? 0}
                teinte={(echecs.tauxEchec ?? 0) >= 10 ? "#fb7185" : "#fbbf24"}
                detail={`${echecs.total} échec${echecs.total > 1 ? "s" : ""} pour ${echecs.analysesTotales} analyses produites`}
              />
              <Rapport
                libelle="Dernières 24 h"
                valeur={String(echecs.recents)}
                teinte="#fbbf24"
                detail={
                  echecs.recents === 0
                    ? "Aucun échec depuis hier"
                    : "Échecs survenus depuis hier — c'est le chiffre à surveiller"
                }
              />
              <Rapport
                libelle="Abonnés restés sans réponse"
                valeur={String(echecs.sansReponse)}
                teinte={echecs.sansReponse > 0 ? "#fb7185" : "#10b981"}
                detail={
                  echecs.sansReponse === 0
                    ? "Tous ont reçu une analyse complète, calculée"
                    : "Requêtes réellement perdues : à traiter en priorité"
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {echecs.causes.map((c) => (
                <span
                  key={c.cause}
                  className="text-xs font-bold text-white/70 bg-[#1d2f3a] border border-[#2e4757] rounded-full px-3 py-1.5"
                >
                  {c.libelle} <span className="text-amber-400">{c.nombre}</span>
                  <span className="text-white/30"> ({c.part} %)</span>
                </span>
              ))}
            </div>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {echecs.derniers.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5">
                    {e.causeLibelle}
                  </span>
                  <span className="text-[13px] text-white/80 min-w-[170px]">
                    {e.equipe1} — {e.equipe2}
                  </span>
                  <span className="text-[11px] text-white/45 flex-1 min-w-[150px] truncate">
                    <LienCompte userId={e.userId} email={e.email} />
                  </span>
                  {e.dureeMs !== null && (
                    <span className="text-[11px] text-white/35 tabular-nums">
                      {(e.dureeMs / 1000).toFixed(1)} s
                    </span>
                  )}
                  <span className="text-[11px] text-white/25 whitespace-nowrap">{dateHeure(e.creeLe)}</span>
                  {e.message && (
                    <p className="w-full text-[10px] text-white/25 font-mono truncate" title={e.message}>
                      {e.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Panneau>
    </div>
  );
}
