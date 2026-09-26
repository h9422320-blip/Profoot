/**
 * LES FRAIS DE FONCTIONNEMENT — LE DESSIN SEUL.
 *
 * ── CE QUE LE PROPRIÉTAIRE A DEMANDÉ, LE 26 SEPTEMBRE 2026 ────────────────
 *
 * Pas de formulaire : « je ne veux pas qu'il y ait "inscrire la dépense" ».
 * C'est Claude qui inscrit chaque paiement, sur sa parole, par
 * `scripts/depense.mts`. La page ne fait que LIRE — pour lui comme pour le
 * partenaire, qui voient exactement la même chose.
 *
 * Et une liste bien ordonnée : un outil par ligne, du haut vers le bas, Claude
 * d'abord, puis OpenRouter, Supabase, Vercel — avec en face ce qui a été payé,
 * en dollars et en francs. Les outils payés chaque mois restent affichés même
 * à zéro : une ligne qui disparaît ne se distingue pas d'un outil oublié.
 *
 * ── POURQUOI LE DESSIN EST SÉPARÉ DE LA LECTURE ───────────────────────────
 *
 * `BlocDepenses` lit la base ; ce fichier ne fait que dessiner ce qu'on lui
 * donne. Cela permet de REGARDER l'écran au navigateur avec des chiffres
 * d'exemple, sans emprunter le compte de personne.
 */
import type { LigneDepense, TableauDuMois } from "@/lib/depenses";
import { Panneau } from "../_components/Panneaux";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/**
 * « 25 $ × 600 = 15 000 FCFA » : chaque paiement porte SON taux, celui du jour
 * où il a été payé. Revue du 26 septembre 2026 : sans lui, un mois inscrit à
 * 600 puis relu sous un taux passé à 650 aurait semblé faux de 5 000 francs à
 * qui refait la multiplication. L'euro est arrimé : 655,957, toujours.
 */
const conversion = (p: LigneDepense) => {
  if (p.devise === "XOF") return fcfa(p.montantXof);
  if (p.devise === "EUR") return `${Number(p.montant).toLocaleString("fr-FR")} € × 655,957 = ${fcfa(p.montantXof)}`;
  return `${Number(p.montant).toLocaleString("fr-FR")} $ × ${Number(p.taux).toLocaleString("fr-FR")} = ${fcfa(p.montantXof)}`;
};

/** « 26/09 » : l'année est déjà dans le titre du mois. */
const jourCourt = (iso: string) => {
  const [, m, j] = String(iso).split("-");
  return j && m ? `${j}/${m}` : String(iso);
};

/** « septembre 2026 », pas « 2026-09 ». */
const moisEnClair = (mois: string) => {
  const [an, m] = String(mois).split("-").map(Number);
  if (!an || !m) return String(mois);
  return new Date(Date.UTC(an, m - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

function Tableau({ t }: { t: TableauDuMois }) {
  return (
    <div className="rounded-[16px] border border-[#2e4757] bg-[#1a2b36] overflow-hidden">
      <p className="px-4 pt-3 pb-2 text-[12px] font-black text-white capitalize">{moisEnClair(t.mois)}</p>

      {/* En-tête des colonnes : l'outil, ce qui a été payé, et ce que cela
          retire du chiffre d'affaires. */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
        <span>Outil</span>
        <span className="text-right">Payé</span>
        <span className="text-right min-w-[92px]">En francs</span>
      </div>

      <ul>
        {t.rangees.map((r) => (
          <li key={r.fournisseur} className="border-t border-white/[0.06] px-4 py-2.5">
            <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3">
              {/* Sans min-w-0, volontairement : la colonne du nom garde au
                  moins la largeur du nom, et c'est « Payé » qui passe à la
                  ligne quand il est long, au lieu d'écrire par-dessus. */}
              <span>
                <span className="block whitespace-nowrap text-[13px] font-bold text-white">{r.nom}</span>
                {r.role && <span className="block text-[10px] text-white/35 leading-tight">{r.role}</span>}
              </span>
              <span className={`text-right text-[12px] tabular-nums ${r.paiements.length ? "text-white/70" : "text-white/25"}`}>
                {r.paye}
              </span>
              <span
                className={`text-right text-[12px] font-bold tabular-nums min-w-[92px] ${
                  r.paiements.length ? "text-[#c4b5fd]" : "text-white/25"
                }`}
              >
                {r.paiements.length ? fcfa(r.montantXof) : "—"}
              </span>
            </div>
            {/* Le détail de chaque paiement, pour que l'addition se refasse. */}
            {r.paiements.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {r.paiements.map((p) => (
                  <li key={p.cle} className="text-[10px] text-white/40 tabular-nums">
                    {jourCourt(p.jour)} · {p.libelle} · {conversion(p)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-4 py-3">
        <span className="text-[12px] font-black text-white">Total du mois</span>
        <span className="text-right text-[12px] font-bold text-white/70 tabular-nums">{t.paye}</span>
        <span className="text-right text-[13px] font-black text-[#c4b5fd] tabular-nums min-w-[92px]">
          {t.totalXof > 0 ? `− ${fcfa(t.totalXof)}` : "0 FCFA"}
        </span>
      </div>
    </div>
  );
}

export default function VueDepenses({
  taux,
  tableaux,
}: {
  /** Francs CFA pour un dollar, tel qu'il s'appliquera aux prochains paiements. */
  taux: number;
  /** Le mois en cours d'abord, puis les mois précédents qui ont des dépenses. */
  tableaux: TableauDuMois[];
}) {
  return (
    <Panneau
      titre="Frais de fonctionnement"
      sousTitre={`Retirés du chiffre d'affaires avant le partage · 1 $ = ${taux.toLocaleString("fr-FR")} FCFA pour les prochains paiements`}
      teinte="violet"
    >
      <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
        Ce que l’application paie pour tourner, outil par outil. Chaque paiement est inscrit d’après la facture
        réelle, puis retiré du chiffre d’affaires du mois avant le calcul de la part du partenaire. Suivi depuis le
        26 septembre 2026.
      </p>

      <div className="space-y-3">
        {tableaux.map((t) => (
          <Tableau key={t.mois} t={t} />
        ))}
      </div>

      <p className="text-[10px] text-white/30 mt-3 leading-relaxed">
        La commission de MakeTou n’apparaît pas ici : elle est déjà retirée automatiquement, vente par vente, sous
        « frais de boutique ».
      </p>
    </Panneau>
  );
}
