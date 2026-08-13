import { Suspense } from "react";
import AnalyzeClient from "./AnalyzeClient";
import SectionPreuves from "@/components/preuves/SectionPreuves";

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

export default function AnalyzePage() {
  return (
    <AnalyzeClient
      preuves={
        <Suspense fallback={null}>
          <SectionPreuves />
        </Suspense>
      }
    />
  );
}
