import { redirect } from 'next/navigation';

// Le Tableau de Bord a été retiré : l'Analyse Tactique est la page d'accueil
// de l'application. Toute visite de /dashboard y est renvoyée.
export default function DashboardPage() {
  redirect('/analyze');
}
