"use client";

import { useState, useTransition } from "react";
import { Save, Percent } from "lucide-react";
import { reglerPartCa } from "./actions";

/**
 * Réglage de la part d'un partenaire.
 *
 * Deux valeurs, et deux seulement : le pourcentage, et la date à partir de
 * laquelle il s'applique. La date compte autant que le pourcentage — sans elle,
 * un partenaire arrivé aujourd'hui toucherait une part de tout l'historique du
 * projet.
 */
export default function ReglagePart({
  partnerId,
  partInitiale,
  depuisInitial,
}: {
  partnerId: string;
  partInitiale: number;
  depuisInitial: string | null;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [part, setPart] = useState(String(partInitiale));
  const [depuis, setDepuis] = useState(depuisInitial ?? "");

  return (
    <form
      action={(fd) =>
        demarrer(async () => {
          setMessage(null);
          const r = await reglerPartCa(fd);
          setMessage({ ok: r.ok, texte: r.message });
        })
      }
      className="space-y-4"
    >
      <input type="hidden" name="partner_id" value={partnerId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            Part du chiffre d'affaires
          </span>
          <div className="relative mt-1">
            <input
              type="number"
              name="part_ca_pct"
              value={part}
              onChange={(e) => setPart(e.target.value)}
              min={0}
              max={100}
              step="0.5"
              inputMode="decimal"
              className="w-full min-h-[48px] pl-3.5 pr-10 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[15px] font-bold outline-none focus:border-[#8b5cf6]/60"
            />
            <Percent className="w-4 h-4 text-white/30 absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </label>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            Rémunéré à partir du
          </span>
          <input
            type="date"
            name="remuneration_depuis"
            value={depuis}
            onChange={(e) => setDepuis(e.target.value)}
            className="mt-1 w-full min-h-[48px] px-3.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[15px] font-bold outline-none focus:border-[#8b5cf6]/60"
          />
        </label>
      </div>

      <p className="text-[11px] text-white/30 leading-relaxed">
        Les recettes encaissées avant cette date ne lui sont pas comptées : elles ont été faites
        sans lui.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-full text-[13px] font-black bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition disabled:opacity-50 disabled:cursor-wait"
        >
          <Save className="w-4 h-4" />
          {enCours ? "Enregistrement…" : "Enregistrer la part"}
        </button>
        {message && (
          <span
            className={`text-[12px] ${message.ok ? "text-[#10b981]" : "text-rose-400"}`}
            role="status"
          >
            {message.texte}
          </span>
        )}
      </div>
    </form>
  );
}
