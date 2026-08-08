import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { Vide, dateHeure, montant } from "../_components/Ui";
import { Panneau } from "../_components/Panneaux";
import { Indicateur } from "../_components/Indicateur";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLogs({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);
  const m = await getAdminMetrics(periode);

  const parEvenement = new Map<string, number>();
  for (const p of m.paiements) parEvenement.set(p.evenement, (parEvenement.get(p.evenement) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Journal des paiements</h1>
          <p className="text-sm text-white/40 mt-1">
            Notifications reçues de Chariow, telles qu'enregistrées par l'application
          </p>
        </div>
        <SelecteurPeriode />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur libelle="Événements reçus" valeur={m.paiements.length} aide="100 plus récents" />
        <Indicateur libelle="Abonnements créés" valeur={m.abonnements.total} />
        <Indicateur libelle="Abonnements actifs" valeur={m.abonnements.actifs} accent />
        <Indicateur libelle="Total encaissé" valeur={montant(m.revenus.totalCumule, m.revenus.devise)} />
      </div>

      {parEvenement.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...parEvenement.entries()].map(([nom, n]) => (
            <span key={nom} className="text-xs font-bold text-white/70 bg-[#1d2f3a] border border-[#2e4757] rounded-full px-3 py-1.5">
              {nom} <span className="text-[#10b981]">{n}</span>
            </span>
          ))}
        </div>
      )}

      <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e4757]">
          <h3 className="font-bold text-white text-sm">Historique complet</h3>
        </div>

        {m.paiements.length === 0 ? (
          <Vide message="Aucun événement de paiement enregistré." />
        ) : (
          <div className="divide-y divide-[#2e4757]/50">
            {m.paiements.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/50 bg-[#1d2f3a] border border-[#2e4757] rounded-full px-2 py-0.5">
                  {p.fournisseur}
                </span>
                <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 rounded-full px-2.5 py-0.5">
                  {p.evenement}
                </span>
                <span className="text-sm text-white/70 flex-1 min-w-[160px] truncate">
                  {p.email ?? "(adresse non transmise)"}
                </span>
                {p.montant !== null && (
                  <span className="text-sm font-bold text-white">{montant(p.montant, p.devise ?? "XOF")}</span>
                )}
                <span className="text-[11px] text-white/35 whitespace-nowrap">{dateHeure(p.recuLe)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Panneau>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            Cette page ne montre que ce qui est réellement enregistré en base : les notifications de paiement.
            Les erreurs techniques de l'application (échecs de l'IA, délais d'attente, erreurs réseau) ne sont pas
            stockées dans la base — elles se consultent dans les journaux de Vercel. Aucune ligne affichée ici
            n'est simulée.
          </p>
        </div>
      </Panneau>
    </div>
  );
}
