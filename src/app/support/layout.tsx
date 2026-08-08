import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support et aide',
  description:
    "Une question sur votre abonnement, un paiement ou une analyse ? L'équipe ProFoot AI vous répond.",
  alternates: { canonical: '/support' },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
