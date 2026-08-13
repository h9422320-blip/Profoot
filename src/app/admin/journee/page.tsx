import Link from "next/link";
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Info, Target, Users, XCircle,
} from "lucide-react";
import { getBilanDuJour } from "@/lib/matchs-du-jour";
import { EnTete, Rapport } from "../_components/EnTete";
import { Indicateur } from "../_components/Indicateur";
import { Panneau } from "../_components/Panneaux";
import { LienCompte, Vide, dateHeure } from "../_components/Ui";

export const dynamic = "force-dynamic";

const jourISO = (d: Date) => d.toISOString().slice(0, 10);
const decaler = (jour: string, jours: number) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return jourISO(d);
};

/**
 * La journée : ce qui a été analysé, par qui, et ce que ça a donné.
 *
 * Le diagnostic répond « quelle est la précision globale ». Ce n'est pas la
 * question qu'on se pose le soir d'un match. Ici on lit, match par match, ce que
 * l'application a annoncé, combien d'abonnés l'ont consulté, et si elle a eu
 * raison — la seule forme exploitable pour parler du produit.
 */
export default async function JourneePage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  const params = await searchParams;
  const aujourdhui = jourISO(new Date());
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(params.jour ?? "") ? params.jour! : aujourdhui;
  const b = await getBilanDuJour(jour);

  const libelle = new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      <EnTete
        titre="La journée"
        sousTitre={`${libelle} — ce qui a été analysé, et ce qui est réellement arrivé`}
        icone={<CalendarDays className="w-6 h-6" />}
        teinte="violet"
        action={
          <div className="flex items-center gap-1.5">
            <Link
              href={`/admin/journee?jour=${decaler(jour, -1)}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1d2f3a] border border-[#2e4757] text-xs font-bold text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Veille
            </Link>
            {jour !== aujourdhui && (
              <Link
                href={`/admin/journee?jour=${decaler(jour, 1)}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1d2f3a] border border-[#2e4757] text-xs font-bold text-white/70 hover:text-white transition-colors"
              >
                Lendemain <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        }
        reperes={[
          { libelle: "Matchs analysés", valeur: String(b.matchs.length) },
          { libelle: "Analyses", valeur: String(b.totalAnalyses) },
          { libelle: "Abonnés", valeur: String(b.abonnesDistincts) },
          {
            libelle: "Réussite du jour",
            valeur: b.reussiteDuJour === null ? "—" : `${b.reussiteDuJour} %`,
            accent: (b.reussiteDuJour ?? 0) >= 50,
          },
        ]}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Matchs analysés"
          valeur={b.matchs.length}
          teinte="violet"
          icone={<CalendarDays className="w-4 h-4" />}
          aide={`${b.matchsJoues} déjà joué${b.matchsJoues > 1 ? "s" : ""}`}
          delai={0.05}
        />
        <Indicateur
          libelle="Analyses lancées"
          valeur={b.totalAnalyses}
          teinte="cyan"
          icone={<Target className="w-4 h-4" />}
          aide={`${b.analysesVerifiees} confrontée${b.analysesVerifiees > 1 ? "s" : ""} au résultat réel`}
          delai={0.1}
        />
        <Indicateur
          libelle="Abonnés concernés"
          valeur={b.abonnesDistincts}
          teinte="or"
          icone={<Users className="w-4 h-4" />}
          aide="Comptes distincts ayant lancé au moins une analyse"
          delai={0.15}
        />
        <Indicateur
          libelle="Issues correctes"
          valeur={b.reussiteDuJour === null ? "—" : `${b.reussiteDuJour} %`}
          teinte={b.reussiteDuJour === null ? "neutre" : b.reussiteDuJour >= 50 ? "vert" : "rose"}
          icone={<CheckCircle2 className="w-4 h-4" />}
          aide={
            b.analysesVerifiees === 0
              ? "Aucune analyse encore confrontée à un résultat"
              : `${b.issuesCorrectes} sur ${b.analysesVerifiees} analyses vérifiées`
          }
          delai={0.2}
        />
      </div>

      {b.matchs.length === 0 ? (
        <Panneau titre="Aucune analyse ce jour-là">
          <Vide message="Personne n'a lancé d'analyse à cette date." />
        </Panneau>
      ) : (
        <div className="space-y-4">
          {b.matchs.map((m) => (
            <Panneau
              key={m.cle}
              titre={`${m.equipe1} — ${m.equipe2}`}
              sousTitre={`${m.competition ?? "compétition inconnue"} • ${m.analyses.length} analyse${m.analyses.length > 1 ? "s" : ""} • ${m.abonnes} abonné${m.abonnes > 1 ? "s" : ""}`}
              teinte={m.reussite === null ? "cyan" : m.reussite >= 50 ? "vert" : "rose"}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <Rapport
                  libelle="Résultat réel"
                  valeur={m.scoreReel ?? "pas encore joué"}
                  teinte={m.joue ? "#10b981" : "#64748b"}
                  detail={
                    m.joue
                      ? "Constaté après le coup de sifflet final"
                      : "Le match n'a pas encore été confronté à son résultat"
                  }
                />
                <Rapport
                  libelle="Issues correctes"
                  valeur={m.verifiees === 0 ? "—" : `${m.issuesCorrectes} / ${m.verifiees}`}
                  pourcentage={m.reussite ?? 0}
                  teinte={(m.reussite ?? 0) >= 50 ? "#10b981" : "#fb7185"}
                  detail={
                    m.verifiees === 0
                      ? "Aucune analyse de ce match n'est encore vérifiée"
                      : `${m.reussite} % des analyses de ce match ont donné le bon vainqueur`
                  }
                />
                <Rapport
                  libelle="Scores exacts"
                  valeur={m.verifiees === 0 ? "—" : `${m.scoresExacts} / ${m.verifiees}`}
                  teinte="#fbbf24"
                  detail="Le score exact est bien plus difficile que l'issue — un seul suffit à en parler"
                />
              </div>

              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {m.analyses.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]"
                  >
                    {a.issueCorrecte === null ? (
                      <span className="text-[10px] font-black uppercase tracking-wider text-white/30 shrink-0">
                        en attente
                      </span>
                    ) : a.issueCorrecte ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#10b981] shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> juste
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-400 shrink-0">
                        <XCircle className="w-3 h-3" /> manqué
                      </span>
                    )}

                    <span className="text-sm font-bold text-white tabular-nums min-w-[54px]">
                      {a.scorePredit ?? "—"}
                    </span>
                    {a.confiance !== null && (
                      <span className="text-[11px] text-white/35">{a.confiance} % sûr</span>
                    )}
                    {a.scoreExactCorrect && (
                      <span className="text-[10px] font-black text-amber-400 uppercase">score exact</span>
                    )}
                    <span className="text-[12px] text-white/50 flex-1 min-w-[150px] truncate">
                      <LienCompte userId={a.userId} email={a.email} />
                    </span>
                    <span className="text-[11px] text-white/25 whitespace-nowrap">{dateHeure(a.creeeLe)}</span>
                  </div>
                ))}
              </div>
            </Panneau>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 text-[11px] text-white/25">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Rien n&apos;est estimé sur cette page : les pronostics viennent des analyses réellement enregistrées, et les
          résultats de la vérification qui tourne toutes les demi-heures. Un match affiché « pas encore joué » attend
          simplement son coup de sifflet final. Une analyse produite après le coup d&apos;envoi porte sur l&apos;issue
          projetée à cet instant, pas sur un pronostic d&apos;avant-match — elle est plus facile à réussir, et la
          compter comme les autres flatterait le chiffre.
        </p>
      </div>
    </div>
  );
}
