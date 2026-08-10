"use client";

import { motion } from "framer-motion";

/**
 * Bandeau d'ouverture commun à toutes les pages d'administration.
 *
 * Chaque page annonçait son titre en texte brut. Le même bandeau partout donne
 * une identité à l'ensemble et laisse de la place aux chiffres qui comptent :
 * les `reperes` sont les valeurs qui donnent immédiatement le contexte de la
 * page, avant même de descendre dans le détail.
 */
export function EnTete({
  titre,
  sousTitre,
  icone,
  action,
  reperes,
  teinte = "vert",
}: {
  titre: string;
  sousTitre?: string;
  icone?: React.ReactNode;
  action?: React.ReactNode;
  reperes?: { libelle: string; valeur: string; accent?: boolean }[];
  teinte?: "vert" | "violet" | "cyan" | "or";
}) {
  const halos: Record<string, string> = {
    vert: "from-[#10b981]/22",
    violet: "from-violet-500/22",
    cyan: "from-cyan-500/22",
    or: "from-amber-500/22",
  };
  const traits: Record<string, string> = {
    vert: "from-[#10b981] to-emerald-600",
    violet: "from-violet-500 to-fuchsia-600",
    cyan: "from-cyan-400 to-sky-600",
    or: "from-amber-400 to-orange-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[26px] border border-[#2e4757] bg-gradient-to-br from-[#1d2f3a] via-[#16242e] to-[#111d25] p-6 sm:p-7"
    >
      <div className={`pointer-events-none absolute -top-28 -right-20 w-80 h-80 rounded-full bg-gradient-to-br ${halos[teinte]} to-transparent blur-3xl`} />
      <div className="pointer-events-none absolute -bottom-32 -left-24 w-72 h-72 rounded-full bg-gradient-to-tr from-white/[0.04] to-transparent blur-3xl" />

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
        {icone && (
          <div className={`w-14 h-14 rounded-[18px] bg-gradient-to-br ${traits[teinte]} flex items-center justify-center shrink-0 shadow-lg shadow-black/30`}>
            <span className="text-black">{icone}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{titre}</h1>
          {sousTitre && <p className="text-sm text-white/40 mt-1">{sousTitre}</p>}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {reperes && reperes.length > 0 && (
        <div className="relative mt-6 pt-5 border-t border-white/5 flex flex-wrap gap-x-10 gap-y-4">
          {reperes.map((r, i) => (
            <motion.div
              key={r.libelle}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{r.libelle}</p>
              <p className={`text-xl font-black tabular-nums mt-0.5 ${r.accent ? "text-[#10b981]" : "text-white"}`}>
                {r.valeur}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Met un chiffre en rapport avec un autre.
 *
 * C'est l'unité de base du tableau de bord : « 3 abonnés sur 20 comptes »
 * informe là où « 3 » ne dit rien. La barre rend l'écart lisible d'un coup
 * d'œil, sans avoir à faire la division de tête.
 */
export function Rapport({
  libelle,
  valeur,
  detail,
  pourcentage,
  teinte = "#10b981",
}: {
  libelle: string;
  valeur: string;
  detail: string;
  pourcentage?: number;
  teinte?: string;
}) {
  return (
    <div className="p-4 rounded-[16px] bg-[#1d2f3a] border border-[#2e4757] hover:border-white/10 transition-colors">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">{libelle}</p>
        <p className="text-lg font-black tabular-nums" style={{ color: teinte }}>{valeur}</p>
      </div>
      {pourcentage !== undefined && (
        <div className="h-1.5 bg-[#111d25] rounded-full overflow-hidden mt-2.5">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.min(100, Math.max(0, pourcentage))}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{ backgroundColor: teinte }}
          />
        </div>
      )}
      <p className="text-[11px] text-white/30 mt-2 leading-relaxed">{detail}</p>
    </div>
  );
}
