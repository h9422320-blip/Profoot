import { Star } from "lucide-react";
import { lireTousAmbassadeurs } from "@/lib/ambassadeurs";
import { EnTete } from "../_components/EnTete";
import { Panneau } from "../_components/Panneaux";
import AmbassadeursClient from "./AmbassadeursClient";

export const dynamic = "force-dynamic";

/**
 * Réglage des ambassadeurs de la page d'accueil.
 *
 * Photo, nom, rôle et citation se modifient ici. Un visage sur la page la plus
 * vue du site ne devrait pas demander un déploiement.
 */
export default async function AdminAmbassadeurs() {
  const ambassadeurs = await lireTousAmbassadeurs();
  const affiches = ambassadeurs.filter((a) => a.actif && a.photoUrl).length;

  return (
    <div className="space-y-6">
      <EnTete
        titre="Ambassadeurs"
        sousTitre="Photo, nom, rôle et citation affichés sur la page d'accueil"
        icone={<Star className="w-6 h-6" />}
        teinte="or"
        reperes={[
          { libelle: "Enregistrés", valeur: String(ambassadeurs.length) },
          { libelle: "Affichés en ligne", valeur: String(affiches), accent: affiches > 0 },
        ]}
      />

      <Panneau
        titre="La liste"
        sousTitre="Sans photo, un ambassadeur n'apparaît pas sur le site"
        icone={<Star className="w-4 h-4" />}
        teinte="or"
      >
        <AmbassadeursClient ambassadeurs={ambassadeurs} />
      </Panneau>
    </div>
  );
}
