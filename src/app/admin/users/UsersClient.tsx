"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck, MailWarning, Download } from "lucide-react";
import type { LigneUtilisateur } from "@/lib/admin-metrics";
import { Etiquette, Vide, dateCourte, ilYA, montant } from "../_components/Ui";

const FILTRES = [
  { cle: "tous", libelle: "Tous" },
  { cle: "payants", libelle: "Abonnés" },
  { cle: "gratuits", libelle: "Gratuits" },
  { cle: "inactifs", libelle: "Jamais connectés" },
];

type Tri = "recents" | "anciens" | "analyses" | "montant";

export default function UsersClient({ utilisateurs }: { utilisateurs: LigneUtilisateur[] }) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [tri, setTri] = useState<Tri>("recents");

  const liste = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    let r = utilisateurs.filter((u) => {
      if (terme && !u.email.toLowerCase().includes(terme)) return false;
      if (filtre === "payants") return u.offre !== "FREE";
      if (filtre === "gratuits") return u.offre === "FREE";
      if (filtre === "inactifs") return !u.derniereConnexion;
      return true;
    });

    r = [...r].sort((a, b) => {
      if (tri === "analyses") return b.nbAnalyses - a.nbAnalyses;
      if (tri === "montant") return b.montantPaye - a.montantPaye;
      const da = +new Date(a.inscritLe);
      const db = +new Date(b.inscritLe);
      return tri === "anciens" ? da - db : db - da;
    });

    return r;
  }, [utilisateurs, recherche, filtre, tri]);

  /** Export CSV : permet de retravailler la liste dans un tableur sans passer par la base. */
  function exporter() {
    const entetes = ["Email", "Offre", "Inscrit le", "Derniere connexion", "Email confirme", "Analyses", "Total paye (FCFA)", "Expire le"];
    const lignes = liste.map((u) => [
      u.email,
      u.offreLibelle,
      new Date(u.inscritLe).toLocaleDateString("fr-FR"),
      u.derniereConnexion ? new Date(u.derniereConnexion).toLocaleDateString("fr-FR") : "jamais",
      u.emailConfirme ? "oui" : "non",
      String(u.nbAnalyses),
      String(u.montantPaye),
      u.expireLe ? new Date(u.expireLe).toLocaleDateString("fr-FR") : "",
    ]);
    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `profoot-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2e4757] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une adresse e-mail..."
              className="w-full bg-[#1d2f3a] border border-[#2e4757] rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#10b981]/50"
            />
          </div>

          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="bg-[#1d2f3a] border border-[#2e4757] rounded-full py-2 px-4 text-sm text-white focus:outline-none focus:border-[#10b981]/50"
          >
            <option value="recents">Plus récents</option>
            <option value="anciens">Plus anciens</option>
            <option value="analyses">Plus d'analyses</option>
            <option value="montant">Ont le plus payé</option>
          </select>

          <button
            onClick={exporter}
            className="inline-flex items-center gap-2 bg-[#1d2f3a] border border-[#2e4757] rounded-full py-2 px-4 text-sm font-bold text-white/70 hover:text-white hover:border-[#10b981]/40 transition-colors shrink-0"
          >
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
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
          <span className="ml-auto self-center text-xs text-white/40">
            {liste.length} résultat{liste.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {liste.length === 0 ? (
        <Vide message="Aucun compte ne correspond à cette recherche." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-white/35 border-b border-[#2e4757]">
                <th className="font-bold px-5 py-3">Compte</th>
                <th className="font-bold px-5 py-3">Offre</th>
                <th className="font-bold px-5 py-3">Inscrit le</th>
                <th className="font-bold px-5 py-3">Dernière connexion</th>
                <th className="font-bold px-5 py-3 text-right">Analyses</th>
                <th className="font-bold px-5 py-3 text-right">Total payé</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((u) => (
                <tr key={u.id} className="border-b border-[#2e4757]/50 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1d2f3a] border border-[#2e4757] flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-white/70">{u.email.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-white truncate max-w-[240px]">{u.email}</span>
                      {u.estAdmin && <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      {!u.emailConfirme && <MailWarning className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Etiquette tier={u.offre} />
                    {u.expireLe && (
                      <p className="text-[10px] text-white/30 mt-1">jusqu'au {dateCourte(u.expireLe)}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-white/60">{dateCourte(u.inscritLe)}</td>
                  <td className="px-5 py-3 text-white/60">{ilYA(u.derniereConnexion)}</td>
                  <td className="px-5 py-3 text-right text-white/80 font-medium">{u.nbAnalyses}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">
                    {u.montantPaye > 0 ? montant(u.montantPaye) : <span className="text-white/25">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3 border-t border-[#2e4757] flex items-center gap-4 text-[11px] text-white/30">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Administrateur</span>
        <span className="inline-flex items-center gap-1.5"><MailWarning className="w-3.5 h-3.5 text-red-400" /> E-mail non confirmé</span>
      </div>
    </div>
  );
}
