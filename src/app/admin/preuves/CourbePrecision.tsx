import { TrendingUp } from "lucide-react";
import {
  getCourbePrecision,
  MATCHS_POUR_UN_TAUX_FIABLE,
} from "@/lib/precision-quotidienne";
import { Panneau } from "../_components/Panneaux";
import { Vide } from "../_components/Ui";

/**
 * La courbe du taux de réussite.
 *
 * POURQUOI ELLE EXISTE
 *
 * Le taux affiché ailleurs est instantané : il dit où on en est, jamais dans
 * quel sens ça va. Or sur onze matchs, un seul résultat le déplace de neuf
 * points — impossible de distinguer un progrès réel d'une fluctuation.
 *
 * Cette courbe montre les deux ensemble : la valeur, et la matière derrière.
 * Tant que le compteur n'a pas atteint cinquante matchs, le chiffre est annoncé
 * comme indicatif — c'est plus honnête que d'afficher « 36 % » avec l'aplomb
 * d'une mesure établie.
 */
export default async function CourbePrecision() {
  const { points, actuel, matchsManquants, fiable, indisponible } = await getCourbePrecision();

  if (indisponible)
    return (
      <Panneau titre="Courbe de précision" icone={<TrendingUp className="w-4 h-4" />} teinte="cyan">
        <Vide message="La table de suivi n'existe pas encore. Exécutez le script SQL fourni dans Supabase — la courbe se remplira ensuite toute seule, chaque jour." />
      </Panneau>
    );

  if (!actuel)
    return (
      <Panneau titre="Courbe de précision" icone={<TrendingUp className="w-4 h-4" />} teinte="cyan">
        <Vide message="Aucun relevé pour le moment. Le premier point sera écrit cette nuit par la tâche planifiée." />
      </Panneau>
    );

  const progression = Math.min(100, (actuel.matchsCumules / MATCHS_POUR_UN_TAUX_FIABLE) * 100);
  const maxTaux = Math.max(60, ...points.map((p) => p.tauxIssue));

  return (
    <Panneau
      titre="Courbe de précision"
      sousTitre="Un point par jour, écrit automatiquement — issue juste et score exact sur le cumul"
      icone={<TrendingUp className="w-4 h-4" />}
      teinte="cyan"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { libelle: "Matchs vérifiés", valeur: String(actuel.matchsCumules), detail: `${actuel.matchsJour} aujourd'hui` },
            {
              libelle: "Bonne issue",
              valeur: `${actuel.tauxIssue} %`,
              detail: `${actuel.issuesJustesCumulees} sur ${actuel.matchsCumules}`,
            },
            {
              libelle: "Score exact",
              valeur: `${actuel.tauxScoreExact} %`,
              detail: `${actuel.scoresExactsCumules} sur ${actuel.matchsCumules}`,
            },
          ].map((c) => (
            <div key={c.libelle} className="px-4 py-3 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">{c.libelle}</p>
              <p className="text-xl font-black text-white mt-0.5 tabular-nums">{c.valeur}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{c.detail}</p>
            </div>
          ))}
        </div>

        {/* Le compteur avant que le taux mérite d'être cru. */}
        <div className="px-4 py-3.5 rounded-[14px] bg-white/[0.03] border border-white/10">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <span className="text-[12px] font-bold text-white/70">
              {fiable
                ? "Échantillon suffisant — le taux est exploitable"
                : `Encore ${matchsManquants} match${matchsManquants > 1 ? "s" : ""} avant un taux fiable`}
            </span>
            <span className="text-[11px] text-white/35 tabular-nums shrink-0">
              {actuel.matchsCumules} / {MATCHS_POUR_UN_TAUX_FIABLE}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${fiable ? "bg-[#10b981]" : "bg-[#2DD4BF]"}`}
              style={{ width: `${progression}%` }}
            />
          </div>
          {!fiable && (
            <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
              En dessous de {MATCHS_POUR_UN_TAUX_FIABLE} matchs, un seul résultat déplace le taux de
              plusieurs points. Le chiffre reste indicatif.
            </p>
          )}
        </div>

        {/* Histogramme simple : une barre par jour relevé. Pas de librairie —
            la courbe doit rester lisible sur un téléphone. */}
        {points.length > 1 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2.5">
              Taux d&apos;issue juste, jour après jour
            </p>
            <div className="flex items-end gap-1 h-28 overflow-x-auto pb-1">
              {points.map((p) => (
                <div key={p.jour} className="flex flex-col items-center gap-1 shrink-0 w-[26px]" title={`${p.jour} — ${p.tauxIssue} % sur ${p.matchsCumules} matchs`}>
                  <span className="text-[9px] text-white/40 tabular-nums">{p.tauxIssue}</span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-[#10b981]/40 to-[#2DD4BF] min-h-[2px]"
                    style={{ height: `${(p.tauxIssue / maxTaux) * 72}px` }}
                  />
                  <span className="text-[8px] text-white/25 tabular-nums">{p.jour.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panneau>
  );
}
