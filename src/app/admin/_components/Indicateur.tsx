"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/**
 * Sépare un affichage comme « 11 000 FCFA » en sa partie chiffrée et son
 * suffixe, afin de n'animer que le nombre et de conserver l'unité telle quelle.
 */
function decouper(valeur: number | string): { nombre: number | null; prefixe: string; suffixe: string } {
  if (typeof valeur === "number") return { nombre: valeur, prefixe: "", suffixe: "" };
  const m = valeur.match(/^([^\d-]*)([\d\s ,.]+)(.*)$/);
  if (!m) return { nombre: null, prefixe: valeur, suffixe: "" };
  const brut = m[2].replace(/[\s ]/g, "").replace(",", ".");
  const n = Number(brut);
  if (!isFinite(n)) return { nombre: null, prefixe: valeur, suffixe: "" };
  return { nombre: n, prefixe: m[1], suffixe: m[3] };
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

export function Indicateur({
  libelle, valeur, precedent, unite, aide, accent = false, delai = 0,
}: {
  libelle: string;
  valeur: number | string;
  precedent?: number;
  unite?: string;
  aide?: string;
  accent?: boolean;
  delai?: number;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const visible = useInView(zone, { once: true, margin: "-40px" });
  const { nombre, prefixe, suffixe } = decouper(valeur);
  const anime = useCompteur(nombre, visible);

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
      initial={{ opacity: 0, y: 14 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: delai, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={`bg-[#16242e] border rounded-[20px] p-5 transition-colors ${
        accent ? "border-[#10b981]/40 hover:border-[#10b981]/70" : "border-[#2e4757] hover:border-[#2e4757]/80"
      }`}
    >
      <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{libelle}</p>

      <div className="flex items-baseline gap-2 mt-2">
        <span className={`text-3xl font-black tracking-tight tabular-nums ${accent ? "text-[#10b981]" : "text-white"}`}>
          {affichage}
        </span>
        {unite && <span className="text-sm font-bold text-white/40">{unite}</span>}
      </div>

      {comparable && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
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

      {aide && <p className="text-[11px] text-white/30 mt-2 leading-relaxed">{aide}</p>}
    </motion.div>
  );
}
