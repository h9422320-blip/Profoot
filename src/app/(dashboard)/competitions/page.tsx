"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trophy, Globe, ChevronRight } from "lucide-react";
import Link from "next/link";
import { listerCompetitionsSuivies, type CompetitionSuivie } from "@/lib/competitions-suivies";
import { getSeasonLabel } from "@/lib/api-football";

/**
 * La liste des compétitions.
 *
 * CE QU'ELLE MONTRAIT
 *
 * Quatorze compétitions, écrites à la main. Le moteur, lui, en suit
 * soixante-deux depuis l'ajout des cinquante-trois premières divisions
 * d'Europe. Un abonné qui cherchait le championnat suisse, grec ou israélien
 * ne le trouvait nulle part — alors que l'application l'analyse et en connaît
 * le classement.
 *
 * L'ÉTAT VIENT DU SERVEUR, JAMAIS D'ICI
 *
 * « En cours », « Débute le 21 août », le leader du moment : tout cela est lu
 * en direct. C'est ce qui distingue une page à jour d'une page qui affiche la
 * saison passée comme s'il s'agissait de l'actualité.
 */
export default function CompetitionsPage() {
  const [statuts, setStatuts] = useState<Record<string, any>>({});
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    fetch("/api/competitions/status")
      .then((r) => (r.ok ? r.json() : { statuses: {} }))
      .then(({ statuses }) => setStatuts(statuses || {}))
      .catch(() => {
        /* la liste reste affichée, sans état */
      });
  }, []);

  const toutes = useMemo(() => listerCompetitionsSuivies(), []);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return toutes;
    return toutes.filter(
      (c) => c.nom.toLowerCase().includes(q) || c.pays.toLowerCase().includes(q)
    );
  }, [toutes, recherche]);

  const coupes = filtrees.filter((c) => c.region === "continentale" || c.region === "afrique");
  const championnats = filtrees.filter((c) => c.region === "europe");

  // Une compétition qui a commencé passe devant : c'est celle qu'on vient
  // consulter en pleine saison. Celles qui viennent de s'achever — le Kosovo a
  // son champion — ne peuvent pas figurer sous « en cours » : le titre du bloc
  // contredirait la ligne qu'il contient.
  const estTerminee = (c: CompetitionSuivie) => /termin/i.test(statuts[c.id]?.status || "");
  const enCours = championnats.filter((c) => (statuts[c.id]?.played ?? 0) > 0 && !estTerminee(c));
  const terminees = championnats.filter((c) => estTerminee(c));
  const aVenir = championnats.filter(
    (c) => (statuts[c.id]?.played ?? 0) === 0 && !estTerminee(c)
  );

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 pt-8 px-4 font-sans">
      <div className="text-center flex flex-col gap-2 mb-8">
        <h1 className="text-[28px] font-bold text-white tracking-tight">Compétitions</h1>
        <p className="text-white/70 text-[15px]">
          {toutes.length} compétitions suivies, de la Ligue des champions aux championnats nationaux
        </p>
      </div>

      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-white/30" />
        </div>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un championnat ou un pays…"
          className="w-full bg-[#243542] border border-transparent rounded-[16px] py-4 pl-14 pr-4 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:border-[#10B981]/50 transition-colors"
        />
      </div>

      {filtrees.length === 0 && (
        <p className="text-center text-white/40 text-[14px] py-10">
          Aucune compétition ne correspond à « {recherche} ».
        </p>
      )}

      <Bloc titre="Coupes" icone={<Trophy className="w-5 h-5 text-[#FDE047]" />} liste={coupes} statuts={statuts} />
      <Bloc
        titre="Championnats en cours"
        icone={<Globe className="w-5 h-5 text-[#10B981]" />}
        liste={enCours}
        statuts={statuts}
      />
      <Bloc
        titre="Championnats à venir"
        icone={<Globe className="w-5 h-5 text-white/40" />}
        liste={aVenir}
        statuts={statuts}
      />
      <Bloc
        titre="Saisons terminées"
        icone={<Globe className="w-5 h-5 text-white/25" />}
        liste={terminees}
        statuts={statuts}
      />
    </div>
  );
}

function Bloc({
  titre,
  icone,
  liste,
  statuts,
}: {
  titre: string;
  icone: React.ReactNode;
  liste: CompetitionSuivie[];
  statuts: Record<string, any>;
}) {
  if (liste.length === 0) return null;

  return (
    <section className="mb-8 flex flex-col gap-4">
      <div className="flex items-center gap-3 px-1 mb-1">
        {icone}
        <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-widest">{titre}</h2>
        <span className="text-[13px] font-bold text-white/25">{liste.length}</span>
      </div>

      <div className="flex flex-col gap-3">
        {liste.map((c) => (
          <Ligne key={c.id} comp={c} statut={statuts[c.id]} />
        ))}
      </div>
    </section>
  );
}

function Ligne({ comp, statut }: { comp: CompetitionSuivie; statut?: any }) {
  const commence = (statut?.played ?? 0) > 0;

  return (
    <Link href={`/competitions/${comp.id}`} className="block group">
      <div className="bg-[#243542] hover:bg-[#232D40] border border-transparent rounded-[20px] p-5 flex items-center gap-5 transition-colors">
        <div className="w-[48px] h-[48px] shrink-0 bg-[#121824] rounded-[14px] flex items-center justify-center p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={comp.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h3 className="text-white font-bold text-[16px] truncate">{comp.nom}</h3>
          <p className="text-white/50 text-[13px] truncate">
            {comp.pays} • {statut?.season || getSeasonLabel(comp.id)}
          </p>
          {/* L'état réel, tel que le serveur le constate : « En cours — Espanyol
              en tête », « Débute le 21 août ». C'est l'information qu'on vient
              chercher en pleine saison. */}
          {statut?.status && (
            <p className={`text-[12px] truncate mt-0.5 ${commence ? "text-[#10B981]" : "text-white/35"}`}>
              {statut.status}
            </p>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 shrink-0" />
      </div>
    </Link>
  );
}
