import { ShieldCheck } from "lucide-react";
import { getToutesPreuves } from "@/lib/preuves";
import { EnTete } from "../_components/EnTete";
import { Panneau } from "../_components/Panneaux";
import { Vide } from "../_components/Ui";
import PreuvesClient from "./PreuvesClient";

export const dynamic = "force-dynamic";

/**
 * Curation du mur de preuves.
 *
 * Les pronostics sont vérifiés automatiquement contre les résultats réels du
 * fournisseur. Cet écran sert à deux choses que l'automatisme ne peut pas
 * faire : saisir un score que le fournisseur n'a pas su retrouver, et décider
 * ce qui mérite d'être montré.
 */
export default async function AdminPreuves() {
  const { preuves, reussites, echecs, publiees, indisponible } = await getToutesPreuves();

  return (
    <div className="space-y-6">
      <EnTete
        titre="Preuves publiques"
        sousTitre="Pronostics confrontés aux résultats réels — seules les réussites sont publiables"
        icone={<ShieldCheck className="w-6 h-6" />}
        teinte="vert"
        reperes={[
          { libelle: "Matchs vérifiés", valeur: String(preuves.length) },
          { libelle: "Réussites", valeur: String(reussites), accent: reussites > 0 },
          { libelle: "Ratés", valeur: String(echecs) },
          { libelle: "Publiées", valeur: String(publiees) },
        ]}
      />

      <Panneau
        titre="Toutes les rencontres vérifiées"
        sousTitre="Les ratés ne sont visibles qu'ici — jamais sur le mur public"
        icone={<ShieldCheck className="w-4 h-4" />}
        teinte="vert"
      >
        {indisponible ? (
          <Vide message="La table des preuves n'existe pas encore. Exécutez le script SQL fourni dans Supabase, puis cliquez sur « Reconstruire depuis les analyses »." />
        ) : preuves.length === 0 ? (
          <div className="space-y-4">
            <Vide message="Aucune preuve construite pour le moment." />
            <PreuvesClient preuves={[]} />
          </div>
        ) : (
          <PreuvesClient preuves={preuves} />
        )}
      </Panneau>
    </div>
  );
}
