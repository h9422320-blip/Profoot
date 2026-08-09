"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { enregistrerReleve } from "./actions";

/**
 * Saisie du relevé hebdomadaire de vues.
 *
 * Les chiffres des réseaux sociaux ne sont pas lisibles automatiquement sans
 * une intégration par plateforme et l'autorisation de l'influenceur. Ce
 * formulaire remplace l'écriture de SQL à la main chaque lundi.
 */
export default function FormulaireReleve({
  partnerId,
  debutParDefaut,
  finParDefaut,
}: {
  partnerId: string;
  debutParDefaut: string;
  finParDefaut: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] border border-dashed border-[#2e4757] text-xs font-bold text-white/50 hover:text-[#10b981] hover:border-[#10b981]/40 transition-colors"
      >
        <Plus className="w-4 h-4" /> Saisir un relevé de vues
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        setEnvoi(true);
        setMessage(null);
        const r = await enregistrerReleve(formData);
        setEnvoi(false);
        setMessage({ ok: !!r?.ok, texte: r?.message ?? "Erreur inattendue." });
        if (r?.ok) setOuvert(false);
      }}
      className="space-y-3 p-4 rounded-[16px] bg-[#1d2f3a] border border-[#2e4757]"
    >
      <input type="hidden" name="partner_id" value={partnerId} />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Du</span>
          <input
            type="date"
            name="period_start"
            defaultValue={debutParDefaut}
            required
            className="mt-1 w-full bg-[#16242e] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:border-[#10b981] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Au</span>
          <input
            type="date"
            name="period_end"
            defaultValue={finParDefaut}
            required
            className="mt-1 w-full bg-[#16242e] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:border-[#10b981] outline-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Vues de la semaine</span>
          <input
            type="number"
            name="views"
            min={0}
            placeholder="0"
            className="mt-1 w-full bg-[#16242e] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:border-[#10b981] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Publications</span>
          <input
            type="number"
            name="posts"
            min={0}
            placeholder="0"
            className="mt-1 w-full bg-[#16242e] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:border-[#10b981] outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Remarque</span>
        <input
          type="text"
          name="notes"
          placeholder="Ex. vidéo la plus vue : 40 000"
          className="mt-1 w-full bg-[#16242e] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:border-[#10b981] outline-none"
        />
      </label>

      {message && (
        <p className={`text-xs font-bold ${message.ok ? "text-[#10b981]" : "text-red-400"}`}>{message.texte}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={envoi}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[12px] bg-[#10b981] text-black text-xs font-black uppercase tracking-wider disabled:opacity-50"
        >
          {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="px-4 py-2.5 rounded-[12px] border border-[#2e4757] text-xs font-bold text-white/50 hover:text-white transition-colors"
        >
          Annuler
        </button>
      </div>

      <p className="text-[10px] text-white/25 leading-relaxed">
        Ressaisir une semaine déjà enregistrée la corrige au lieu de l&apos;ajouter deux fois.
      </p>
    </form>
  );
}
