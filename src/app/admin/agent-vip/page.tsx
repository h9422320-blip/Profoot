import {
  AlertTriangle, CheckCircle2, Clock, Coins, Info, MessageSquare,
  Search, Shield, Wrench,
} from "lucide-react";
import { getBilanAgentVip } from "@/lib/conversations-vip";
import { EnTete, Rapport } from "../_components/EnTete";
import { Indicateur } from "../_components/Indicateur";
import { Panneau } from "../_components/Panneaux";
import { LienCompte, Vide, dateHeure } from "../_components/Ui";
import SoldeFournisseurs from "../_components/SoldeFournisseurs";

export const dynamic = "force-dynamic";

/**
 * Contrôle de l'Agent VIP.
 *
 * Aucune notation n'est confiée à une intelligence artificielle : tout est
 * constaté. Le nombre de recherches réellement lancées, les outils appelés, la
 * durée, le coût — et le respect des règles de rédaction qu'on a fixées, qui se
 * vérifie par simple lecture du texte.
 *
 * La mesure qui compte le plus est la plus simple : une réponse produite sans
 * aucune recherche web vient de la mémoire du modèle, qui a des mois de retard.
 */
export default async function AgentVipPage() {
  const b = await getBilanAgentVip();

  return (
    <div className="space-y-6">
      <EnTete
        titre="Agent VIP"
        sousTitre="Chaque échange, ce que l'agent a réellement fait pour répondre, et ce qu'il a coûté"
        icone={<MessageSquare className="w-6 h-6" />}
        teinte="cyan"
        reperes={[
          { libelle: "Échanges", valeur: String(b.total) },
          { libelle: "Recherches par réponse", valeur: String(b.rechercheMoyenne) },
          {
            libelle: "Règles respectées",
            valeur: b.conformiteMoyenne === null ? "—" : `${b.conformiteMoyenne} %`,
            accent: (b.conformiteMoyenne ?? 0) >= 90,
          },
          { libelle: "Coût total", valeur: `${b.coutTotalXof.toLocaleString("fr-FR")} FCFA` },
        ]}
      />

      {/* Le crédit restant, et par où l'agent passe. En haut, parce qu'un solde
          à zéro rend tout le reste de cette page sans objet. */}
      <SoldeFournisseurs />

      {b.total === 0 ? (
        <div className="rounded-[22px] border border-amber-500/25 bg-amber-500/10 p-6">
          <p className="text-sm font-black text-amber-300">Aucun échange enregistré pour l&apos;instant</p>
          <p className="text-xs text-white/60 mt-2 leading-relaxed">
            L&apos;enregistrement vient d&apos;être mis en place : les conversations antérieures n&apos;ont jamais été
            conservées et sont définitivement perdues. Tout échange à partir de maintenant apparaîtra ici, avec le
            détail de ce que l&apos;agent a fait pour répondre. Si la page reste vide alors que des abonnés utilisent
            l&apos;agent, vérifiez que la migration a bien été appliquée.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Indicateur
              libelle="Échanges enregistrés"
              valeur={b.total}
              teinte="cyan"
              icone={<MessageSquare className="w-4 h-4" />}
              aide={`${b.recents} sur les sept derniers jours`}
              delai={0.05}
            />
            <Indicateur
              libelle="Réponses sans recherche"
              valeur={b.sansRecherche}
              teinte={b.sansRecherche > 0 ? "rose" : "vert"}
              icone={<Search className="w-4 h-4" />}
              aide={
                b.sansRecherche > 0
                  ? "Réponses tirées de la mémoire du modèle, donc potentiellement périmées"
                  : "Toutes les réponses sont passées par une recherche"
              }
              delai={0.1}
            />
            <Indicateur
              libelle="Temps moyen"
              valeur={`${(b.dureeMoyenneMs / 1000).toFixed(1)} s`}
              teinte="violet"
              icone={<Clock className="w-4 h-4" />}
              aide="La plateforme coupe à 60 s"
              delai={0.15}
            />
            <Indicateur
              libelle="Coût moyen"
              valeur={`${b.coutMoyenXof.toLocaleString("fr-FR")} FCFA`}
              teinte="or"
              icone={<Coins className="w-4 h-4" />}
              aide={`${b.coutTotalXof.toLocaleString("fr-FR")} FCFA dépensés sur ces ${b.total} échanges`}
              delai={0.2}
            />
          </div>

          {/* Les règles qu'on lui a données, et celles qu'il ne tient pas.
              Une consigne qu'on ne vérifie jamais est une consigne qu'on espère. */}
          <Panneau
            titre="Les règles sont-elles tenues ?"
            sousTitre="Chaque consigne de rédaction, vérifiée sur le texte des réponses"
            icone={<Shield className="w-4 h-4" />}
            teinte={b.manquementsFrequents.length === 0 ? "vert" : "or"}
          >
            {b.manquementsFrequents.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-white/70">
                <CheckCircle2 className="w-5 h-5 text-[#10b981] shrink-0" />
                <p>Aucun manquement relevé sur les {b.total} échanges enregistrés.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {b.manquementsFrequents.map((m) => (
                  <Rapport
                    key={m.libelle}
                    libelle={m.libelle}
                    valeur={`${m.nombre} / ${b.total}`}
                    pourcentage={m.part}
                    teinte={m.part >= 30 ? "#fb7185" : "#fbbf24"}
                    detail={`${m.part} % des réponses — ${m.explication}`}
                  />
                ))}
              </div>
            )}
          </Panneau>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panneau
              titre="Outils de données appelés"
              sousTitre="Ce que l'agent va chercher le plus souvent"
              icone={<Wrench className="w-4 h-4" />}
              teinte="violet"
            >
              {b.outilsFrequents.length === 0 ? (
                <Vide message="Aucun outil de données appelé — l'agent répond par la seule recherche web." />
              ) : (
                <div className="space-y-2.5">
                  {b.outilsFrequents.slice(0, 8).map((o) => (
                    <div key={o.nom} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-white/70 truncate">{o.nom}</span>
                      <span className="text-xs font-black text-violet-400 tabular-nums shrink-0">{o.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panneau>

            <div className="lg:col-span-2">
              <Panneau
                titre="Derniers échanges"
                sousTitre="Question posée, réponse donnée, et ce que l'agent a fait pour la produire"
                icone={<MessageSquare className="w-4 h-4" />}
                teinte="cyan"
              >
                <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                  {b.echanges.slice(0, 40).map((e) => (
                    <div
                      key={e.id}
                      className="rounded-[16px] bg-[#1d2f3a] border border-[#2e4757] p-4 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <p className="text-[13px] font-bold text-white flex-1 min-w-[200px]">{e.question}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              e.recherches_web > 0
                                ? "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25"
                                : "text-rose-400 bg-rose-500/10 border-rose-500/25"
                            }`}
                          >
                            {e.recherches_web} recherche{e.recherches_web > 1 ? "s" : ""}
                          </span>
                          <span className="text-[10px] font-bold text-white/35 tabular-nums">
                            {((e.duree_ms ?? 0) / 1000).toFixed(1)} s • {e.coutXof} FCFA
                          </span>
                        </div>
                      </div>

                      <p className="text-[12px] text-white/50 mt-2 leading-relaxed line-clamp-3">{e.reponse}</p>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-[10px] text-white/25">{dateHeure(e.created_at)}</span>
                        {e.email && (
                          <span className="text-[10px] text-white/25">
                            • <LienCompte userId={e.user_id} email={e.email} />
                          </span>
                        )}
                        {(e.outils_appeles ?? []).length > 0 && (
                          <span className="text-[10px] text-white/25">
                            • {(e.outils_appeles ?? []).length} appel
                            {(e.outils_appeles ?? []).length > 1 ? "s" : ""} de données
                          </span>
                        )}
                        {e.manquements.map((m) => (
                          <span
                            key={m.cle}
                            title={m.explication}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5"
                          >
                            <AlertTriangle className="w-3 h-3" /> {m.libelle}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panneau>
            </div>
          </div>
        </>
      )}

      <div className="flex items-start gap-2 text-[11px] text-white/25">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Rien sur cette page n&apos;est jugé par une intelligence artificielle, et rien n&apos;y coûte quoi que ce
          soit : tout est constaté sur ce que l&apos;agent a fait et sur le texte qu&apos;il a écrit. La véracité
          d&apos;une affirmation n&apos;est pas mesurée — la vérifier reviendrait à refaire l&apos;enquête. Le signal
          le plus fiable reste le nombre de recherches : une réponse produite sans en lancer aucune vient de la
          mémoire du modèle, qui a des mois de retard. Ces échanges contiennent les questions d&apos;abonnés
          identifiables ; pensez à le mentionner dans vos conditions d&apos;utilisation.
        </p>
      </div>
    </div>
  );
}
