import LandingClient from "./LandingClient";
import SectionAmbassadeurs from "@/components/landing/SectionAmbassadeurs";
import { lireAmbassadeurs } from "@/lib/ambassadeurs";

/**
 * Page d'accueil.
 *
 * L'écran est un composant client — animations, compteurs, défilement. Les
 * ambassadeurs, eux, sont lus par le SERVEUR et descendus déjà rendus : leur
 * photo et leur citation font partie de la page servie, et non d'un
 * chargement qui les ferait apparaître après coup sur une connexion mobile
 * lente. C'est aussi ce qui les rend visibles des moteurs de recherche.
 */
export const revalidate = 300;

export default async function Accueil() {
  const ambassadeurs = await lireAmbassadeurs();

  return <LandingClient ambassadeurs={<SectionAmbassadeurs ambassadeurs={ambassadeurs} />} />;
}
