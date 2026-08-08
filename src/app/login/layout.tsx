import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion',
  description:
    "Connectez-vous à votre compte ProFoot AI pour accéder à vos analyses de matchs, votre historique et votre Agent IA VIP.",
  alternates: { canonical: '/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
