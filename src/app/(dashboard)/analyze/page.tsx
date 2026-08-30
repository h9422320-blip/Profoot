import { Suspense } from "react";
import AnalyzeClient from "./AnalyzeClient";
import SectionPreuves from "@/components/preuves/SectionPreuves";
import { lireOffre } from "@/lib/offres";
import { UNLIMITED } from "@/lib/subscription";
import { matchsDuJour } from "@/lib/grands-matchs-du-jour";

/**
 * La page d'analyse.
 *
 * L'écran lui-même est un composant client — il gère la sélection des équipes,
 * l'appel d'analyse, les états de chargement. La section « preuves », elle, est
 * rendue par le serveur et descendue toute faite : elle ne dépend d'aucune
 * interaction, et la calculer dans le navigateur imposerait un aller-retour
 * réseau de plus sur des connexions mobiles souvent lentes.
 *
 * Le `Suspense` isole ce chargement : si la lecture des preuves traîne, le
 * formulaire d'analyse s'affiche quand même. L'utilisateur est venu analyser un
 * match, pas lire nos références.
 */
/**
 * Régénérée toutes les cinq minutes, pas à chaque visite.
 *
 * Sans cela, la page était figée à la compilation : une preuve vérifiée cette
 * nuit ne serait jamais apparue. La rendre entièrement dynamique aurait été
 * l'autre extrême — une lecture en base à chaque ouverture, sur la page la plus
 * consultée du site, pour des données qui ne changent qu'une fois par jour.
 *
 * Le contenu propre à l'utilisateur n'est pas concerné : il est chargé par le
 * navigateur, jamais inclus dans cette page mise en cache.
 */
export const revalidate = 300;

export default async function AnalyzePage() {
  // Le prix et le quota affichés dans le paywall viennent du réglage, jamais du
  // code : c'est l'endroit exact où un tarif périmé coûte une vente. La page
  // étant régénérée toutes les cinq minutes, un changement s'y voit aussitôt.
  const essentiel = await lireOffre("essential_monthly");

  // ── LES GRANDS MATCHS DU JOUR, RELEVÉS ICI ET NON DANS LE NAVIGATEUR ──
  //
  // Le quota du fournisseur de données est la ressource la plus rare du
  // projet : il a frôlé les 100 % le 16 août 2026, et au-delà, plus aucune
  // analyse ne fonctionne pour personne. Un appel par visiteur sur la page la
  // plus consultée du site l'épuiserait en une matinée.
  //
  // La liste est donc relevée une fois par jour, rangée dans la réserve
  // partagée, et descendue toute faite. Cette page étant elle-même
  // régénérée toutes les cinq minutes, un match qui approche apparaît sans
  // que personne ne rappelle le fournisseur.
  //
  // La liste ne fait jamais échouer la page : en cas de panne du
  // fournisseur elle revient vide, et les deux sélecteurs restent entiers.
  const journee = await matchsDuJour();

  return (
    <AnalyzeClient
      offreEntree={{
        libelle: essentiel.libelle,
        prixXof: essentiel.prixXof,
        analyses: essentiel.limiteAnalyses === UNLIMITED ? null : essentiel.limiteAnalyses,
      }}
      matchsDuJour={journee}
      preuves={
        <Suspense fallback={null}>
          <SectionPreuves />
        </Suspense>
      }
    />
  );
}
