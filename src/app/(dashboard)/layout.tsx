import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
