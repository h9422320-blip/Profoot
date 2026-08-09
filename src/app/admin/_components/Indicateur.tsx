"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** Espaces susceptibles de séparer les milliers ou le nombre de son unité. */
const ESPACES = /[\s  ]/g;
const ESPACES_FIN = /[\s  ]+$/;

/**
 * Sépare un affichage comme « 11 000 FCFA » en sa partie chiffrée et son
 * suffixe, afin de n'animer que le nombre et de conserver l'unité telle quelle.
 *
 * Une valeur purement textuelle — « En attente », « Créé », « — » — doit
 * ressortir intacte. Sans le contrôle sur la partie numérique vide, l'espace de
 * « En attente » était pris pour le nombre : nettoyé il devenait une chaîne
 * vide, converti il valait zéro, et l'affichage recollait les morceaux en
 * « En0attente ».
 */
function decouper(valeur: number | string): { nombre: number | null; prefixe: string; suffixe: string } {
  if (typeof valeur === "number") return { nombre: valeur, prefixe: "", suffixe: "" };

  const m = valeur.match(/^([^\d-]*)([\d\s  ,.]+)(.*)$/);
  if (!m) return { nombre: null, prefixe: valeur, suffixe: "" };

  const brut = m[2].replace(ESPACES, "").replace(",", ".");
  const n = Number(brut);
  if (brut === "" || !isFinite(n)) return { nombre: null, prefixe: valeur, suffixe: "" };

  // L'espace qui sépare le nombre de son unité est absorbé par le groupe
  // numérique : sans ce report, « 100 € » se recollerait en « 100€ ».
  const espaceFinal = m[2].match(ESPACES_FIN)?.[0] ?? "";

  return { nombre: n, prefixe: m[1], suffixe: espaceFinal + m[3] };
}

/** Décompte visuel jusqu'à la valeur réelle, déclenché à l'entrée dans l'écran. */
function useCompteur(cible: number | null, actif: boolean, duree = 900) {
  const [valeur, setValeur] = useState(0);

  useEffect(() => {
    if (cible === null || !actif) return;
    if (cible === 0) { setValeur(0); return; }

    let frame = 0;
    const depart = performance.now();

    const avancer = (t: number) => {
      const p = Math.min(1, (t - depart) / duree);
      // Décélération : le chiffre ralentit en approchant de sa valeur finale.
      const adouci = 1 - Math.pow(1 - p, 3);
      setValeur(cible * adouci);
      if (p < 1) frame = requestAnimationFrame(avancer);
      else setValeur(cible);
    };

    frame = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(frame);
  }, [cible, actif, duree]);

  return valeur;
}

/** Teintes disponibles pour un indicateur. */
export type TeinteIndicateur = "neutre" | "vert" | "or" | "violet" | "cyan" | "rose";

const TEINTES: Record<TeinteIndicateur, { texte: string; bordure: string; halo: string; trait: string }> = {
  neutre: { texte: "text-white", bordure: "border-[#2e4757]", halo: "from-white/5", trait: "bg-white/20" },
  vert: { texte: "text-[#10b981]", bordure: "border-[#10b981]/40", halo: "from-[#10b981]/20", trait: "bg-[#10b981]" },
  or: { texte: "text-amber-400", bordure: "border-amber-500/40", halo: "from-amber-500/20", trait: "bg-amber-400" },
  violet: { texte: "text-violet-400", bordure: "border-violet-500/40", halo: "from-violet-500/20", trait: "bg-violet-400" },
  cyan: { texte: "text-cyan-400", bordure: "border-cyan-500/40", halo: "from-cyan-500/20", trait: "bg-cyan-400" },
  rose: { texte: "text-rose-400", bordure: "border-rose-500/40", halo: "from-rose-500/20", trait: "bg-rose-400" },
};

export function Indicateur({
  libelle, valeur, precedent, unite, aide, accent = false, delai = 0, teinte, icone,
}: {
  libelle: string;
  valeur: number | string;
  precedent?: number;
  unite?: string;
  aide?: string;
  accent?: boolean;
  delai?: number;
  teinte?: TeinteIndicateur;
  icone?: React.ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const visible = useInView(zone, { once: true, margin: "-40px" });
  const { nombre, prefixe, suffixe } = decouper(valeur);
  const anime = useCompteur(nombre, visible);

  // `accent` reste accepté pour ne pas casser les appels existants ; il vaut la
  // teinte verte.
  const t = TEINTES[teinte ?? (accent ? "vert" : "neutre")];

  const brutNumerique = typeof valeur === "number" ? valeur : null;
  const comparable = brutNumerique !== null && precedent !== undefined;
  const ecart = comparable ? brutNumerique - precedent! : 0;
  // Une progression depuis zéro n'est pas exprimable en pourcentage : « +100 % »
  // à partir de 0 donnerait une fausse impression de croissance mesurée.
  const pourcentage = comparable && precedent! > 0 ? Math.round((ecart / precedent!) * 100) : null;

  const affichage =
    nombre === null
      ? String(valeur)
      : `${prefixe}${Math.round(anime).toLocaleString("fr-FR")}${suffixe}`;

  return (
    <motion.div
      ref={zone}
      initial={{ opacity: 0, y: 16 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: delai, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={`group relative overflow-hidden bg-[#16242e] border ${t.bordure} rounded-[20px] p-5 transition-colors`}
    >
      {/* Halo d'angle : donne du relief sans nuire à la lisibilité du chiffre. */}
      <div
        className={`pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${t.halo} to-transparent blur-2xl opacity-70 group-hover:opacity-100 transition-opacity duration-500`}
      />
      <div className={`absolute top-0 left-0 h-[2px] w-full ${t.trait} opacity-40`} />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{libelle}</p>
        {icone && <span className={`${t.texte} opacity-60 shrink-0`}>{icone}</span>}
      </div>

      <div className="relative flex items-baseline gap-2 mt-2">
        <span className={`text-3xl font-black tracking-tight tabular-nums ${t.texte}`}>
          {affichage}
        </span>
        {unite && <span className="text-sm font-bold text-white/40">{unite}</span>}
      </div>

      {comparable && (
        <div className="relative flex items-center gap-1.5 mt-2 flex-wrap">
          {ecart === 0 ? (
            <Minus className="w-3.5 h-3.5 text-white/30" />
          ) : ecart > 0 ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-[#10b981]" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={`text-[11px] font-bold ${ecart === 0 ? "text-white/30" : ecart > 0 ? "text-[#10b981]" : "text-red-400"}`}>
            {ecart > 0 ? "+" : ""}{ecart.toLocaleString("fr-FR")}
            {pourcentage !== null && ` (${ecart > 0 ? "+" : ""}${pourcentage} %)`}
          </span>
          <span className="text-[11px] text-white/30">vs période précédente</span>
        </div>
      )}

      {aide && <p className="relative text-[11px] text-white/30 mt-2 leading-relaxed">{aide}</p>}
    </motion.div>
  );
}
