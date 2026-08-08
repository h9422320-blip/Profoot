import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { Barres, Camembert } from "../_components/Graphique";
import { Panneau, Indicateur, montant } from "../_components/Ui";
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Finances</h1>
          <p className="text-sm text-white/40 mt-1">
            {montant(m.revenus.totalCumule, d)} encaissés depuis le début — {m.periode.libelle.toLowerCase()}
          </p>
        </div>
        <SelecteurPeriode />
      </div>

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
        <Indicateur libelle="Total encaissé" valeur={montant(m.revenus.totalCumule, d)} aide="Depuis la création de l'application" />
        <Indicateur
          libelle="Revenu mensuel récurrent"
          valeur={montant(m.revenus.revenuMensuelRecurrent, d)}
          aide="Abonnements actifs ramenés à 30 jours : le VIP annuel compte pour un douzième"
        />
        <Indicateur libelle="Panier moyen" valeur={montant(m.revenus.panierMoyen, d)} aide="Par abonnement souscrit" />
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
