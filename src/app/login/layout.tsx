import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion',
  description:
    "Connectez-vous à votre compte ProFoot AI pour accéder à vos analyses de matchs, votre historique et votre Agent IA VIP.",
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
  alternates: { canonical: '/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
