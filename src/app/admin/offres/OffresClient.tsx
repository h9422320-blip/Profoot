"use client";

import { useState, useTransition } from "react";
import { Save, Crown, AlertTriangle } from "lucide-react";
import { enregistrerOffres } from "./actions";

export interface LigneOffre {
  cle: string;
  libelle: string;
  prixXof: number;
  /** null = sans limite. */
  limiteAnalyses: number | null;
  agentVip: boolean;
  dureeJours: number;
  prixBoutique: number | null;
  modifieeLe: string | null;
}

/**
 * Réglage des offres.
 *
 * Trois valeurs seulement sont modifiables : le prix, le nombre d'analyses et
 * l'accès à l'Agent VIP. La durée et le niveau restent au code — ils gouvernent
 * la reconnaissance des paiements déjà encaissés, et une faute de frappe y
 * casserait des abonnements en cours.
 *
 * L'écart avec la boutique est affiché en permanence : c'est le seul moyen
 * d'éviter qu'un prix annoncé ici diffère de celui réellement facturé.
 */
export default function OffresClient({ offres }: { offres: LigneOffre[] }) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [etat, setEtat] = useState(offres);

  const modifier = (cle: string, champ: Partial<LigneOffre>) =>
    setEtat((e) => e.map((o) => (o.cle === cle ? { ...o, ...champ } : o)));

  return (
    <form
      action={(fd) =>
        demarrer(async () => {
          setMessage(null);
          const r = await enregistrerOffres(fd);
          setMessage(
            r.ok
              ? { ok: true, texte: "Offres enregistrées. Les pages tarifaires sont déjà à jour." }
              : { ok: false, texte: r.erreur }
          );
        })
      }
      className="space-y-4"
    >
      {etat.map((o) => {
        const ecart = o.prixBoutique !== null && o.prixBoutique !== o.prixXof;
        return (
          <div key={o.cle} className="rounded-[20px] border border-[#2e4757] bg-[#16242e] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-black text-white text-sm">{o.libelle}</h3>
              <span className="text-[11px] text-white/35">
                {o.dureeJours} jours · {o.cle}
              </span>
            </div>

            {/* Champs larges et hauts : l'administration se règle aussi depuis
                un téléphone, et un champ étroit ouvre un clavier qu'on vise mal. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Prix en FCFA
                </span>
                <input
                  type="number"
                  name={`prix_${o.cle}`}
                  value={o.prixXof}
                  onChange={(e) => modifier(o.cle, { prixXof: Number(e.target.value) })}
                  min={1}
                  inputMode="numeric"
                  className="mt-1 w-full min-h-[48px] px-3.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[15px] font-bold outline-none focus:border-[#10b981]/50"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Analyses par période
                </span>
                <input
                  type="number"
                  name={`analyses_${o.cle}`}
                  value={o.limiteAnalyses ?? 0}
                  onChange={(e) => modifier(o.cle, { limiteAnalyses: Number(e.target.value) })}
                  min={0}
                  disabled={o.limiteAnalyses === null}
                  inputMode="numeric"
                  className="mt-1 w-full min-h-[48px] px-3.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[15px] font-bold outline-none focus:border-[#10b981]/50 disabled:opacity-40"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  name={`illimite_${o.cle}`}
                  checked={o.limiteAnalyses === null}
                  onChange={(e) => modifier(o.cle, { limiteAnalyses: e.target.checked ? null : 20 })}
                  className="w-4 h-4 accent-[#10b981]"
                />
                <span className="text-[13px] text-white/70">Analyses illimitées</span>
              </label>

              <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  name={`vip_${o.cle}`}
                  checked={o.agentVip}
                  onChange={(e) => modifier(o.cle, { agentVip: e.target.checked })}
                  className="w-4 h-4 accent-[#FBBF24]"
                />
                <span className="text-[13px] text-white/70 inline-flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-[#FBBF24]" /> Accès à l&apos;Agent VIP
                </span>
              </label>
            </div>

            {/* L'écart avec la boutique est LA chose à ne pas rater : un prix
                annoncé ici et un autre facturé fait abandonner l'achat au
                moment précis où l'on tenait enfin l'acheteur. */}
            {ecart && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[14px] bg-rose-500/10 border border-rose-500/25">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-rose-200 leading-relaxed">
                  La boutique facture <strong>{o.prixBoutique?.toLocaleString("fr-FR")} FCFA</strong>.
                  Modifiez le produit dans Chariow, sinon l&apos;acheteur verra un prix et en paiera un autre.
                </p>
              </div>
            )}
            {o.prixBoutique === null && (
              <p className="text-[11px] text-white/30">Prix boutique non vérifiable pour le moment.</p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-full text-[13px] font-black bg-[#10b981] hover:bg-[#0ea371] text-[#06231a] transition disabled:opacity-50 disabled:cursor-wait"
        >
          <Save className="w-4 h-4" />
          {enCours ? "Enregistrement…" : "Enregistrer les offres"}
        </button>
        {message && (
          <span className={`text-[12px] ${message.ok ? "text-[#10b981]" : "text-rose-400"}`} role="status">
            {message.texte}
          </span>
        )}
      </div>
    </form>
  );
}
