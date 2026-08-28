import { Sidebar } from "@/components/layout/Sidebar";
import AccueilEquipePreferee from "./_accueil/AccueilEquipePreferee";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* ── L'ÉTAPE D'ACCUEIL ─────────────────────────────────────────────
          Posée dans le gabarit et non dans une page : la page d'analyse est
          régénérée toutes les cinq minutes et servie identique à tout le
          monde, elle ne peut donc rien porter de personnel. Le composant
          décide lui-même de s'ouvrir — une seule fois, et seulement sur le
          parcours d'arrivée, jamais par-dessus un paiement en cours. */}
      <AccueilEquipePreferee />
      <Sidebar />
      {/* overflow-x-clip et non -hidden : `hidden` ferait de <main> un conteneur
          de défilement, ce qui neutralise tout élément `sticky` à l'intérieur
          (le bloc d'offre de la page d'analyse, notamment). `clip` coupe
          le débordement horizontal sans créer ce conteneur. */}
      <main className="flex-1 lg:ml-[260px] p-4 pb-28 md:p-8 overflow-x-clip min-h-screen pt-20 lg:pt-8 w-full lg:w-[calc(100%-260px)]">
        <div className="max-w-[1400px] mx-auto w-full">
          {children}
        </div>
      </main>
    </>
  );
}
