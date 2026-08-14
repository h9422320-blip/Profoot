"use client";

import { libelleIssue } from "@/lib/preuves";
import { useState, useTransition } from "react";
import { CheckCircle2, Crosshair, Eye, EyeOff, RefreshCw, Star, XCircle } from "lucide-react";
import type { Preuve } from "@/lib/preuves";
import {
  changerMiseEnAvant,
  changerPublication,
  enregistrerScoreReel,
  reconstruirePreuves,
} from "./actions";

/**
 * Curation des preuves.
 *
 * C'est le seul écran de l'application où les pronostics RATÉS sont visibles.
 * Ils y sont indispensables : sans eux, impossible de voir si le moteur se
 * dégrade. Le mur public, lui, ne montre que les réussites — un choix
 * commercial assumé, à condition que rien d'affiché publiquement ne soit faux.
 */
export default function PreuvesClient({ preuves }: { preuves: Preuve[] }) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [filtre, setFiltre] = useState<"tout" | "reussites" | "echecs" | "sansScore">("tout");

  const visibles = preuves.filter((p) =>
    filtre === "reussites"
      ? p.issueCorrecte
      : filtre === "echecs"
        ? !p.issueCorrecte
        : filtre === "sansScore"
          ? !p.scoreReel
          : true
  );

  const agir = (action: () => Promise<any>, succes: string) =>
    demarrer(async () => {
      setMessage(null);
      const r = await action();
      setMessage(r?.ok ? { ok: true, texte: succes } : { ok: false, texte: r?.erreur ?? "Échec." });
    });

  const filtres = [
    { cle: "tout" as const, libelle: "Tout", n: preuves.length },
    { cle: "reussites" as const, libelle: "Réussites", n: preuves.filter((p) => p.issueCorrecte).length },
    { cle: "echecs" as const, libelle: "Ratés", n: preuves.filter((p) => !p.issueCorrecte).length },
    { cle: "sansScore" as const, libelle: "Sans score", n: preuves.filter((p) => !p.scoreReel).length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enCours}
          onClick={() => agir(reconstruirePreuves, "Preuves reconstruites depuis les analyses vérifiées.")}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full text-[12px] font-bold bg-white/[0.06] hover:bg-white/[0.11] border border-white/12 text-white/80 hover:text-white transition disabled:opacity-50 disabled:cursor-wait"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${enCours ? "animate-spin" : ""}`} />
          {enCours ? "Traitement…" : "Reconstruire depuis les analyses"}
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

      {/* Filtres — cibles tactiles pleine hauteur, ils défilent horizontalement
          sur un téléphone plutôt que de se tasser. */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {filtres.map((f) => (
          <button
            key={f.cle}
            type="button"
            onClick={() => setFiltre(f.cle)}
            className={`shrink-0 px-3.5 py-2 min-h-[40px] rounded-full text-[11px] font-bold border transition ${
              filtre === f.cle
                ? "bg-[#10b981]/15 border-[#10b981]/35 text-[#10b981]"
                : "bg-white/[0.04] border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {f.libelle} <span className="opacity-50 tabular-nums">{f.n}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="text-[12px] text-white/35 px-1 py-6 text-center">
          Aucune preuve dans ce filtre.
        </p>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((p) => (
            <LignePreuve key={p.id} p={p} enCours={enCours} agir={agir} />
          ))}
        </div>
      )}
    </div>
  );
}

function LignePreuve({
  p,
  enCours,
  agir,
}: {
  p: Preuve;
  enCours: boolean;
  agir: (action: () => Promise<any>, succes: string) => void;
}) {
  const [buts1, setButs1] = useState(() => (p.scoreReel?.match(/(\d+)/g)?.[0] ?? ""));
  const [buts2, setButs2] = useState(() => (p.scoreReel?.match(/(\d+)/g)?.[1] ?? ""));

  return (
    <div
      className={`rounded-[18px] border p-3.5 space-y-3 ${
        p.issueCorrecte
          ? "bg-[#10b981]/[0.05] border-[#10b981]/20"
          : "bg-rose-500/[0.04] border-rose-500/20"
      }`}
    >
      {/* Match. Les noms se tronquent, jamais la ligne ne déborde. */}
      <div className="flex items-center gap-2 min-w-0">
        {p.logo1 && <img src={p.logo1} alt="" className="w-5 h-5 object-contain shrink-0" />}
        <span className="text-[13px] font-bold text-white truncate min-w-0">{p.equipe1}</span>
        <span className="text-[10px] text-white/25 shrink-0">vs</span>
        <span className="text-[13px] font-bold text-white truncate min-w-0">{p.equipe2}</span>
        {p.logo2 && <img src={p.logo2} alt="" className="w-5 h-5 object-contain shrink-0" />}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        <span className="text-white/35 truncate max-w-[200px]">{p.competition || "—"}</span>
        <span className="text-white/50">
          Prono <strong className="text-white tabular-nums">{p.pronoScore ?? "—"}</strong>
        </span>
        <span className="text-white/50">
          Réel{" "}
          <strong className={`tabular-nums ${p.scoreReel ? "text-white" : "text-amber-400"}`}>
            {p.scoreReel ?? "non renseigné"}
          </strong>
        </span>
        <span className="text-white/25">{p.analysesComptees} analyse(s)</span>
      </div>

      {/* L'ISSUE, EN TOUTES LETTRES.
          Le score seul ne dit pas ce qui était annoncé : « 1-0 » contre
          « 2-2 » se lit comme un échec total, alors que l'issue prédite
          — victoire du premier — pouvait être juste. C'est sur l'issue que se
          juge un pronostic ; le score exact n'est qu'un bonus. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="text-white/35">Annoncé</span>
        <strong className="text-white/80">{libelleIssue(p.pronoIssue, p.equipe1, p.equipe2)}</strong>
        <span className="text-white/20">→</span>
        <span className="text-white/35">Résultat</span>
        <strong className={p.issueCorrecte ? "text-[#10b981]" : "text-rose-400"}>
          {p.issueReelle ? libelleIssue(p.issueReelle, p.equipe1, p.equipe2) : "en attente"}
        </strong>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {p.issueCorrecte ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25">
            <CheckCircle2 className="w-3 h-3" /> Réussi
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border text-rose-400 bg-rose-500/10 border-rose-500/25">
            <XCircle className="w-3 h-3" /> Raté
          </span>
        )}
        {p.scoreExact && (
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border text-[#FBBF24] bg-[#FBBF24]/10 border-[#FBBF24]/25">
            <Crosshair className="w-3 h-3" /> Score exact
          </span>
        )}
        {p.source === "admin" && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">
            saisi à la main
          </span>
        )}
      </div>

      {/* Saisie du vrai score. Champs numériques larges : sur un téléphone, un
          champ étroit ouvre un clavier qu'on vise mal. */}
      <form
        action={(fd) => agir(() => enregistrerScoreReel(fd), "Score enregistré.")}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={p.id} />
        <input
          name="buts1"
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          required
          value={buts1}
          onChange={(e) => setButs1(e.target.value)}
          aria-label={`Buts ${p.equipe1}`}
          className="w-16 h-11 rounded-[14px] bg-black/30 border border-white/10 text-center text-[15px] font-black text-white tabular-nums focus:border-[#10b981]/50 focus:outline-none"
        />
        <span className="text-white/30 font-black">—</span>
        <input
          name="buts2"
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          required
          value={buts2}
          onChange={(e) => setButs2(e.target.value)}
          aria-label={`Buts ${p.equipe2}`}
          className="w-16 h-11 rounded-[14px] bg-black/30 border border-white/10 text-center text-[15px] font-black text-white tabular-nums focus:border-[#10b981]/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={enCours}
          className="h-11 px-4 rounded-[14px] text-[11px] font-bold bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-white/80 transition disabled:opacity-50"
        >
          Enregistrer le score
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enCours || !p.issueCorrecte}
          title={!p.issueCorrecte ? "Un pronostic raté ne peut pas être publié" : undefined}
          onClick={() =>
            agir(
              () => changerPublication(p.id, !p.publiee),
              p.publiee ? "Preuve retirée du mur public." : "Preuve publiée."
            )
          }
          className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[11px] font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed ${
            p.publiee
              ? "bg-[#10b981]/15 border-[#10b981]/35 text-[#10b981]"
              : "bg-white/[0.04] border-white/10 text-white/50"
          }`}
        >
          {p.publiee ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {p.publiee ? "Publiée" : "Non publiée"}
        </button>

        <button
          type="button"
          disabled={enCours || !p.publiee}
          onClick={() =>
            agir(
              () => changerMiseEnAvant(p.id, !p.miseEnAvant),
              p.miseEnAvant ? "Retirée des mises en avant." : "Mise en avant."
            )
          }
          className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[11px] font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed ${
            p.miseEnAvant
              ? "bg-[#FBBF24]/15 border-[#FBBF24]/35 text-[#FBBF24]"
              : "bg-white/[0.04] border-white/10 text-white/50"
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${p.miseEnAvant ? "fill-current" : ""}`} />
          {p.miseEnAvant ? "En avant" : "Mettre en avant"}
        </button>
      </div>
    </div>
  );
}
