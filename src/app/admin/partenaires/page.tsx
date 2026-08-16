import Link from "next/link";
import {
  ArrowRight, CalendarDays, Coins, Handshake, Percent, Users, Wallet,
} from "lucide-react";
import { calculerEconomie, getPartenaires } from "@/lib/partenaires";
import { Indicateur } from "../_components/Indicateur";
import { Panneau } from "../_components/Panneaux";
import { EnTete } from "../_components/EnTete";
import { Etiquette, Puce, Vide, dateCourte, ilYA } from "../_components/Ui";

export const dynamic = "force-dynamic";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/**
 * Suivi des partenaires ambassadeurs.
 *
 * Un partenaire n'est plus payé aux vues mais à la part du chiffre d'affaires :
 * il est associé au projet. La page répond donc à une question simple — ce mois
 * ci, combien le projet a-t-il encaissé, et combien lui revient-il.
 *
 * Aucun montant n'est saisi à la main. Tout se déduit des abonnements
 * réellement encaissés : un chiffre recopié finit toujours par diverger de la
 * réalité, et c'est sur celui-là qu'on paie quelqu'un.
 */
export default async function PartenairesPage() {
  const partenaires = await getPartenaires();
  const eco = calculerEconomie(partenaires);
  const moisCourant = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <EnTete
        titre="Partenaires"
        sousTitre="Ambassadeurs rémunérés au pourcentage du chiffre d'affaires mensuel"
        icone={<Handshake className="w-6 h-6" />}
        teinte="violet"
        reperes={[
          { libelle: "Partenaires", valeur: String(eco.nombrePartenaires) },
          { libelle: "Part reversée", valeur: `${eco.partTotalePct} %`, accent: true },
          { libelle: `Recettes ${moisCourant}`, valeur: fcfa(eco.recettesMoisXof) },
        ]}
      />

      {partenaires.length === 0 ? (
        <Panneau titre="Aucun partenaire" sousTitre="La table est vide">
          <Vide message="Ajoutez un partenaire dans la table partners, puis réglez sa part depuis sa fiche." />
        </Panneau>
      ) : (
        <>
          {/* ── Le partage du mois ──────────────────────────────────────────
              Trois chiffres qui doivent s'additionner sous les yeux : ce qui
              rentre, ce qui sort, ce qui reste. C'est la seule vérification
              qu'on refait vraiment tous les mois. */}
          <div className="relative overflow-hidden rounded-[26px] border border-[#8b5cf6]/30 bg-gradient-to-br from-[#8b5cf6]/12 via-[#16242e] to-[#111d25] p-6 sm:p-7">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a78bfa]">
              Partage de {moisCourant}
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Recettes encaissées
                </p>
                <p className="text-[32px] sm:text-[40px] leading-none font-black text-white tabular-nums mt-2 tracking-tight">
                  {fcfa(eco.recettesMoisXof)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Part des partenaires
                </p>
                <p className="text-[32px] sm:text-[40px] leading-none font-black text-[#a78bfa] tabular-nums mt-2 tracking-tight">
                  −{fcfa(eco.partPartenairesMoisXof)}
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">{eco.partTotalePct} % du mois</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Reste au projet
                </p>
                <p className="text-[32px] sm:text-[40px] leading-none font-black text-[#10b981] tabular-nums mt-2 tracking-tight">
                  {fcfa(eco.resteAuProjetMoisXof)}
                </p>
              </div>
            </div>

            {/* Le mois n'est pas fini : le dire évite de prendre ce montant
                pour la facture définitive. */}
            <p className="text-[11px] text-white/35 mt-5 leading-relaxed">
              Mois en cours, arrêté à aujourd'hui — ces montants montent encore à chaque vente.
              Calculé sur les abonnements réellement encaissés.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Indicateur
              libelle="Partenaires"
              valeur={eco.nombrePartenaires}
              teinte="violet"
              icone={<Users className="w-4 h-4" />}
            />
            <Indicateur
              libelle="Part du chiffre d'affaires"
              valeur={`${eco.partTotalePct} %`}
              teinte="or"
              icone={<Percent className="w-4 h-4" />}
              aide="Total reversé chaque mois"
            />
            <Indicateur
              libelle="Dû ce mois-ci"
              valeur={fcfa(eco.partPartenairesMoisXof)}
              teinte="violet"
              icone={<Coins className="w-4 h-4" />}
              aide="À verser en fin de mois"
            />
            <Indicateur
              libelle="Dû depuis le début"
              valeur={fcfa(eco.duCumuleXof)}
              teinte="cyan"
              icone={<Wallet className="w-4 h-4" />}
              aide="Tous mois confondus"
            />
          </div>

          {/* Les forfaits d'avant le nouveau modèle ont réellement été versés.
              Les faire disparaître de l'écran ferait paraître le partenariat
              moins cher qu'il ne l'a été. */}
          {eco.verseXof > 0 && (
            <p className="text-[12px] text-white/40 px-1">
              S'ajoute <strong className="text-white/70">{fcfa(eco.verseXof)}</strong> de forfaits
              déjà versés sous l'ancien contrat, avant le passage au pourcentage.
            </p>
          )}

          {/* ── Chaque partenaire, et l'historique, côte à côte ───────────
              Deux colonnes sur grand écran : la liste seule laissait la moitié
              droite vide, sur une page faite justement pour comparer des
              chiffres. */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <div className="xl:col-span-3">
          <Panneau
            titre="Les partenaires"
            sousTitre="Part réglable individuellement depuis chaque fiche"
            icone={<Handshake className="w-4 h-4" />}
            teinte="violet"
          >
            <div className="space-y-3">
              {partenaires.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/partenaires/${p.id}`}
                  className="block rounded-[20px] border border-[#2e4757] bg-[#1a2b36] p-5 hover:border-[#8b5cf6]/50 hover:bg-[#1d2f3a] transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-white text-[17px] tracking-tight">
                          {p.name}
                        </span>
                        <Puce texte={`${p.part_ca_pct} % du CA`} teinte="violet" />
                        {p.accesOuvert && <Etiquette tier={p.accesOuvert} />}
                        {!p.inscrit && <Puce texte="Pas encore inscrit" teinte="neutre" />}
                      </div>
                      <p className="text-[13px] text-white/45 mt-1.5 truncate">{p.email}</p>
                      <p className="text-[12px] text-white/35 mt-1">
                        {p.remuneration_depuis
                          ? `Rémunéré depuis le ${dateCourte(p.remuneration_depuis)}`
                          : "Aucune date de départ — rien ne lui est compté"}
                        {p.derniereConnexion && ` · vu ${ilYA(p.derniereConnexion)}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                        Dû ce mois-ci
                      </p>
                      <p className="text-[26px] leading-none font-black text-[#a78bfa] tabular-nums mt-1">
                        {fcfa(p.duMoisEnCoursXof)}
                      </p>
                      <p className="text-[12px] text-white/35 mt-1.5">
                        {p.part_ca_pct} % de {fcfa(p.recettesMoisEnCoursXof)}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#8b5cf6] mt-2">
                        Ouvrir <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Panneau>
            </div>

            {/* Historique mois par mois du partenaire principal : il occupe la
                colonne de droite et répond à la question qu'on se pose juste
                après « combien ce mois-ci » — combien les mois d'avant. */}
            <div className="xl:col-span-2">
              <Panneau
                titre="Mois par mois"
                sousTitre={partenaires[0]?.name ?? ""}
                icone={<CalendarDays className="w-4 h-4" />}
                teinte="cyan"
              >
                {(partenaires[0]?.mois ?? []).length === 0 ? (
                  <p className="text-[13px] text-white/40 py-3">
                    Aucune date de départ réglée : rien n'est encore compté.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {partenaires[0].mois.map((m) => (
                      <div
                        key={m.mois}
                        className={`flex items-center justify-between gap-3 rounded-[16px] border px-4 py-3.5 ${
                          m.clos
                            ? "border-[#2e4757] bg-[#1a2b36]"
                            : "border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.07]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-black text-white capitalize tracking-tight">
                            {m.libelle}
                          </p>
                          <p className="text-[12px] text-white/35 mt-0.5">
                            {fcfa(m.recettesXof)} · {m.ventes} vente{m.ventes > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[18px] leading-none font-black text-[#a78bfa] tabular-nums">
                            {fcfa(m.duXof)}
                          </p>
                          {!m.clos && (
                            <p className="text-[10px] font-bold text-[#a78bfa]/70 uppercase tracking-wider mt-1">
                              en cours
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panneau>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
