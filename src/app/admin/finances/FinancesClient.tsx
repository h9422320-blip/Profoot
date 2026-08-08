"use client";

import { useMemo, useState } from "react";
import { Download, CheckCircle2, XCircle } from "lucide-react";
import type { LigneAbonnement, EvenementPaiement } from "@/lib/admin-metrics";
import { Vide, dateCourte, dateHeure, montant } from "../_components/Ui";

const FILTRES = [
  { cle: "tous", libelle: "Tous" },
  { cle: "actifs", libelle: "Actifs" },
  { cle: "expires", libelle: "Expirés" },
];

export default function FinancesClient({
  abonnements,
  paiements,
}: {
  abonnements: LigneAbonnement[];
  paiements: EvenementPaiement[];
}) {
  const [filtre, setFiltre] = useState("tous");

  const liste = useMemo(
    () =>
      abonnements.filter((s) =>
        filtre === "actifs" ? s.actif : filtre === "expires" ? !s.actif : true
      ),
    [abonnements, filtre]
  );

  function exporter() {
    const entetes = ["Email", "Offre", "Montant", "Devise", "Statut", "Souscrit le", "Expire le", "Fournisseur"];
    const lignes = liste.map((s) => [
      s.email, s.offreLibelle, String(s.montant), s.devise,
      s.actif ? "actif" : "expire",
      new Date(s.souscritLe).toLocaleDateString("fr-FR"),
      s.expireLe ? new Date(s.expireLe).toLocaleDateString("fr-FR") : "",
      s.fournisseur ?? "",
    ]);
    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `profoot-abonnements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e4757] flex flex-wrap items-center gap-3">
          <h3 className="font-bold text-white text-sm mr-auto">Tous les abonnements</h3>
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              onClick={() => setFiltre(f.cle)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                filtre === f.cle
                  ? "bg-[#10b981] text-black border-[#10b981]"
                  : "bg-[#1d2f3a] text-white/60 border-[#2e4757] hover:text-white"
              }`}
            >
              {f.libelle}
            </button>
          ))}
          <button
            onClick={exporter}
            className="inline-flex items-center gap-2 bg-[#1d2f3a] border border-[#2e4757] rounded-full py-1.5 px-3 text-xs font-bold text-white/70 hover:text-white hover:border-[#10b981]/40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exporter
          </button>
        </div>

        {liste.length === 0 ? (
          <Vide message="Aucun abonnement pour ce filtre." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-white/35 border-b border-[#2e4757]">
                  <th className="font-bold px-5 py-3">Compte</th>
                  <th className="font-bold px-5 py-3">Offre</th>
                  <th className="font-bold px-5 py-3 text-right">Montant</th>
                  <th className="font-bold px-5 py-3">Souscrit le</th>
                  <th className="font-bold px-5 py-3">Expire le</th>
                  <th className="font-bold px-5 py-3">État</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((s) => (
                  <tr key={s.id} className="border-b border-[#2e4757]/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-white truncate max-w-[240px]">{s.email}</td>
                    <td className="px-5 py-3 text-white/70">
                      {s.offreLibelle}
                      {s.offre !== s.offreLibelle && (
                        <span className="block text-[10px] text-white/25">clé : {s.offre}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-white">{montant(s.montant, s.devise)}</td>
                    <td className="px-5 py-3 text-white/60">{dateCourte(s.souscritLe)}</td>
                    <td className="px-5 py-3 text-white/60">{dateCourte(s.expireLe)}</td>
                    <td className="px-5 py-3">
                      {s.actif ? (
                        <span className="inline-flex items-center gap-1.5 text-[#10b981] text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-white/35 text-xs font-bold">
                          <XCircle className="w-3.5 h-3.5" /> Expiré
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e4757]">
          <h3 className="font-bold text-white text-sm">Événements de paiement reçus</h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            Notifications envoyées par Chariow, dans l'ordre d'arrivée
          </p>
        </div>

        {paiements.length === 0 ? (
          <Vide message="Aucun événement de paiement enregistré." />
        ) : (
          <div className="divide-y divide-[#2e4757]/50">
            {paiements.slice(0, 25).map((p) => (
              <div key={p.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 rounded-full px-2.5 py-0.5">
                  {p.evenement}
                </span>
                <span className="text-sm text-white/70 flex-1 min-w-[160px] truncate">
                  {p.email ?? "(adresse non transmise)"}
                </span>
                {p.montant !== null && (
                  <span className="text-sm font-bold text-white">{montant(p.montant, p.devise ?? "XOF")}</span>
                )}
                <span className="text-[11px] text-white/35">{dateHeure(p.recuLe)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
