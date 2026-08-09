import Link from "next/link";
import { AlertTriangle, ArrowRight, Eye, Megaphone, Wallet } from "lucide-react";
import { getPartenaires, montantPartenaire, totauxParDevise } from "@/lib/partenaires";
import { Indicateur } from "../_components/Indicateur";
import { Panneau } from "../_components/Panneaux";
import { Etiquette, Vide, dateCourte, ilYA } from "../_components/Ui";

export const dynamic = "force-dynamic";

/**
 * Suivi des partenaires influenceurs.
 *
 * Les accès offerts n'étaient que des adresses e-mail dans le code : rien ne
 * disait qui était la personne, ce qui avait été convenu, ni ce que ça coûtait.
 * Cette page porte la partie commerciale — contrat, dépense, retombées.
 */
export default async function PartenairesPage() {
  const partenaires = await getPartenaires();
  const totaux = totauxParDevise(partenaires);
  const vues = partenaires.reduce((t, p) => t + p.vuesCumulees, 0);
  const actifs = partenaires.filter((p) => p.status === "actif").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Partenaires</h1>
        <p className="text-sm text-white/40 mt-1">
          Influenceurs, contrats et retombées — données réelles lues dans la base
        </p>
      </div>

      {partenaires.length === 0 ? (
        <Panneau titre="Aucun partenaire" sousTitre="La table est vide ou la migration n'a pas encore été appliquée">
          <Vide message="Appliquez la migration 20260809_partenaires.sql, puis ajoutez vos partenaires." />
        </Panneau>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Indicateur libelle="Partenaires actifs" valeur={actifs} aide={`${partenaires.length} au total`} />
            <Indicateur
              libelle="Budget engagé"
              valeur={totaux.map((t) => montantPartenaire(t.engage, t.devise)).join(" + ") || "0"}
              accent
              aide={totaux.map((t) => `${montantPartenaire(t.verse, t.devise)} déjà versés`).join(" • ")}
            />
            <Indicateur libelle="Vues cumulées" valeur={vues.toLocaleString("fr-FR")} aide="Tous relevés confondus" />
            <Indicateur
              libelle="Comptes créés"
              valeur={partenaires.filter((p) => p.inscrit).length}
              aide={`${partenaires.filter((p) => !p.inscrit).length} n'ont pas encore de compte`}
            />
          </div>

          <Panneau titre="Contrats en cours" sousTitre="Cliquez sur un partenaire pour voir sa fiche complète">
            <div className="space-y-3">
              {partenaires.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/partenaires/${p.id}`}
                  className="flex items-center gap-4 p-4 rounded-[16px] bg-[#16242e] border border-[#2e4757] hover:border-[#10b981]/40 transition-colors group"
                >
                  <div
                    className={`w-11 h-11 rounded-full border flex items-center justify-center shrink-0 ${
                      p.inscrit ? "bg-[#1d2f3a] border-[#2e4757]" : "bg-amber-500/10 border-amber-500/30"
                    }`}
                  >
                    <span className={`text-sm font-black ${p.inscrit ? "text-white/70" : "text-amber-300"}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white group-hover:text-[#10b981] transition-colors">
                        {p.name}
                      </p>
                      {p.handle && <span className="text-[11px] text-white/35">{p.handle}</span>}
                      {p.accesOuvert && <Etiquette tier={p.accesOuvert} />}
                      {!p.accesOuvert && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> accès non ouvert
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/35 truncate mt-0.5">
                      {p.email}
                      {p.country ? ` • ${p.country}` : ""}
                      {p.inscrit ? ` • inscrit ${ilYA(p.inscritLe!)}` : " • compte pas encore créé"}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-white">{montantPartenaire(p.amount, p.currency)}</p>
                    <p className={`text-[10px] font-bold ${p.paid ? "text-[#10b981]" : "text-amber-400"}`}>
                      {p.paid ? `versé ${p.paid_at ? dateCourte(p.paid_at) : ""}` : "à verser"}
                    </p>
                  </div>

                  {p.vuesCumulees > 0 && (
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-sm font-black text-white flex items-center gap-1 justify-end">
                        <Eye className="w-3.5 h-3.5 text-white/40" />
                        {p.vuesCumulees.toLocaleString("fr-FR")}
                      </p>
                      <p className="text-[10px] text-white/35">vues</p>
                    </div>
                  )}

                  <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#10b981] transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </Panneau>

          <div className="flex items-start gap-2 text-[11px] text-white/30">
            <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>
              Les montants sont affichés dans la devise réellement versée, sans conversion : additionner des
              euros et des dollars donnerait un total faux.
            </p>
          </div>
        </>
      )}

      <div className="flex items-start gap-2 text-[11px] text-white/25">
        <Megaphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          L&apos;accès VIP d&apos;un partenaire reste ouvert par la liste du code, indépendamment de cette page :
          une panne de base ne peut donc pas lui retirer son accès. Un partenaire sans accès ouvert est signalé
          en orange ci-dessus.
        </p>
      </div>
    </div>
  );
}
