"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { ouvrirAccesManuel } from "../actions";

/**
 * LE GESTE QU'ON FAIT QUAND UN CLIENT MONTRE SON REÇU.
 *
 * ── POURQUOI IL EST REPLIÉ ────────────────────────────────────────────────
 *
 * Ouvrir un accès sans encaissement est rare et lourd de conséquences : c'est
 * de l'argent qu'on renonce à demander. Un formulaire déployé en permanence
 * sur chaque fiche finit par être utilisé sans réfléchir. Il faut donc un
 * geste délibéré pour l'ouvrir, et un motif pour le valider.
 */

type PlanKey = "essential_monthly" | "pro_monthly" | "vip_yearly";

const OFFRES: { cle: PlanKey; libelle: string; jours: number }[] = [
  { cle: "essential_monthly", libelle: "Essentiel", jours: 30 },
  { cle: "pro_monthly", libelle: "Pro", jours: 30 },
  { cle: "vip_yearly", libelle: "VIP", jours: 365 },
];

export default function OuvrirAcces({ userId, email }: { userId: string; email: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [plan, setPlan] = useState<PlanKey>("essential_monthly");
  const [jours, setJours] = useState(30);
  const [motif, setMotif] = useState("");
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const choisirOffre = (cle: PlanKey) => {
    setPlan(cle);
    setJours(OFFRES.find((o) => o.cle === cle)?.jours ?? 30);
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-2 rounded-[14px] border border-[#2e4757] bg-[#1a2b36] px-4 py-2.5 text-[12.5px] font-bold text-white/60 transition-colors hover:border-amber-400/40 hover:text-white"
      >
        <KeyRound className="w-3.5 h-3.5" /> Ouvrir un accès à la main
      </button>
    );
  }

  return (
    <div className="rounded-[16px] border border-amber-400/25 bg-amber-400/[0.05] p-4 space-y-3">
      <p className="text-[12px] font-black uppercase tracking-wider text-amber-300/80">
        Ouvrir un accès sans encaissement
      </p>
      <p className="text-[12px] leading-relaxed text-white/45">
        Pour {email}. Aucun argent n&apos;est encaissé : ce montant reste à zéro dans les
        recettes, et n&apos;entre donc pas dans la part des partenaires.
      </p>

      <div className="flex flex-wrap gap-2">
        {OFFRES.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => choisirOffre(o.cle)}
            className={`min-h-[44px] rounded-[12px] border px-4 py-2 text-[12.5px] font-bold transition-colors ${
              plan === o.cle
                ? "border-amber-400 bg-amber-400/15 text-amber-200"
                : "border-[#2e4757] bg-[#1a2b36] text-white/60 hover:text-white"
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
          Durée en jours
        </span>
        <input
          type="number"
          min={1}
          max={400}
          value={jours}
          onChange={(e) => setJours(Number(e.target.value))}
          className="mt-1 w-full min-h-[44px] rounded-[12px] border border-[#2e4757] bg-[#1a2b36] px-3 text-[14px] font-bold text-white outline-none focus:border-amber-400/50"
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
          Motif — obligatoire
        </span>
        <input
          type="text"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="ex. : vente Chariow du 13 août jamais créditée, reçu fourni"
          className="mt-1 w-full min-h-[44px] rounded-[12px] border border-[#2e4757] bg-[#1a2b36] px-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-amber-400/50"
        />
      </label>

      {retour && (
        <p
          className={`text-[12.5px] font-bold ${
            retour.ok ? "text-[#10B981]" : "text-amber-300"
          }`}
        >
          {retour.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              setRetour(await ouvrirAccesManuel(userId, plan, jours, motif));
              setMotif("");
            })
          }
          className="min-h-[44px] rounded-[12px] bg-amber-400 px-5 py-2.5 text-[13px] font-black text-[#1a1200] transition-opacity disabled:opacity-50"
        >
          {enCours ? "Ouverture…" : "Ouvrir l'accès"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setRetour(null);
          }}
          className="min-h-[44px] rounded-[12px] px-4 py-2.5 text-[13px] font-bold text-white/40 hover:text-white/80"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
