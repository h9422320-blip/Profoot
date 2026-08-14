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

  // Le taux qui compte est celui de l'ISSUE : c'est sur elle qu'on juge un
  // pronostic. Le score exact est un bonus, spectaculaire mais rare — l'afficher
  // seul donnerait une image faussement sévère du moteur.
  const scoresExacts = preuves.filter((p) => p.scoreExact).length;
  const tauxIssue = preuves.length ? Math.round((reussites / preuves.length) * 100) : null;
  const tauxExact = preuves.length ? Math.round((scoresExacts / preuves.length) * 100) : null;

  return (
    <div className="space-y-6">
      <EnTete
        titre="Toutes les prédictions vérifiées"
        sousTitre="Chaque match joué, ce qui était annoncé et ce qui s'est passé — réussites comme ratés"
        icone={<ShieldCheck className="w-6 h-6" />}
        teinte="vert"
        reperes={[
          { libelle: "Matchs joués et vérifiés", valeur: String(preuves.length) },
          {
            libelle: "Bonne issue",
            valeur: tauxIssue === null ? "—" : `${reussites}/${preuves.length} · ${tauxIssue} %`,
            accent: (tauxIssue ?? 0) >= 50,
          },
          {
            libelle: "Score exact",
            valeur: tauxExact === null ? "—" : `${scoresExacts}/${preuves.length} · ${tauxExact} %`,
          },
          { libelle: "Ratés (privés)", valeur: String(echecs) },
          { libelle: "Sur le mur public", valeur: String(publiees) },
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
