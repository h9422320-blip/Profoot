import { lireOffres } from "@/lib/offres";
import { UNLIMITED } from "@/lib/subscription";
import PricingClient, { type OffresAffichees } from "./PricingClient";

export const dynamic = "force-dynamic";

/**
 * Page des offres.
 *
 * Les prix et les quotas sont modifiables depuis l'administration : ils sont
 * donc lus à chaque affichage, et jamais écrits en dur ici. Une page mise en
 * cache annoncerait un ancien tarif après un changement — c'est exactement ce
 * qu'il faut éviter quand on teste plusieurs prix.
 */
export default async function PricingPage() {
  const offres = await lireOffres();

  const affichees: OffresAffichees = Object.fromEntries(
    Object.entries(offres).map(([cle, o]) => [
      cle,
      {
        prix: o.prixXof.toLocaleString("fr-FR").replace(/\s/g, "."),
        prixBrut: o.prixXof,
        analyses: o.limiteAnalyses === UNLIMITED ? null : o.limiteAnalyses,
        agentVip: o.agentVip,
      },
    ])
  ) as OffresAffichees;

  return <PricingClient offres={affichees} />;
}
