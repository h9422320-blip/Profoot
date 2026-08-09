"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Eye, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { enregistrerReleve, modifierReleve, supprimerReleve } from "./actions";

export interface Releve {
  id: string;
  period_start: string;
  period_end: string;
  views: number;
  posts: number;
  notes: string | null;
}

const champ =
  "mt-1 w-full bg-[#111d25] border border-[#2e4757] rounded-[12px] px-3 py-2 text-sm text-white focus:border-[#10b981] outline-none transition-colors";
const etiquette = "text-[10px] font-bold uppercase tracking-wider text-white/40";

function dateFr(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Relevés de vues : saisie, correction et suppression.
 *
 * Les chiffres des réseaux sociaux ne sont pas lisibles automatiquement sans
 * une intégration par plateforme et l'autorisation de l'influenceur. Tout se
 * saisit donc à la main — et doit pouvoir se corriger aussi facilement, une
 * erreur de frappe sur un nombre de vues faussant directement le montant dû.
 */
export default function ListeReleves({
  partnerId,
  releves,
  debutParDefaut,
  finParDefaut,
  tauxPourMille,
}: {
  partnerId: string;
  releves: Releve[];
  debutParDefaut: string;
  finParDefaut: string;
  tauxPourMille: number;
}) {
  const [mode, setMode] = useState<{ type: "ferme" } | { type: "ajout" } | { type: "edition"; releve: Releve }>({
    type: "ferme",
  });
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const enEdition = mode.type === "edition" ? mode.releve : null;

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {mode.type === "ferme" ? (
          <motion.button
            key="bouton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setMessage(null);
              setMode({ type: "ajout" });
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[16px] border border-dashed border-[#2e4757] text-xs font-bold text-white/50 hover:text-[#10b981] hover:border-[#10b981]/50 hover:bg-[#10b981]/5 transition-all"
          >
            <Plus className="w-4 h-4" /> Saisir un relevé de vues
          </motion.button>
        ) : (
          <motion.form
            key="formulaire"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            action={async (formData) => {
              setEnvoi(true);
              setMessage(null);
              const r = enEdition ? await modifierReleve(formData) : await enregistrerReleve(formData);
              setEnvoi(false);
              setMessage({ ok: !!r?.ok, texte: r?.message ?? "Erreur inattendue." });
              if (r?.ok) setMode({ type: "ferme" });
            }}
            className="overflow-hidden space-y-3 p-4 rounded-[18px] bg-[#1d2f3a] border border-[#10b981]/25"
          >
            <input type="hidden" name="partner_id" value={partnerId} />
            {enEdition && <input type="hidden" name="releve_id" value={enEdition.id} />}

            <p className="text-xs font-black uppercase tracking-widest text-[#10b981]">
              {enEdition ? "Modifier le relevé" : "Nouveau relevé"}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={etiquette}>Du</span>
                <input type="date" name="period_start" defaultValue={enEdition?.period_start ?? debutParDefaut} required className={champ} />
              </label>
              <label className="block">
                <span className={etiquette}>Au</span>
                <input type="date" name="period_end" defaultValue={enEdition?.period_end ?? finParDefaut} required className={champ} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={etiquette}>Vues</span>
                <input type="number" name="views" min={0} defaultValue={enEdition?.views ?? ""} placeholder="0" className={champ} />
              </label>
              <label className="block">
                <span className={etiquette}>Publications</span>
                <input type="number" name="posts" min={0} defaultValue={enEdition?.posts ?? ""} placeholder="0" className={champ} />
              </label>
            </div>

            <label className="block">
              <span className={etiquette}>Remarque</span>
              <input type="text" name="notes" defaultValue={enEdition?.notes ?? ""} placeholder="Ex. vidéo la plus vue : 40 000" className={champ} />
            </label>

            {message && (
              <p className={`text-xs font-bold ${message.ok ? "text-[#10b981]" : "text-red-400"}`}>{message.texte}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={envoi}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[12px] bg-[#10b981] text-black text-xs font-black uppercase tracking-wider hover:bg-[#0ea371] disabled:opacity-50 transition-colors"
              >
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {envoi ? "Enregistrement…" : enEdition ? "Modifier" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => setMode({ type: "ferme" })}
                className="px-4 py-2.5 rounded-[12px] border border-[#2e4757] text-xs font-bold text-white/50 hover:text-white transition-colors"
              >
                Annuler
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {message && mode.type === "ferme" && (
        <p className={`text-xs font-bold ${message.ok ? "text-[#10b981]" : "text-red-400"}`}>{message.texte}</p>
      )}

      {releves.length === 0 ? (
        <p className="text-center text-xs text-white/30 py-6">
          Aucun relevé pour l&apos;instant. Les vues se saisissent chaque lundi.
        </p>
      ) : (
        releves.map((r, i) => {
          const du = (r.views / 1000) * tauxPourMille;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative overflow-hidden p-4 rounded-[16px] bg-[#1d2f3a] border border-[#2e4757] hover:border-[#10b981]/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">
                    {dateFr(r.period_start)} → {dateFr(r.period_end)}
                  </p>
                  <p className="text-[11px] text-white/35 mt-0.5">
                    {r.posts} publication{r.posts > 1 ? "s" : ""}
                    {r.notes ? ` • ${r.notes}` : ""}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-white flex items-center gap-1.5 justify-end tabular-nums">
                    <Eye className="w-4 h-4 text-white/30" />
                    {r.views.toLocaleString("fr-FR")}
                  </p>
                  <p className="text-[11px] font-bold text-[#10b981] tabular-nums">
                    {du.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setMessage(null);
                      setMode({ type: "edition", releve: r });
                    }}
                    title="Modifier"
                    className="p-2 rounded-[10px] text-white/30 hover:text-[#10b981] hover:bg-[#10b981]/10 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setASupprimer(r.id)}
                    title="Supprimer"
                    className="p-2 rounded-[10px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Confirmation : un relevé supprimé fait baisser le montant dû,
                  la suppression ne doit donc jamais partir sur un clic isolé. */}
              <AnimatePresence>
                {aSupprimer === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <form
                      action={async (formData) => {
                        setEnvoi(true);
                        const res = await supprimerReleve(formData);
                        setEnvoi(false);
                        setASupprimer(null);
                        setMessage({ ok: !!res?.ok, texte: res?.message ?? "Erreur inattendue." });
                      }}
                      className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2e4757]"
                    >
                      <input type="hidden" name="releve_id" value={r.id} />
                      <input type="hidden" name="partner_id" value={partnerId} />
                      <p className="flex-1 text-[11px] text-white/60">
                        Supprimer ce relevé ? Le montant dû baissera de{" "}
                        <span className="font-bold text-white">
                          {du.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $
                        </span>
                        .
                      </p>
                      <button
                        type="submit"
                        disabled={envoi}
                        className="px-3 py-1.5 rounded-[10px] bg-red-500/15 border border-red-500/30 text-[11px] font-black text-red-400 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                      >
                        {envoi ? "…" : "Supprimer"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setASupprimer(null)}
                        className="p-1.5 rounded-[10px] text-white/40 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
