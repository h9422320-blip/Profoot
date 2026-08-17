import LandingClient from "./LandingClient";
import SectionAmbassadeurs from "@/components/landing/SectionAmbassadeurs";
import { MurPreuves } from "@/components/preuves/SectionPreuves";
import { lireAmbassadeurs } from "@/lib/ambassadeurs";
import { getPreuvesPubliques } from "@/lib/preuves";

/**
 * Page d'accueil.
 *
 * L'écran est un composant client — animations, compteurs, défilement. Les
 * ambassadeurs, eux, sont lus par le SERVEUR et descendus déjà rendus : leur
 * photo et leur citation font partie de la page servie, et non d'un
 * chargement qui les ferait apparaître après coup sur une connexion mobile
 * lente. C'est aussi ce qui les rend visibles des moteurs de recherche.
 *
 * LE MUR DE PREUVES Y ENTRE LE 17 AOÛT 2026
 *
 * La page annonçait « Pronostics vérifiés après chaque match » et n'offrait
 * aucun moyen de le vérifier : le mur vivait derrière la connexion, et
 * /preuves n'était liée depuis nulle part de public. Un visiteur venu de
 * Google lisait la promesse, ne trouvait rien pour l'étayer, et repartait.
 *
 * Six preuves seulement ici — assez pour convaincre, pas assez pour enterrer
 * le reste de la page. Le bouton du mur emmène vers les autres, ce qui donne
 * enfin à /preuves un lien depuis la page la plus visitée du site.
 *
 * Rendu par le serveur, donc lu par les moteurs comme par les visiteurs.
 */
export const revalidate = 300;

export default async function Accueil() {
  const [ambassadeurs, { preuves, bilan, total }] = await Promise.all([
    lireAmbassadeurs(),
    getPreuvesPubliques(6),
  ]);

  // Aucune preuve vérifiée : rien ne s'affiche, pas même un cadre vide. Un
  // bloc qui promet « bientôt des preuves » souligne l'absence au lieu de la
  // combler.
  const murPreuves = preuves.length ? (
    <section className="w-full px-4 sm:px-6 py-14 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <MurPreuves preuves={preuves} bilan={bilan} total={total} />
      </div>
    </section>
  ) : null;

  return (
    <LandingClient
      ambassadeurs={<SectionAmbassadeurs ambassadeurs={ambassadeurs} />}
      preuves={murPreuves}
    />
  );
}
