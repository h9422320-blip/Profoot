import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** Format monétaire : les montants sont en francs CFA, sans décimales. */
export function montant(valeur: number, devise = "XOF"): string {
  return `${valeur.toLocaleString("fr-FR")} ${devise === "XOF" ? "FCFA" : devise}`;
}

export function dateCourte(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateHeure(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ilYA(iso: string | null): string {
  if (!iso) return "jamais";
  const secondes = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  const jours = Math.floor(secondes / 86400);
  if (jours < 31) return `il y a ${jours} j`;
  return dateCourte(iso);
}

export function Panneau({
  titre, sousTitre, children, action,
}: {
  titre?: string; sousTitre?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
      {(titre || action) && (
        <div className="px-5 py-4 border-b border-[#2e4757] flex items-start justify-between gap-4">
          <div>
            {titre && <h3 className="font-bold text-white text-sm">{titre}</h3>}
            {sousTitre && <p className="text-[11px] text-white/40 mt-0.5">{sousTitre}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/**
 * Indicateur chiffré.
 *
 * L'évolution n'est affichée que si une période de comparaison existe réellement.
 * Une variation depuis zéro n'est pas exprimée en pourcentage : « +∞ % » ou
 * « +100 % » à partir de 0 ne veut rien dire et donnerait une fausse impression
 * de croissance.
 */
export function Indicateur({
  libelle, valeur, precedent, unite, aide, accent = false,
}: {
  libelle: string;
  valeur: number | string;
  precedent?: number;
  unite?: string;
  aide?: string;
  accent?: boolean;
}) {
  const numerique = typeof valeur === "number" ? valeur : null;
  const comparable = numerique !== null && precedent !== undefined;
  const ecart = comparable ? numerique - precedent! : 0;
  const pourcentage = comparable && precedent! > 0 ? Math.round((ecart / precedent!) * 100) : null;

  return (
    <div className={`bg-[#16242e] border rounded-[20px] p-5 ${accent ? "border-[#10b981]/40" : "border-[#2e4757]"}`}>
      <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{libelle}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <span className={`text-3xl font-black tracking-tight ${accent ? "text-[#10b981]" : "text-white"}`}>
          {typeof valeur === "number" ? valeur.toLocaleString("fr-FR") : valeur}
        </span>
        {unite && <span className="text-sm font-bold text-white/40">{unite}</span>}
      </div>

      {comparable && (
        <div className="flex items-center gap-1.5 mt-2">
          {ecart === 0 ? (
            <Minus className="w-3.5 h-3.5 text-white/30" />
          ) : ecart > 0 ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-[#10b981]" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={`text-[11px] font-bold ${ecart === 0 ? "text-white/30" : ecart > 0 ? "text-[#10b981]" : "text-red-400"}`}>
            {ecart > 0 ? "+" : ""}{ecart.toLocaleString("fr-FR")}
            {pourcentage !== null && ` (${ecart > 0 ? "+" : ""}${pourcentage} %)`}
          </span>
          <span className="text-[11px] text-white/30">vs période précédente</span>
        </div>
      )}

      {aide && <p className="text-[11px] text-white/30 mt-2 leading-relaxed">{aide}</p>}
    </div>
  );
}

export function Etiquette({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    VIP: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    PRO: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30",
    ESSENTIAL: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    FREE: "bg-white/5 text-white/40 border-white/10",
  };
  const libelles: Record<string, string> = {
    VIP: "VIP", PRO: "Pro", ESSENTIAL: "Essentiel", FREE: "Gratuit",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[tier] ?? styles.FREE}`}>
      {libelles[tier] ?? tier}
    </span>
  );
}

/** Message affiché quand une section n'a réellement aucune donnée à montrer. */
export function Vide({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-white/30">{message}</p>
    </div>
  );
}

export function Classement({
  lignes, unite,
}: {
  lignes: { nom: string; valeur: number }[];
  unite: string;
}) {
  if (!lignes.length) return <Vide message="Aucune donnée sur cette période." />;
  const max = Math.max(...lignes.map((l) => l.valeur));
  return (
    <div className="space-y-3">
      {lignes.map((l) => (
        <div key={l.nom} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/80 truncate">{l.nom}</span>
            <span className="text-xs font-bold text-white/50 shrink-0">
              {l.valeur} {unite}
            </span>
          </div>
          <div className="h-1.5 bg-[#1d2f3a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#10b981] to-[#2dd4bf] rounded-full"
              style={{ width: `${max ? (l.valeur / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
