// Squelette affiché INSTANTANÉMENT pendant qu'une page du dashboard charge.
// La navigation répond tout de suite, même en connexion lente.
export default function DashboardLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse" aria-busy="true" aria-label="Chargement...">
      {/* Titre */}
      <div className="space-y-3">
        <div className="h-8 w-64 max-w-full rounded-[16px] bg-white/10" />
        <div className="h-4 w-96 max-w-full rounded-[14px] bg-white/5" />
      </div>

      {/* Cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 rounded-[20px] border border-white/5 bg-white/[0.04]"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>

      {/* Bloc principal */}
      <div className="h-72 rounded-[20px] border border-white/5 bg-white/[0.03]" />

      {/* Indicateur discret */}
      <div className="flex items-center justify-center gap-2 pt-2 text-white/40 text-sm font-medium">
        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
        Chargement...
      </div>
    </div>
  );
}
