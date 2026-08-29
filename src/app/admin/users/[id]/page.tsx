import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Clock, CreditCard,
  MessageSquare, Target, Trophy, User, XCircle,
} from "lucide-react";
import { getFicheUtilisateur } from "@/lib/fiche-utilisateur";
import OuvrirAcces from "./OuvrirAcces";
import { EnTete, Rapport } from "../../_components/EnTete";
import { Indicateur } from "../../_components/Indicateur";
import { Panneau } from "../../_components/Panneaux";
import { Etiquette, Vide, dateCourte, dateHeure, ilYA, montant } from "../../_components/Ui";

export const dynamic = "force-dynamic";

/**
 * Fiche d'un compte.
 *
 * La liste des utilisateurs disait « 3 analyses » sans jamais dire lesquelles.
 * C'est pourtant le contenu de ces analyses qui apprend quelque chose : ce que
 * les gens viennent chercher, sur quelles compétitions, et si les pronostics
 * qu'on leur a vendus se sont vérifiés pour eux.
 */
export default async function FicheCompte({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await getFicheUtilisateur(id);
  if (!f) notFound();

  const tauxReussite =
    f.analysesVerifiees > 0 ? Math.round((f.analysesReussies / f.analysesVerifiees) * 100) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Tous les utilisateurs
      </Link>

      <EnTete
        titre={f.email}
        sousTitre={`Inscrit ${ilYA(f.inscritLe)} • ${f.derniereConnexion ? `dernière connexion ${ilYA(f.derniereConnexion)}` : "jamais connecté"}`}
        icone={<User className="w-6 h-6" />}
        teinte={f.offre === "FREE" ? "cyan" : "violet"}
        reperes={[
          { libelle: "Offre", valeur: f.offreLibelle, accent: f.offre !== "FREE" },
          { libelle: "Analyses", valeur: String(f.analyses.length) },
          { libelle: "Total payé", valeur: f.totalPaye > 0 ? montant(f.totalPaye) : "—" },
          {
            libelle: "Analyses justes",
            valeur: tauxReussite === null ? "—" : `${tauxReussite} %`,
            accent: (tauxReussite ?? 0) >= 50,
          },
        ]}
      />

      {f.avertissements.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-[18px] bg-amber-500/10 border border-amber-500/25">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-white/60 leading-relaxed">
            {f.avertissements.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Analyses lancées"
          valeur={f.analyses.length}
          teinte="cyan"
          icone={<BarChart3 className="w-4 h-4" />}
          aide={
            f.analyses.length === 0
              ? "Ce compte n'a jamais utilisé l'Analyseur"
              : `la dernière ${ilYA(f.analyses[0].creeeLe)}`
          }
          delai={0.05}
        />
        <Indicateur
          libelle="Analyses vérifiées"
          valeur={f.analysesVerifiees}
          teinte="violet"
          icone={<Target className="w-4 h-4" />}
          aide={
            f.analysesVerifiees === 0
              ? "Aucun de ses matchs n'a encore été rejoué et comparé"
              : `${f.analysesReussies} bonne${f.analysesReussies > 1 ? "s" : ""} issue${f.analysesReussies > 1 ? "s" : ""}`
          }
          delai={0.1}
        />
        <Indicateur
          libelle="Échanges avec l'agent"
          valeur={f.echangesAgent.length}
          teinte="or"
          icone={<MessageSquare className="w-4 h-4" />}
          aide={f.offre === "VIP" ? "Réservé au VIP" : "Non inclus dans son offre"}
          delai={0.15}
        />
        <Indicateur
          libelle="Total payé"
          valeur={f.totalPaye > 0 ? montant(f.totalPaye) : "0 FCFA"}
          teinte={f.totalPaye > 0 ? "vert" : "neutre"}
          icone={<CreditCard className="w-4 h-4" />}
          aide={`${f.abonnements.length} abonnement${f.abonnements.length > 1 ? "s" : ""} enregistré${f.abonnements.length > 1 ? "s" : ""}`}
          delai={0.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Panneau titre="Le compte" icone={<User className="w-4 h-4" />} teinte="violet">
            <div className="space-y-3 text-sm">
              <Ligne libelle="Offre" valeur={<Etiquette tier={f.offre} />} />
              <Ligne libelle="Statut" valeur={<span className="text-white/70">{f.offreLibelle}</span>} />
              <Ligne libelle="Inscrit le" valeur={<span className="text-white/70">{dateHeure(f.inscritLe)}</span>} />
              <Ligne
                libelle="Dernière connexion"
                valeur={
                  <span className={f.derniereConnexion ? "text-white/70" : "text-rose-400"}>
                    {f.derniereConnexion ? dateHeure(f.derniereConnexion) : "jamais"}
                  </span>
                }
              />
              <Ligne
                libelle="E-mail confirmé"
                valeur={
                  f.emailConfirme ? (
                    <span className="inline-flex items-center gap-1.5 text-[#10b981]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> oui
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-rose-400">
                      <XCircle className="w-3.5 h-3.5" /> non
                    </span>
                  )
                }
              />
              {f.expireLe && (
                <Ligne libelle="Expire le" valeur={<span className="text-white/70">{dateCourte(f.expireLe)}</span>} />
              )}
            </div>
          </Panneau>

          {f.competitions.length > 0 && (
            <Panneau
              titre="Ce qu'il regarde"
              sousTitre="Compétitions les plus analysées par ce compte"
              icone={<Trophy className="w-4 h-4" />}
              teinte="or"
            >
              <div className="space-y-2.5">
                {f.competitions.slice(0, 8).map((c) => (
                  <div key={c.nom} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-white/70 truncate">{c.nom}</span>
                    <span className="text-xs font-black text-amber-400 tabular-nums shrink-0">{c.nombre}</span>
                  </div>
                ))}
              </div>
            </Panneau>
          )}

          {f.analysesVerifiees > 0 && tauxReussite !== null && (
            <Panneau
              titre="Ce que ProFoot lui a donné"
              sousTitre="Uniquement les matchs déjà joués et comparés"
              icone={<Target className="w-4 h-4" />}
              teinte={tauxReussite >= 50 ? "vert" : "rose"}
            >
              <Rapport
                libelle="Issues correctes"
                valeur={`${f.analysesReussies} / ${f.analysesVerifiees}`}
                pourcentage={tauxReussite}
                teinte={tauxReussite >= 50 ? "#10b981" : "#fb7185"}
                detail={`${tauxReussite} % des analyses vérifiées de ce compte ont donné le bon vainqueur`}
              />
              <p className="text-[11px] text-white/30 mt-3 leading-relaxed">
                Sur {f.analyses.length} analyse{f.analyses.length > 1 ? "s" : ""},{" "}
                {f.analyses.length - f.analysesVerifiees} n&apos;{f.analyses.length - f.analysesVerifiees > 1 ? "ont" : "a"} pas
                encore de résultat connu. Un pourcentage calculé sur si peu de matchs ne vaut rien statistiquement — il
                dit ce qu&apos;a vécu cette personne, pas la qualité du modèle.
              </p>
            </Panneau>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Panneau
            titre={`Ses analyses (${f.analyses.length})`}
            sousTitre="L'analyse donnée, et le résultat réel quand le match est joué"
            icone={<BarChart3 className="w-4 h-4" />}
            teinte="cyan"
          >
            {f.analyses.length === 0 ? (
              <Vide message="Ce compte n'a lancé aucune analyse." />
            ) : (
              <div className="space-y-2.5 max-h-[760px] overflow-y-auto pr-1">
                {f.analyses.map((a) => (
                  <div key={a.id} className="rounded-[16px] bg-[#1d2f3a] border border-[#2e4757] p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-[190px] flex-1">
                        <p className="text-[13px] font-bold text-white">
                          {a.equipe1} <span className="text-white/30">contre</span> {a.equipe2}
                        </p>
                        {a.competition && <p className="text-[11px] text-white/35 mt-0.5">{a.competition}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {a.scorePredit && (
                          <span className="text-[11px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 rounded-full px-2.5 py-0.5">
                            prédit {a.scorePredit}
                          </span>
                        )}
                        {a.scoreReel && (
                          <span
                            className={`text-[11px] font-black rounded-full px-2.5 py-0.5 border ${
                              a.vainqueurCorrect
                                ? "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25"
                                : "text-rose-400 bg-rose-500/10 border-rose-500/25"
                            }`}
                          >
                            réel {a.scoreReel}
                          </span>
                        )}
                        {a.confiance !== null && (
                          <span className="text-[10px] font-bold text-white/35">{a.confiance} % sûr</span>
                        )}
                      </div>
                    </div>

                    {a.resume && (
                      <p className="text-[12px] text-white/45 mt-2 leading-relaxed line-clamp-2">{a.resume}</p>
                    )}

                    <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[10px] text-white/25">
                      <Clock className="w-3 h-3" />
                      <span>{dateHeure(a.creeeLe)}</span>
                      {!a.verifieeLe && <span>• match pas encore vérifié</span>}
                      {a.verifieeLe && a.scoreExactCorrect && (
                        <span className="text-[#10b981] font-bold">• score exact trouvé</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panneau>

          {f.echangesAgent.length > 0 && (
            <Panneau
              titre={`Ses questions à l'Agent VIP (${f.echangesAgent.length})`}
              sousTitre="Cinquante dernières"
              icone={<MessageSquare className="w-4 h-4" />}
              teinte="or"
            >
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {f.echangesAgent.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]"
                  >
                    <p className="text-[12px] text-white/70 flex-1">{e.question}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          e.recherchesWeb > 0
                            ? "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25"
                            : "text-rose-400 bg-rose-500/10 border-rose-500/25"
                        }`}
                      >
                        {e.recherchesWeb} rech.
                      </span>
                      <span className="text-[10px] text-white/25 whitespace-nowrap">{dateCourte(e.creeLe)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panneau>
          )}

          <Panneau
            titre="Paiements"
            sousTitre="Abonnements enregistrés et demandes de paiement"
            icone={<CreditCard className="w-4 h-4" />}
            teinte="vert"
            action={<OuvrirAcces userId={f.id} email={f.email} />}
          >
            {f.abonnements.length === 0 && f.paiements.length === 0 ? (
              <Vide
                message={
                  f.estPartenaire
                    ? "Partenaire : accès offert, aucun paiement attendu."
                    : "Ce compte n'a jamais lancé de paiement."
                }
              />
            ) : (
              <div className="space-y-4">
                {f.abonnements.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]"
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/50 bg-[#16242e] border border-[#2e4757] rounded-full px-2 py-0.5">
                      {a.offre}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        a.statut === "active"
                          ? "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25"
                          : "text-white/40 bg-white/5 border-white/10"
                      }`}
                    >
                      {a.statut}
                    </span>
                    <span className="text-sm font-bold text-white flex-1 min-w-[90px]">
                      {a.montant !== null ? montant(a.montant, a.devise ?? "XOF") : "—"}
                    </span>
                    <span className="text-[11px] text-white/35">{dateCourte(a.creeLe)}</span>
                    {a.expireLe && <span className="text-[11px] text-white/35">→ {dateCourte(a.expireLe)}</span>}
                  </div>
                ))}

                {f.paiements.map((p) => (
                  <div
                    key={p.saleId}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-[14px] bg-[#16242e] border border-[#2e4757]"
                  >
                    <span className="text-base leading-none" title={p.paysNom}>
                      {p.drapeau}
                    </span>
                    <span className="text-[11px] font-bold text-white/60 min-w-[100px]">{p.paysNom}</span>
                    <span className="text-[11px] text-white/45 flex-1 min-w-[80px]">{p.offre}</span>
                    <span className="text-[11px] text-white/60">
                      {p.montant !== null ? montant(p.montant) : "—"}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        p.honoree
                          ? "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25"
                          : "text-amber-400 bg-amber-500/10 border-amber-500/25"
                      }`}
                    >
                      {p.honoree ? "abonnement livré" : "en attente"}
                    </span>
                    <span className="text-[11px] text-white/25">{dateCourte(p.creeeLe)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panneau>
        </div>
      </div>
    </div>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/35">{libelle}</span>
      {valeur}
    </div>
  );
}
