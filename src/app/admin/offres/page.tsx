import { Tag } from "lucide-react";
import { lireOffres } from "@/lib/offres";
import { UNLIMITED } from "@/lib/subscription";
import { EnTete } from "../_components/EnTete";
import { Panneau } from "../_components/Panneaux";
import OffresClient, { type LigneOffre } from "./OffresClient";

export const dynamic = "force-dynamic";

/**
 * Réglage des offres, sans passer par le code.
 *
 * Un lancement se règle en tâtonnant : il faut pouvoir essayer 2 000 FCFA un
 * lundi et 2 500 le jeudi. Modifier un nombre ne devrait pas demander une
 * relecture de code et un redéploiement.
 *
 * Le prix pratiqué par la boutique est relu à chaque affichage et comparé à
 * celui d'ici. C'est le seul moyen de ne jamais annoncer un tarif différent de
 * celui réellement facturé.
 */
async function prixBoutique(): Promise<Record<string, number | null>> {
  const produits: [string, string | undefined][] = [
    ["essential_monthly", process.env.CHARIOW_PRODUCT_ID_ESSENTIAL],
    ["pro_monthly", process.env.CHARIOW_PRODUCT_ID_PRO ?? process.env.CHARIOW_PRODUCT_ID_MONTHLY],
    ["vip_yearly", process.env.CHARIOW_PRODUCT_ID_VIP ?? process.env.CHARIOW_PRODUCT_ID_YEARLY],
  ];

  const entrees = await Promise.all(
    produits.map(async ([cle, id]) => {
      if (!id) return [cle, null] as const;
      try {
        const r = await fetch(`https://api.chariow.com/v1/products/${id}`, {
          headers: { Authorization: `Bearer ${process.env.CHARIOW_API_KEY}`, Accept: "application/json" },
          cache: "no-store",
        });
        const p = (await r.json())?.data;
        const valeur = Number(p?.pricing?.effective?.value);
        return [cle, Number.isFinite(valeur) ? valeur : null] as const;
      } catch {
        // La boutique est injoignable : on n'affiche pas d'écart plutôt que
        // d'en inventer un.
        return [cle, null] as const;
      }
    })
  );

  return Object.fromEntries(entrees);
}

export default async function AdminOffres() {
  const [offres, boutique] = await Promise.all([lireOffres(), prixBoutique()]);

  const lignes: LigneOffre[] = Object.values(offres).map((o) => ({
    cle: o.cle,
    libelle: o.libelle,
    prixXof: o.prixXof,
    limiteAnalyses: o.limiteAnalyses === UNLIMITED ? null : o.limiteAnalyses,
    agentVip: o.agentVip,
    dureeJours: o.dureeJours,
    prixBoutique: boutique[o.cle] ?? null,
    modifieeLe: o.modifieeLe,
  }));

  const ecarts = lignes.filter((l) => l.prixBoutique !== null && l.prixBoutique !== l.prixXof).length;

  return (
    <div className="space-y-6">
      <EnTete
        titre="Offres et tarifs"
        sousTitre="Prix, nombre d'analyses et accès à l'Agent VIP — modifiables sans toucher au code"
        icone={<Tag className="w-6 h-6" />}
        teinte="or"
        reperes={[
          { libelle: "Offres", valeur: String(lignes.length) },
          {
            libelle: "Écart avec la boutique",
            valeur: ecarts === 0 ? "aucun" : `${ecarts} offre(s)`,
            accent: ecarts === 0,
          },
        ]}
      />

      <Panneau
        titre="Réglage des offres"
        sousTitre="La durée et le niveau restent au code : ils gouvernent les abonnements déjà vendus"
        icone={<Tag className="w-4 h-4" />}
        teinte="or"
      >
        <OffresClient offres={lignes} />
      </Panneau>
    </div>
  );
}
