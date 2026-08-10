"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Vide } from "./Ui";

/** Bloc de contenu, révélé à l'entrée dans l'écran. */
export function Panneau({
  titre, sousTitre, children, action, delai = 0, icone, teinte,
}: {
  titre?: string;
  sousTitre?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  delai?: number;
  icone?: React.ReactNode;
  /** Couleur du liseré et de l'icône, pour distinguer les blocs d'un coup d'œil. */
  teinte?: "vert" | "violet" | "cyan" | "or" | "rose";
}) {
  const zone = useRef<HTMLDivElement>(null);
  const visible = useInView(zone, { once: true, margin: "-40px" });

  const texte: Record<string, string> = {
    vert: "text-[#10b981]", violet: "text-violet-400", cyan: "text-cyan-400",
    or: "text-amber-400", rose: "text-rose-400",
  };
  const liseré: Record<string, string> = {
    vert: "from-[#10b981]/70", violet: "from-violet-500/70", cyan: "from-cyan-400/70",
    or: "from-amber-400/70", rose: "from-rose-400/70",
  };
  const t = teinte ?? "vert";

  return (
    <motion.div
      ref={zone}
      initial={{ opacity: 0, y: 16 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay: delai, ease: [0.22, 1, 0.36, 1] }}
      className="group relative bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden hover:border-white/10 transition-colors"
    >
      {/* Liseré supérieur : discret au repos, il s'allume au survol. */}
      {teinte && (
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${liseré[t]} to-transparent opacity-50 group-hover:opacity-100 transition-opacity`} />
      )}

      {(titre || action) && (
        <div className="px-5 py-4 border-b border-[#2e4757] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {icone && <span className={`${texte[t]} shrink-0 mt-0.5`}>{icone}</span>}
            <div className="min-w-0">
              {titre && <h3 className="font-bold text-white text-sm">{titre}</h3>}
              {sousTitre && <p className="text-[11px] text-white/40 mt-0.5">{sousTitre}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

/** Barres de classement, remplies progressivement pour rendre l'écart lisible. */
export function Classement({
  lignes, unite,
}: {
  lignes: { nom: string; valeur: number }[];
  unite: string;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const visible = useInView(zone, { once: true, margin: "-40px" });

  if (!lignes.length) return <Vide message="Aucune donnée sur cette période." />;
  const max = Math.max(...lignes.map((l) => l.valeur));

  return (
    <div ref={zone} className="space-y-3">
      {lignes.map((l, i) => (
        <motion.div
          key={l.nom}
          initial={{ opacity: 0, x: -10 }}
          animate={visible ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="space-y-1.5 group"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/80 truncate group-hover:text-white transition-colors">{l.nom}</span>
            <span className="text-xs font-bold text-white/50 shrink-0 tabular-nums">
              {l.valeur} {unite}
            </span>
          </div>
          <div className="h-1.5 bg-[#1d2f3a] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={visible ? { width: `${max ? (l.valeur / max) * 100 : 0}%` } : {}}
              transition={{ delay: i * 0.05 + 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="h-full bg-gradient-to-r from-[#10b981] to-[#2dd4bf] rounded-full"
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
