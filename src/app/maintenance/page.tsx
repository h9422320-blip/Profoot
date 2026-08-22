import Image from "next/image";
import { Wrench } from "lucide-react";
import { lireReglages } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Maintenance en cours | ProFoot AI",
  // Cette page ne doit jamais être indexée à la place du vrai site : Google
  // pourrait la retenir comme contenu de la page d'accueil.
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const reglages = await lireReglages();

  return (
    <div className="landing-root min-h-screen flex items-center justify-center px-6 py-12 relative">
      <div className="ambient-lighting">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
      </div>
      <div className="premium-grid-bg" />

      <div className="relative z-10 w-full max-w-[480px] text-center space-y-8">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_25px_rgba(16,185,129,0.5)]">
            <Image src="/logo.png" alt={reglages.appName} width={56} height={56} className="w-full h-full object-cover scale-[1.35]" priority />
          </div>
          <span className="font-black text-3xl text-white tracking-tight" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
            {reglages.appName}
          </span>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto">
            <Wrench className="w-7 h-7 text-amber-400" />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Maintenance en cours
            </h1>
            <p className="text-zinc-400 font-medium leading-relaxed">
              {reglages.maintenanceMessage}
            </p>
          </div>

          <p className="text-sm text-zinc-500">
            Rechargez cette page dans quelques minutes. Une question ?{" "}
            <a href={`mailto:${reglages.contactEmail}`} className="text-emerald-400 hover:text-emerald-300 font-semibold">
              {reglages.contactEmail}
            </a>
          </p>
        </div>

        <p className="text-xs text-zinc-600">
          Vos données et votre abonnement ne sont pas affectés.
        </p>
      </div>
    </div>
  );
}
