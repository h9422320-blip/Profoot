import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { Barres, Camembert } from "../_components/Graphique";
import { montant } from "../_components/Ui";
import { Panneau } from "../_components/Panneaux";
import { Indicateur } from "../_components/Indicateur";
import { EnTete, Rapport } from "../_components/EnTete";
import { Scale, Wallet } from "lucide-react";
import FinancesClient from "./FinancesClient";

export const dynamic = "force-dynamic";

export default async function AdminFinances({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);
  const m = await getAdminMetrics(periode);
  const d = m.revenus.devise;

  return (
    <div className="space-y-6">
      <EnTete
        titre="Finances"
        sousTitre={`${montant(m.revenus.totalCumule, d)} encaissés depuis le début — ${m.periode.libelle.toLowerCase()}`}
        icone={<Wallet className="w-6 h-6" />}
        teinte="or"
        action={<SelecteurPeriode />}
        reperes={[
          { libelle: "Par abonné", valeur: `${m.liens.revenuParAbonne.toLocaleString("fr-FR")} FCFA` },
          { libelle: "Par compte inscrit", valeur: `${m.liens.revenuParCompte.toLocaleString("fr-FR")} FCFA` },
          { libelle: "Coût partenaires", valeur: `${m.liens.coutPartenairesXof.toLocaleString("fr-FR")} FCFA` },
          {
            libelle: "Résultat net",
            valeur: `${m.liens.resultatNetXof >= 0 ? "+" : ""}${m.liens.resultatNetXof.toLocaleString("fr-FR")} FCFA`,
            accent: m.liens.resultatNetXof >= 0,
          },
        ]}
      />

      {/* Ce que l'argent encaissé devient une fois les partenaires payés. Les
          recettes affichées seules donnaient une image incomplète. */}
      <Panneau
        titre="Des recettes au résultat"
        sousTitre="Ce qui reste une fois la campagne d'influence déduite"
        icone={<Scale className="w-4 h-4" />}
        teinte={m.liens.resultatNetXof >= 0 ? "vert" : "or"}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Rapport
            libelle="Encaissé"
            valeur={montant(m.revenus.totalCumule, d)}
            teinte="#fbbf24"
            detail={`${m.abonnements.total} abonnement${m.abonnements.total > 1 ? "s" : ""} souscrit${m.abonnements.total > 1 ? "s" : ""} depuis le début`}
          />
          <Rapport
            libelle="Coût des partenaires"
            valeur={`−${m.liens.coutPartenairesXof.toLocaleString("fr-FR")} FCFA`}
            teinte="#fb7185"
            detail="Forfaits versés et dû sur les vues, convertis en francs CFA"
          />
          <Rapport
            libelle="Résultat net"
            valeur={`${m.liens.resultatNetXof >= 0 ? "+" : ""}${m.liens.resultatNetXof.toLocaleString("fr-FR")} FCFA`}
            teinte={m.liens.resultatNetXof >= 0 ? "#10b981" : "#fbbf24"}
            detail={
              m.liens.resultatNetXof >= 0
                ? "La campagne est couverte par les recettes."
                : `Il manque ${Math.abs(m.liens.resultatNetXof).toLocaleString("fr-FR")} FCFA pour l'équilibre.`
            }
          />
        </div>
      </Panneau>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Revenus de la période"
          valeur={montant(m.revenus.surPeriode, d)}
          accent
          aide={
            m.periode.cle === "tout"
              ? undefined
              : `Période précédente : ${montant(m.revenus.surPeriodePrecedente, d)}`
          }
        />
        <Indicateur
          libelle="Total encaissé"
          valeur={montant(m.revenus.totalCumule, d)}
          teinte="or"
          aide={`${m.liens.revenuParCompte.toLocaleString("fr-FR")} FCFA par compte inscrit`}
          delai={0.1}
        />
        <Indicateur
          libelle="Revenu mensuel récurrent"
          valeur={montant(m.revenus.revenuMensuelRecurrent, d)}
          teinte="cyan"
          aide="Abonnements actifs ramenés à 30 jours : le VIP annuel compte pour un douzième"
          delai={0.15}
        />
        <Indicateur
          libelle="Panier moyen"
          valeur={montant(m.revenus.panierMoyen, d)}
          teinte="violet"
          aide={`Par abonnement souscrit • ${m.liens.revenuParAbonne.toLocaleString("fr-FR")} FCFA par abonné actif`}
          delai={0.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Panneau titre="Revenus encaissés" sousTitre="Montant des abonnements souscrits, par date de souscription">
            <Barres donnees={m.revenus.serie} suffixe="FCFA" hauteur={280} />
          </Panneau>
        </div>

        <Panneau titre="Abonnements actifs" sousTitre="Répartition par offre">
          <Camembert donnees={m.abonnements.parOffre.map((o) => ({ nom: o.libelle, valeur: o.nombre }))} />
        </Panneau>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicateur libelle="Abonnements actifs" valeur={m.abonnements.actifs} />
        <Indicateur libelle="Nouveaux sur la période" valeur={m.abonnements.nouveaux} />
        <Indicateur libelle="Expirés" valeur={m.abonnements.expires} aide="Ne donnent plus aucun accès" />
        <Indicateur libelle="Expirent sous 7 jours" valeur={m.abonnements.expirentBientot} aide="À relancer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {m.abonnements.parOffre.map((o) => (
          <div key={o.tier} className="bg-[#16242e] border border-[#2e4757] rounded-[20px] p-5">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{o.libelle}</p>
            <p className="text-3xl font-black text-white mt-2">{o.nombre}</p>
            <p className="text-xs text-white/40 mt-1">
              abonné{o.nombre > 1 ? "s" : ""} actif{o.nombre > 1 ? "s" : ""} — {montant(o.revenu, d)}
            </p>
          </div>
        ))}
      </div>

      <FinancesClient abonnements={m.abonnements.liste} paiements={m.paiements} />
    </div>
  );
}
