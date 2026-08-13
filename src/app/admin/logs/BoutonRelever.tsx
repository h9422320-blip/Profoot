"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { releverPaiements } from "./actions";

/**
 * Relève le sort des demandes de paiement sans attendre l'audit du lendemain.
 *
 * Le résultat est affiché en toutes lettres : « rien de nouveau » et « la
 * boutique n'a pas répondu » sont deux situations différentes, et un bouton qui
 * ne dit rien laisse croire à la première quand c'est la seconde.
 */
export default function BoutonRelever() {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setMessage(null);
            const r = await releverPaiements();
            setMessage(
              r.ok
                ? {
                    ok: true,
                    texte: r.releves
                      ? `${r.releves} demande${r.releves > 1 ? "s" : ""} relevée${r.releves > 1 ? "s" : ""}, ${r.echecs} avec un motif d'échec.`
                      : "Tout était déjà à jour : rien de nouveau à relever.",
                  }
                : { ok: false, texte: r.erreur }
            );
          })
        }
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold bg-white/[0.06] hover:bg-white/[0.11] border border-white/12 text-white/80 hover:text-white transition disabled:opacity-50 disabled:cursor-wait"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${enCours ? "animate-spin" : ""}`} />
        {enCours ? "Relevé en cours…" : "Relever maintenant"}
      </button>

      {message && (
        <span
          className={`text-[11px] ${message.ok ? "text-[#10b981]" : "text-rose-400"}`}
          role="status"
        >
          {message.texte}
        </span>
      )}
    </div>
  );
}
