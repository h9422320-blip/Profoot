import { lireOffres } from "@/lib/offres";
import { UNLIMITED } from "@/lib/subscription";
import PricingClient, { type OffresAffichees } from "./PricingClient";

/**
 * ── LA PAGE EST MISE EN CACHE, ET VIDÉE DÈS QU'UN PRIX CHANGE ────────────
 *
 * Elle était recalculée à CHAQUE visite — une lecture en base par visiteur.
 * Le motif était juste : une page figée annoncerait un ancien tarif après un
 * changement, ce qu'il faut éviter quand on teste plusieurs prix.
 *
 * Mais le coût était réel. Mesuré le 25 août 2026 : 6 435 ms pour la première
 * visite après un moment d'inactivité, puis 996, 507, 287. Sur 1 792 visites
 * hebdomadaires, et sur LA page où se décide un achat, six secondes d'écran
 * blanc font partir des gens.
 *
 * Ce que le commentaire d'origine ignorait : `enregistrerOffres` appelle déjà
 * `revalidatePath('/pricing')`. Le cache est donc vidé à la seconde même où un
 * prix est modifié depuis l'administration — la crainte ne s'applique pas.
 *
 * Les cinq minutes ne sont qu'un filet, pour le cas où un prix serait changé
 * autrement que par le formulaire d'administration.
 */
export const revalidate = 300;

/**
 * Page des offres.
 *
 * Les prix et les quotas sont modifiables depuis l'administration : ils sont
 * lus ici, jamais écrits en dur.
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
