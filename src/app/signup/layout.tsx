import type { Metadata } from 'next';

// La page d'inscription est interactive : elle ne peut pas porter ses propres
// métadonnées. Ce fichier les fournit — c'est la page la plus importante à
// référencer après l'accueil, puisqu'elle transforme un visiteur en client.
export const metadata: Metadata = {
  title: 'Créer un compte gratuit',
  description:
    "Créez votre compte ProFoot AI gratuitement et lancez votre première analyse de match par intelligence artificielle : scores probables, statistiques avancées et forme des équipes.",
  alternates: { canonical: '/signup' },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
