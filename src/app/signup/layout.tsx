import type { Metadata } from 'next';

// La page d'inscription est interactive : elle ne peut pas porter ses propres
// métadonnées. Ce fichier les fournit — c'est la page la plus importante à
// référencer après l'accueil, puisqu'elle transforme un visiteur en client.
export const metadata: Metadata = {
  title: 'Créer un compte gratuit',
  description:
    "Créez votre compte ProFoot AI gratuitement et lancez votre première analyse de match par intelligence artificielle : tendances de score, statistiques avancées et forme des équipes.",
  // ── HORS DES RÉSULTATS DE RECHERCHE ────────────────────────────────────
  //
  // Décision du propriétaire, le 1er septembre 2026 : personne ne doit
  // arriver sur cette page depuis Google. Le parcours voulu part de la page
  // d'accueil, passe par l'inscription, et ne propose l'achat qu'ensuite.
  //
  // `noindex` retire l'adresse de l'index. `follow` est conservé : les liens
  // internes de la page continuent de nourrir le référencement du reste du
  // site.
  //
  // ET SURTOUT : PAS de « Disallow » dans robots.txt. Une adresse interdite
  // aux robots RESTE dans l'index de Google, marquée « bloquée » — le robot
  // n'a alors même plus le droit de venir lire le `noindex` qui l'en ferait
  // sortir. Les deux mesures se contrarient ; celle-ci suffit.
  robots: { index: false, follow: true },
  alternates: { canonical: '/signup' },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
