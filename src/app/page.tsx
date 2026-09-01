import LandingClient from "./LandingClient";
import SectionAmbassadeurs from "@/components/landing/SectionAmbassadeurs";
import SectionPreuvesAccueil from "@/components/landing/SectionPreuvesAccueil";
import { lireAmbassadeurs } from "@/lib/ambassadeurs";
import { chiffresPublics } from "@/lib/chiffres-publics";

/**
 * Page d'accueil.
 *
 * L'écran est un composant client — animations, compteurs, défilement. Les
 * ambassadeurs, eux, sont lus par le SERVEUR et descendus déjà rendus : leur
 * photo et leur citation font partie de la page servie, et non d'un
 * chargement qui les ferait apparaître après coup sur une connexion mobile
 * lente. C'est aussi ce qui les rend visibles des moteurs de recherche.
 *
 * ── LE MUR DES PREUVES SUIT LE MÊME CHEMIN ──────────────────────────────
 *
 * Il remplace les huit témoignages inventés qui occupaient cette place. Rendu
 * par le serveur pour la même raison que les ambassadeurs : ce sont des
 * rencontres réelles, avec des noms d'équipes et des scores, et elles doivent
 * faire partie de ce que Google lit.
 *
 * ── ET LES CHIFFRES AUSSI ───────────────────────────────────────────────
 *
 * Le bandeau annonçait « 500K+ matchs analysés » quand la base en contenait
 * 21 140. Il descend maintenant du serveur, calculé sur des rencontres réelles.
 */
export const revalidate = 900;

export default async function Accueil() {
  // Les deux lectures sont indépendantes : les mener de front épargne au
  // visiteur l'attente de la plus lente ajoutée à celle de l'autre.
  const [ambassadeurs, chiffres] = await Promise.all([
    lireAmbassadeurs(),
    chiffresPublics(),
  ]);

  return (
    <LandingClient
      ambassadeurs={<SectionAmbassadeurs ambassadeurs={ambassadeurs} />}
      preuves={<SectionPreuvesAccueil />}
      chiffres={chiffres}
    />
  );
}
