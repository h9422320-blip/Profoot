"use client";

import { useState, useRef, useEffect } from "react";
import PaywallDeuxChemins from "./PaywallDeuxChemins";
import { Brain, Target, Shield, Zap, BarChart3, ChevronRight, ChevronDown, ChevronLeft, Search, Pin, Award, Trophy, Timer, X, Activity, History, Loader, AlertTriangle, RefreshCcw, Lock, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { clubs, getClub, matches, competitions } from "@/lib/data";
import chargerADemande from "next/dynamic";
import { signalerEtape } from "@/components/etapes-vente";
import { usePaysAcheteur } from "@/components/usePaysAcheteur";
import { fuseauDuNavigateur } from "@/lib/pays-acheteur";
import { reserverOngletPaiement, partirPayer, libererOnglet } from "@/lib/depart-paiement";
import { heureLocale, dateLongueLocale, jourEtMoisLocaux } from "@/lib/heure-locale";
import type { MatchDuJour } from "@/lib/grands-matchs-du-jour";

/**
 * La notice est chargee A LA DEMANDE, comme sur le paywall et les tarifs.
 *
 * Elle embarque la table des moyens de paiement des 243 pays — quarante-huit
 * kilo-octets. La page d analyse est la plus visitee du site : l imposer a
 * tout le monde pour les rares membres qui tombent a sec l alourdirait pour
 * rien.
 */
const NoticePaiement = chargerADemande(() => import("@/components/NoticePaiement"), { ssr: false });

/**
 * Le carrousel des grands matchs du jour.
 *
 * Chargé à la demande, comme la notice : il n'est utile qu'avant le premier
 * résultat, et la page d'analyse est la plus visitée du site.
 */
const MatchsDuJour = chargerADemande(() => import("./MatchsDuJour"), { ssr: false });

// Extract future matches for the "Prochains matchs" list
const futureMatches = matches.filter(m => m.status === "upcoming");

/**
 * Inscrit au référentiel local un club venu de la recherche.
 *
 * SANS CECI, LE CLUB S'AFFICHE « INCONNU ».
 *
 * Le sélecteur ne renvoie qu'un identifiant ; tout le reste de l'écran lit le
 * nom et le logo dans `clubs`. Un club trouvé hors des championnats préchargés
 * n'y figure pas : l'utilisateur le choisissait, et se retrouvait devant
 * « Inconnu » et un logo cassé. Trouvé, puis perdu à l'affichage — c'est ce
 * qu'a vécu le FC Bâle le jour de Bâle–Barcelone.
 */
function enregistrerClub(t: any) {
  if ((clubs as any)[t.id]) return;
  (clubs as any)[t.id] = {
    id: t.id,
    name: t.name,
    shortName: (t.name ?? '').slice(0, 3).toUpperCase(),
    logo: t.logo,
    country: t.country ?? 'N/A',
    league: t.league || 'ucl',
    stadium: t.stadium || 'Stade',
    coach: 'N/A',
    ranking: 0,
    points: 0,
    squad: [],
    form: [],
    stats: { played: 0, wins: 0, draws: 0, losses: 0, goalsScored: 0, goalsConceded: 0, possession: 0, xG: 0, cleanSheets: 0 },
  };
}

// Group clubs by league for the picker
const leagueOrder = [
  "ucl", "epl", "laliga", "ligue1", "seriea", "bundesliga",
  "eredivisie", "ligaportugal", "proleague", "premiership", "superlig",
  // Ajoutés le 16/08/2026 : sans la Suisse, le FC Bâle était introuvable un
  // jour de Bâle–Barcelone, et le match ne pouvait pas être analysé.
  "suisse", "autriche", "grece", "danemark", "norvege", "suede",
  "pologne", "tchequie", "croatie", "serbie", "ukraine", "roumanie",
  "russie", "israel", "chypre", "hongrie", "bulgarie", "slovaquie",
  "slovenie", "bosnie", "kazakhstan", "finlande", "irlande", "islande",
  "azerbaidjan", "bielorussie", "georgie", "albanie", "kosovo", "moldavie",
  "montenegro", "lettonie", "lituanie", "estonie", "armenie", "malte",
  "luxembourg", "irlandedunord", "paysdegalles", "feroe", "gibraltar",
  "andorre", "sanmarin",
  "championship", "ligue2", "segunda", "serieb", "bundesliga2",
  "can",
];
const leagueLabels: Record<string, string> = {
  epl: "Premier League",
  laliga: "La Liga",
  ligue1: "Ligue 1",
  seriea: "Serie A",
  bundesliga: "Bundesliga",
  eredivisie: "Eredivisie",
  ligaportugal: "Liga Portugal",
  proleague: "Jupiler Pro League",
  premiership: "Scottish Premiership",
  superlig: "Süper Lig",
  suisse: "Super League (Suisse)",
  autriche: "Bundesliga (Autriche)",
  grece: "Super League (Grèce)",
  danemark: "Superliga (Danemark)",
  norvege: "Eliteserien (Norvège)",
  suede: "Allsvenskan (Suède)",
  pologne: "Ekstraklasa (Pologne)",
  tchequie: "Chance Liga (Tchéquie)",
  croatie: "HNL (Croatie)",
  serbie: "Super Liga (Serbie)",
  ukraine: "Premier League (Ukraine)",
  roumanie: "Liga I (Roumanie)",
  albanie: "Superliga (Albanie)",
  andorre: "1a Divisió (Andorre)",
  armenie: "Premier League (Arménie)",
  azerbaidjan: "Premyer Liqa (Azerbaïdjan)",
  bielorussie: "Premier League (Biélorussie)",
  bosnie: "Premijer Liga (Bosnie)",
  bulgarie: "First League (Bulgarie)",
  chypre: "1re Division (Chypre)",
  estonie: "Meistriliiga (Estonie)",
  feroe: "Meistaradeildin (Féroé)",
  finlande: "Veikkausliiga (Finlande)",
  georgie: "Erovnuli Liga (Géorgie)",
  gibraltar: "Premier Division (Gibraltar)",
  hongrie: "NB I (Hongrie)",
  islande: "Úrvalsdeild (Islande)",
  irlande: "Premier Division (Irlande)",
  israel: "Ligat Ha'al (Israël)",
  kazakhstan: "Premier League (Kazakhstan)",
  kosovo: "Superliga (Kosovo)",
  lettonie: "Virsliga (Lettonie)",
  lituanie: "A Lyga (Lituanie)",
  luxembourg: "National Division (Luxembourg)",
  malte: "Premier League (Malte)",
  moldavie: "Super Liga (Moldavie)",
  montenegro: "First League (Monténégro)",
  irlandedunord: "Premiership (Irlande du Nord)",
  russie: "Premier League (Russie)",
  sanmarin: "Campionato (Saint-Marin)",
  slovaquie: "Super Liga (Slovaquie)",
  slovenie: "1. SNL (Slovénie)",
  paysdegalles: "Cymru Premier (Pays de Galles)",
  championship: "Championship (Angleterre)",
  ligue2: "Ligue 2",
  segunda: "LaLiga 2",
  serieb: "Serie B",
  bundesliga2: "2. Bundesliga",
  ucl: "Autres Europe",
  can: "CAN",
  caf: "Clubs Africains",
};

// Use real competition logos from data.ts
function getLeagueLogo(leagueId: string): string {
  const comp = competitions.find(c => c.id === leagueId);
  return comp?.logo || "";
}

function getClubsByLeague(leagueId: string) {
  return Object.values(clubs).filter((c: any) => c.league === leagueId);
}

// ============ TEAM PICKER COMPONENT ============
function TeamPicker({ isOpen, onClose, onSelect, currentTeamId }: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (teamId: string) => void;
  currentTeamId: string | null;
}) {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Clubs trouvés hors des championnats préchargés.
  const [resultatsDistants, setResultatsDistants] = useState<any[]>([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedLeague(null);
      setSearchQuery("");
      setResultatsDistants([]);
    }
  }, [isOpen]);

  // Recherche locale, insensible aux accents.
  //
  // « Bâle » et « bale », « Atlético » et « atletico » doivent se rejoindre :
  // sur un clavier de téléphone, presque personne ne met les accents.
  const sansAccent = (t: string) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const resultatsLocaux = searchQuery.trim().length >= 2
    ? Object.values(clubs).filter((c: any) => {
        const q = sansAccent(searchQuery);
        if (sansAccent(c.name).includes(q) || sansAccent(c.shortName ?? "").includes(q)) return true;
        for (const [englishName, aliases] of Object.entries(FR_TEAM_ALIASES)) {
          const matchesAlias = aliases.some(alias => sansAccent(alias).includes(q) || q.includes(sansAccent(alias)));
          if (matchesAlias && sansAccent(c.name).includes(sansAccent(englishName))) return true;
        }
        return false;
      })
    : [];

  // Rien en local : on va chercher le club partout, quel que soit son
  // championnat. C'est ce qui évite qu'un membre cherche « Bâle » un soir de
  // Bâle–Barcelone et reparte en croyant que son match n'existe pas.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3 || resultatsLocaux.length > 0) {
      setResultatsDistants([]);
      setRechercheEnCours(false);
      return;
    }
    setRechercheEnCours(true);
    const minuteur = setTimeout(async () => {
      try {
        const r = await fetch(`/api/teams/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setResultatsDistants(d.teams ?? []);
      } catch {
        setResultatsDistants([]);
      } finally {
        setRechercheEnCours(false);
      }
    }, 350); // on attend la fin de la frappe plutôt qu'un appel par lettre
    return () => clearTimeout(minuteur);
  }, [searchQuery, resultatsLocaux.length]);

  const searchResults = resultatsLocaux.length > 0 ? resultatsLocaux : resultatsDistants;
  const showSearch = searchQuery.trim().length >= 2;

  // Placé APRÈS les hooks : sortir avant eux les rendrait conditionnels, ce que
  // React interdit — la recherche cesserait de fonctionner à la réouverture.
  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#18272f] border border-white/10 rounded-t-[28px] md:rounded-[28px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {selectedLeague && (
              <button onClick={() => setSelectedLeague(null)} className="w-7 h-7 rounded-[14px] bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-4 h-4 text-white/70" />
              </button>
            )}
            <h3 className="text-sm font-black text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
              {selectedLeague ? leagueLabels[selectedLeague] : "Choisir une équipe"}
            </h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[14px] bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Search bar */}
        {!selectedLeague && (
          <div className="px-5 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Rechercher une équipe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-[16px] pl-9 pr-4 py-2.5 text-xs font-semibold text-white placeholder:text-white/25 outline-none focus:border-[#10B981]/40 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-5 pt-1 custom-scrollbar">
          {/* Search results */}
          {showSearch ? (
            <div className="space-y-1 px-2">
              {rechercheEnCours && searchResults.length === 0 ? (
                /* Ne jamais annoncer l'échec tant qu'on cherche encore : le
                   club est peut-être hors des championnats préchargés, et
                   « Aucun résultat » ferait renoncer avant la réponse. */
                <p className="text-xs text-white/40 text-center py-6 font-semibold">
                  Recherche dans tous les championnats…
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-6 font-semibold">Aucun résultat</p>
              ) : (
                searchResults.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { enregistrerClub(c); onSelect(c.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] transition-all text-left ${
                      c.id === currentTeamId ? "bg-[#10B981]/10 border border-[#10B981]/20" : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <img src={c.logo} className="w-7 h-7 object-contain shrink-0" alt="" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{c.name}</span>
                      <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">{leagueLabels[c.league] || c.league}</span>
                    </div>
                    {c.id === currentTeamId && <span className="text-[#10B981] text-[10px] font-black">✓</span>}
                  </button>
                ))
              )}
            </div>
          ) : !selectedLeague ? (
            /* League list */
            <div className="space-y-1 px-2">
              {leagueOrder.map((lid) => {
                const teamCount = getClubsByLeague(lid).length;
                return (
                  <button
                    key={lid}
                    onClick={() => setSelectedLeague(lid)}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-[16px] hover:bg-white/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <img src={getLeagueLogo(lid)} className="w-6 h-6 object-contain shrink-0" alt="" />
                      <div>
                        <span className="text-xs font-bold text-white block">{leagueLabels[lid]}</span>
                        <span className="text-[9px] text-white/30 font-semibold">{teamCount} équipes</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
                  </button>
                );
              })}
            </div>
          ) : (
            /* Teams in selected league */
            <div className="space-y-1 px-2">
              {getClubsByLeague(selectedLeague).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c.id); onClose(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] transition-all text-left ${
                    c.id === currentTeamId ? "bg-[#10B981]/10 border border-[#10B981]/20" : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <img src={c.logo} className="w-7 h-7 object-contain shrink-0" alt="" />
                  <span className="text-xs font-bold text-white flex-1 truncate">{c.name}</span>
                  {c.id === currentTeamId && <span className="text-[#10B981] text-[10px] font-black">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const WinIcon = () => (
  <div className="w-[18px] h-[18px] bg-[#10B981] rounded-full flex items-center justify-center shrink-0">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  </div>
);
const DrawIcon = () => (
  <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
    <div className="w-3.5 h-3.5 bg-[#FBBF24] rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)]"></div>
  </div>
);
const LossIcon = () => (
  <div className="w-[18px] h-[18px] bg-[#EF4444] rounded-full flex items-center justify-center shrink-0">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  </div>
);
const EmptyIcon = () => (
  <div className="w-[18px] h-[18px] bg-white/10 rounded-full flex items-center justify-center shrink-0">
    <div className="w-2 h-0.5 bg-white/40"></div>
  </div>
);

function renderFormEmojis(form: ("W" | "D" | "L")[]) {
  const items = form.slice(-5).map(f => f);
  // Pad to 5
  while (items.length < 5) {
    items.unshift("E" as any);
  }
  return (
    <span className="flex items-center gap-1.5">
      {items.map((f, i) => (
        <span key={i}>
          {f === "W" ? <WinIcon /> : f === "D" ? <DrawIcon /> : f === "L" ? <LossIcon /> : <EmptyIcon />}
        </span>
      ))}
    </span>
  );
}

function calculateVND(form: ("W" | "D" | "L")[]) {
  const w = form.filter(f => f === "W").length;
  const d = form.filter(f => f === "D").length;
  const l = form.filter(f => f === "L").length;
  return `${w}-${d}-${l}`;
}

type MatchRecent = { opponent: string; score: string; result: "W" | "D" | "L" };

/**
 * Derniers matchs réellement joués par une équipe, tels que le serveur les a
 * lus chez API-Football : adversaire, score et issue.
 *
 * L'ancien affichage prenait la forme dans un fichier de données figé, où la
 * plupart des clubs n'existent pas : Villarreal ou le Racing Santander
 * s'affichaient avec cinq tirets et un bilan 0-0-0. Un membre payait pour voir
 * des cases vides.
 *
 * Le tableau arrive du plus récent au plus ancien.
 */
function matchsRecents(result: any, cote: "team1" | "team2"): MatchRecent[] {
  const m = result?.globalForm?.[cote]?.recentMatches;
  if (!Array.isArray(m)) return [];
  return m
    .filter((x: any) => x && typeof x.result === "string")
    .slice(0, 5);
}

/** Suite de résultats pour les pastilles, du plus ancien au plus récent (sens de lecture). */
function lettresForme(matchs: MatchRecent[]): ("W" | "D" | "L")[] {
  return [...matchs].reverse().map((m) => m.result);
}

/** Résumé lisible de la dynamique, calculé sur les matchs réels. */
function dynamique(matchs: MatchRecent[]) {
  if (!matchs.length) return { icone: "⏳", ligne1: "Aucun match", ligne2: "récent trouvé" };
  const v = matchs.filter((m) => m.result === "W").length;
  const d = matchs.filter((m) => m.result === "L").length;
  if (v >= 3) return { icone: "🔥", ligne1: "En grande", ligne2: "forme" };
  if (d >= 3) return { icone: "📉", ligne1: "Forme", ligne2: "fragile" };
  return { icone: "⚡", ligne1: "Forme", ligne2: "moyenne" };
}

function CompetitionCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayComps = competitions.filter(c => c.region === "europe" || c.id === "can");
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayComps.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [displayComps.length]);

  const comp = displayComps[currentIndex];

  if (!comp) return null;

  return (
    <div className="flex flex-col items-center justify-center animate-fade-in transition-all duration-500 min-h-[140px]">
      <div className="relative flex items-center justify-center">
        {/* Soft backlight glow behind logo */}
        <div className="absolute inset-0 bg-white/10 blur-[30px] rounded-full scale-150 animate-pulse"></div>
        <img 
          key={comp.id} 
          src={comp.logo} 
          className="relative w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.15)] brightness-110 contrast-125 animate-fade-in z-10" 
          alt={comp.name} 
        />
      </div>
      <span key={`name-${comp.id}`} className="text-[10px] md:text-sm font-black text-white/70 uppercase tracking-widest mt-6 animate-fade-in text-center drop-shadow-md">{comp.name}</span>
    </div>
  );
}

// French ↔ English name aliases for team search
const FR_TEAM_ALIASES: Record<string, string[]> = {
  // National teams
  "france": ["france", "les bleus", "bleus"],
  "spain": ["espagne", "esp", "spain", "roja"],
  "germany": ["allemagne", "germany", "mannschaft"],
  "england": ["angleterre", "england", "three lions"],
  "brazil": ["brésil", "bresil", "brazil", "brasil", "seleção", "selecao"],
  "argentina": ["argentine", "argentina", "albiceleste"],
  "portugal": ["portugal"],
  "italy": ["italie", "italy", "azzurri"],
  "netherlands": ["pays-bas", "hollande", "netherlands", "nederland"],
  "belgium": ["belgique", "belgium", "diables rouges"],
  "croatia": ["croatie", "croatia", "hrvatska"],
  "denmark": ["danemark", "denmark", "danemark"],
  "serbia": ["serbie", "serbia"],
  "wales": ["pays de galles", "wales"],
  "scotland": ["écosse", "ecosse", "scotland"],
  "switzerland": ["suisse", "switzerland", "schweiz"],
  "austria": ["autriche", "austria"],
  "poland": ["pologne", "poland"],
  "ukraine": ["ukraine"],
  "turkey": ["turquie", "turkey"],
  "russia": ["russie", "russia"],
  "greece": ["grèce", "grece", "greece"],
  "sweden": ["suède", "suede", "sweden"],
  "norway": ["norvège", "norvege", "norway"],
  "romania": ["roumanie", "romania"],
  // Africa
  "morocco": ["maroc", "morocco"],
  "senegal": ["sénégal", "senegal"],
  "nigeria": ["nigeria", "super eagles"],
  "cameroon": ["cameroun", "cameroon"],
  "ghana": ["ghana"],
  "mali": ["mali"],
  "algeria": ["algérie", "algerie", "algeria"],
  "egypt": ["égypte", "egypte", "egypt"],
  "ivory coast": ["côte d'ivoire", "cote d'ivoire", "cote divoire", "ivory coast"],
  "tunisia": ["tunisie", "tunisia"],
  "guinea": ["guinée", "guinee", "guinea"],
  "dr congo": ["rd congo", "rdc", "congo"],
  // Americas
  "usa": ["usa", "etats-unis", "états-unis", "united states"],
  "mexico": ["mexique", "mexico"],
  "colombia": ["colombie", "colombia"],
  "chile": ["chili", "chile"],
  "uruguay": ["uruguay"],
  "ecuador": ["équateur", "equateur", "ecuador"],
  "peru": ["pérou", "perou", "peru"],
  "paraguay": ["paraguay"],
  "venezuela": ["venezuela"],
  "canada": ["canada"],
  "jamaica": ["jamaïque", "jamaique", "jamaica"],
  // Asia
  "japan": ["japon", "japan"],
  "south korea": ["corée du sud", "coree du sud", "south korea", "korea"],
  "saudi arabia": ["arabie saoudite", "saudi arabia"],
  "iran": ["iran"],
  "australia": ["australie", "australia", "socceroos"],
  // Clubs (common French usage)
  "real madrid": ["real madrid", "real"],
  "fc barcelona": ["barça", "barca", "fc barcelona", "barcelona"],
  "psg": ["paris saint-germain", "paris", "psg"],
  "manchester city": ["man city", "manchester city", "city"],
  "manchester united": ["man united", "manchester united", "man utd"],
  "juventus": ["juventus", "juve"],
  "olympique de marseille": ["marseille", "om"],
  "olympique lyonnais": ["lyon", "ol"],
};

/**
 * La section « preuves » est rendue par le SERVEUR et reçue ici toute faite.
 *
 * Cette page est un composant client — elle gère la sélection des équipes et
 * l'appel d'analyse. Les preuves, elles, n'ont aucune raison d'être calculées
 * dans le navigateur : les faire descendre déjà rendues évite un aller-retour
 * réseau supplémentaire sur des connexions mobiles souvent lentes, ce qui est
 * le cas de la quasi-totalité des visiteurs.
 *
 * `offreEntree` descend elle aussi du serveur : le prix et le quota de l'offre
 * d'entrée se règlent depuis l'administration, et un tarif périmé écrit en dur
 * dans le paywall coûterait une vente à chaque affichage.
 */
export interface OffreEntree {
  libelle: string;
  prixXof: number;
  /** `null` pour une offre sans limite. */
  analyses: number | null;
}

export default function AnalyzePage({
  preuves,
  offreEntree,
  matchsDuJour,
}: {
  preuves?: React.ReactNode;
  offreEntree?: OffreEntree;
  /**
   * Les grands matchs du jour, relevés par le SERVEUR et descendus tout faits.
   *
   * Le fournisseur de données est interrogé une fois par jour pour tout le
   * monde, jamais une fois par visiteur : son quota est la ressource la plus
   * rare du projet, et la page d'analyse est la plus consultée du site.
   */
  matchsDuJour?: { matchs: MatchDuJour[]; aujourdhui: boolean };
}) {
  const offre = offreEntree ?? { libelle: "Essentiel", prixXof: 2000, analyses: 20 };
  const prixOffre = offre.prixXof.toLocaleString("fr-FR");
  const quotaOffre = offre.analyses === null ? "des analyses illimitées" : `${offre.analyses} analyses complètes`;
  const [team1, setTeam1] = useState<string | null>(null);
  const [team2, setTeam2] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState(0);
  /** Avancement supplementaire, en points, une fois les etapes nommees epuisees. */
  const [avancementLent, setAvancementLent] = useState(0);
  const [showGlobalForm, setShowGlobalForm] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<1 | 2 | null>(null);
  const [todayHistory, setTodayHistory] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false); // Default false to prevent data leaking before check finishes
  /**
   * L offre que le membre a DEJA, pour pouvoir la recharger en un clic.
   *
   * Jamais l offre d entree : les droits retiennent l acces le plus
   * eleve, et un niveau egal ou inferieur ne remplace jamais celui en cours.
   * Un membre Pro qui racheterait l Essentiel garderait son Pro, periode
   * inchangee — son compteur ne repartirait pas et son argent serait perdu.
   */
  const [offreActuelle, setOffreActuelle] = useState<{ cle: string; libelle: string; prixXof: number } | null>(null);
  /** Vrai quand la notice de rechargement est ouverte. */
  const [noticeRecharge, setNoticeRecharge] = useState(false);
  const [rechargeEnCours, setRechargeEnCours] = useState(false);

  /**
   * ── LE SEUIL OÙ L'ON PRÉVIENT ─────────────────────────────────────────
   *
   * Trois analyses : assez tôt pour qu'il reste de quoi travailler pendant
   * qu'on recharge, assez tard pour ne pas harceler quelqu'un qui vient
   * d'acheter. En dessous, le rappel arriverait quand il est déjà trop tard ;
   * au-dessus, il s'afficherait la moitié du mois et on cesserait de le voir.
   */
  const SEUIL_PRESQUE_SEC = 3;

  /**
   * Le pays de l acheteur, demande au serveur SEULEMENT quand la notice
   * s ouvre. L interroger a chaque chargement de la page d analyse — la plus
   * visitee du site — couterait un appel pour la quasi-totalite des visiteurs
   * qui ne rechargeront jamais.
   */
  const paysRecharge = usePaysAcheteur(noticeRecharge);
  // Consommation d'analyses telle que renvoyée par le serveur.
  const [quota, setQuota] = useState<{
    used: number; limit: number | null; remaining: number | null;
    unlimited: boolean; periodEnd: string | null;
  } | null>(null);

  /**
   * Vrai uniquement dans les toutes dernières analyses d'un abonné payant.
   *
   * Jamais pour un compte illimité — il n'a rien à recharger — et jamais à
   * zéro : c'est alors la carte « limite atteinte » qui parle, et deux
   * messages sur le même sujet au même moment se contredisent plus qu'ils
   * n'aident.
   */
  const presqueASec =
    isPremium &&
    !!quota &&
    !quota.unlimited &&
    quota.remaining !== null &&
    quota.remaining > 0 &&
    quota.remaining <= SEUIL_PRESQUE_SEC;
  const [teamsVersion, setTeamsVersion] = useState(0);

  // Équipes de la saison en cours, chargées depuis API-Football et fusionnées
  // dans le référentiel local. Le fichier statique datait de 2025-2026 : ni les
  // promus, ni les championnats hors « big 5 » n'étaient sélectionnables.
  useEffect(() => {
    let annule = false;
    fetch('/api/teams')
      .then(r => (r.ok ? r.json() : { teams: [] }))
      .then(({ teams }) => {
        if (annule || !teams?.length) return;

        // La liste officielle REMPLACE celle du championnat, elle ne s'y ajoute
        // pas : sinon les équipes reléguées la saison passée resteraient
        // sélectionnables à côté des promues (La Liga affichait 29 équipes).
        const liguesAJour = new Set<string>(teams.map((t: any) => t.league));
        Object.keys(clubs).forEach(id => {
          const c = (clubs as any)[id];
          if (c && liguesAJour.has(c.league)) delete (clubs as any)[id];
        });

        teams.forEach((t: any) => {
          const existant = (clubs as any)[t.id];
          const base = {
            id: t.id,
            shortName: t.name.slice(0, 3).toUpperCase(),
            country: t.country,
            stadium: t.stadium || 'Stade',
            coach: 'N/A',
            ranking: 0,
            points: 0,
            squad: [],
            form: [],
            stats: { played: 0, wins: 0, draws: 0, losses: 0, goalsScored: 0, goalsConceded: 0, possession: 0, xG: 0, cleanSheets: 0 },
          };
          (clubs as any)[t.id] = {
            ...base,
            // Les valeurs déjà connues (effectif, forme, entraîneur) sont conservées…
            ...(existant || {}),
            // …mais le nom, le logo et le championnat officiels font foi.
            name: t.name,
            logo: t.logo,
            league: t.league,
          };
        });
        setTeamsVersion(v => v + 1);
      })
      .catch(() => { /* le référentiel statique reste utilisable */ });
    return () => { annule = true; };
  }, []);

  useEffect(() => {
    const checkPremium = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsPremium(false);
        return;
      }

      try {
        // Droits ET consommation viennent du serveur — jamais recalculés ici.
        // Les comptes de l'équipe sont reconnus par le backend, inutile de
        // dupliquer cette liste dans le navigateur.
        const res = await fetch('/api/payments/status');
        const data = await res.json();
        setIsPremium(!!data.premium);
        if (data.analyses) setQuota(data.analyses);
        setOffreActuelle(data.offreActuelle ?? null);
      } catch {
        setIsPremium(false);
      }
    };
    checkPremium();
  }, []);

  /**
   * ── LE RACHAT EN UN CLIC, DEPUIS L'ÉCRAN DE COMPTEUR ÉPUISÉ ──────────────
   *
   * Mesuré le 24 août 2026 : un membre qui a fini ses vingt analyses repaye
   * 18,8 % du temps, contre 0,7 % pour celui à qui il en reste. Tomber à zéro
   * multiplie par vingt-sept la chance qu'il revienne — et c'est à cet instant
   * précis, pas trois jours plus tard, qu'il faut lui tendre le bouton.
   *
   * L'écran renvoyait vers la page des tarifs : une marche de plus, où il
   * fallait relire trois offres pour recliquer sur celle qu'on avait déjà.
   *
   * Rien du paiement n'est réécrit : c'est le même appel, la même notice et
   * les mêmes étapes de mesure que sur le paywall et la page des tarifs.
   */
  const rechargerAcces = async (paysChoisi: string | null) => {
    if (!offreActuelle) return;
    setNoticeRecharge(false);
    setRechargeEnCours(true);
    // Réservé dans la foulée du clic : un onglet ouvert après l'appel réseau
    // serait bloqué par le navigateur.
    const onglet = reserverOngletPaiement();
    try {
      const res = await fetch('/api/paiement/caisse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: offreActuelle.cle,
          fuseau: fuseauDuNavigateur(),
          ...(paysChoisi ? { pays: paysChoisi } : {}),
        }),
      });

      // Session expirée : reconnexion plutôt qu'un message d'erreur trompeur.
      if (res.status === 401) {
        libererOnglet(onglet);
        window.location.href = '/login';
        return;
      }

      const data = await res.json();
      if (data.checkoutUrl) {
        signalerEtape('depart-caisse', offreActuelle.cle);
        if (data.passerelle === 'maketou') {
          partirPayer(
            onglet,
            data.checkoutUrl,
            `/payment-success?plan=${encodeURIComponent(offreActuelle.cle)}&via=maketou`
          );
        } else {
          libererOnglet(onglet);
          window.location.href = data.checkoutUrl;
        }
      } else {
        libererOnglet(onglet);
        // Un échec ici veut dire que personne n'atteindra la caisse : à ne pas
        // confondre avec un abandon volontaire.
        signalerEtape('echec-lien', offreActuelle.cle);
        setRechargeEnCours(false);
      }
    } catch {
      libererOnglet(onglet);
      signalerEtape('echec-lien', offreActuelle.cle);
      setRechargeEnCours(false);
    }
  };

  const handleTeam1Select = async (id: string) => {
    setTeam1(id);
    
    // REAL-TIME INTELLIGENCE: Ask the backend for the EXACT live next match
    try {
      const res = await fetch(`/api/next-match?teamId=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.nextTeamId) {
          setTeam2(data.nextTeamId);
        }
      }
    } catch (error) {
      console.warn("Could not fetch real-time next match", error);
    }
  };

  const steps = [
    "🔍 Recherche des statistiques en temps réel...",
    "🧠 Analyse tactique et styles de jeu...",
    "⚡ Analyse des blessures et suspensions...",
    "📊 Calcul des tendances et xG...",
    "🏆 Finalisation du rapport d'expert..."
  ];

  useEffect(() => {
    const updateHistory = () => {
      try {
        const history = JSON.parse(localStorage.getItem("profoot_user_history_v1") || "[]");
        const todayStr = new Date().toDateString();
        const todayItems = history.filter((item: any) => new Date(item.date).toDateString() === todayStr);
        setTodayHistory(todayItems);
      } catch {}
    };
    updateHistory();
    window.addEventListener("profoot-analysis-done", updateHistory);
    return () => window.removeEventListener("profoot-analysis-done", updateHistory);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t1Param = params.get("t1");
    const t2Param = params.get("t2");
    if (t1Param && t2Param) {
      setTeam1(t1Param);
      setTeam2(t2Param);
      setTimeout(() => {
        handleAnalyze(t1Param, t2Param);
      }, 300);
    }
  }, []);

  /**
   * ── LA SECONDE CHANCE, INVISIBLE POUR CELUI QUI ATTEND ──────────────────
   *
   * Une analyse qui échoue affichait « ANALYSE INTERROMPUE » et laissait la
   * personne devant un bouton « Réessayer ». Beaucoup ne cliquent pas : ils
   * concluent que l'application ne marche pas, et s'en vont.
   *
   * POURQUOI LA RELANCE PART D'ICI ET NON DU SERVEUR
   *
   * Quand le serveur renonce, il a déjà consommé ses soixante secondes. Rien
   * ne peut être retenté dans la même requête. Repartir du navigateur donne
   * une requête NEUVE, avec son budget entier.
   *
   * ET ELLE A DE MEILLEURES CHANCES QUE LA PREMIÈRE
   *
   * Les données du match viennent d'être mises en réserve : la collecte, qui
   * prenait vingt secondes, en prend deux. Le modèle hérite donc de presque
   * tout le budget au lieu d'un reste. On signale en plus au serveur qu'il
   * s'agit d'une reprise, pour qu'il écarte le modèle qui vient de fauter.
   *
   * UNE SEULE RELANCE, ET C'EST MESURÉ
   *
   * Trois essais identiques répétaient la même erreur pendant deux minutes et
   * demie. Un seul essai, sur un autre modèle et avec les données déjà en
   * main, aboutit plus souvent et coûte au pire une minute quinze.
   *
   * Le quota n'est pas touché : il se décompte par MATCH et non par tentative
   * — vérifié dans `consumeAnalysis`. Une reprise ne coûte rien à l'membre.
   */
  const RELANCES_MAX = 1;

  const handleAnalyze = async (
    overrideT1?: string,
    overrideT2?: string,
    /** Rang de la tentative. 0 = premier essai, 1 = reprise automatique. */
    tentative = 0
  ) => {
    const activeT1 = overrideT1 || team1;
    const activeT2 = overrideT2 || team2;

    if (!activeT1 || !activeT2 || activeT1 === activeT2) return;

    setAnalyzing(true);
    setResult(null);
    setAnalyzeError(null);
    setAnalyzingStep(0);
    setAvancementLent(0);

    const startTime = Date.now();
    let currentStep = 0;

    // ── LA BARRE NE RESTE PLUS FIGÉE À 80 % ──────────────────────────────
    //
    // Elle montait de vingt en vingt toutes les 1,2 seconde, puis s'arrêtait
    // net à la quatrième étape — 80 % — et n'affichait plus rien jusqu'au
    // retour du serveur. Le propriétaire l'a décrit ainsi : « ça se cale sur
    // 80 % pendant une à deux minutes ».
    //
    // Trois secondes six de mouvement, puis une minute et demie d'immobilité :
    // une barre immobile ne dit pas « je travaille », elle dit « je suis
    // plantée ». Et devant une barre plantée, on recharge la page — ce qui
    // annule une analyse qui allait aboutir, et la fait recommencer.
    //
    // Elle continue donc d'avancer, très lentement, jusqu'à 97 % au plus.
    // Jamais 100 % : les cent pour cent sont le retour du serveur, et les
    // afficher avant serait un deuxième mensonge.
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length - 1) {
        setAnalyzingStep(currentStep);
      }
    }, 1200);

    // Une fois les étapes nommées épuisées, on continue à la fraction de
    // pour-cent : assez pour qu'on voie que ça bouge, assez lent pour ne
    // jamais atteindre le bout avant le serveur.
    const rampe = setInterval(() => {
      setAvancementLent((v) => Math.min(17, v + 0.4));
    }, 900);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: getClub(activeT1),
          team2: getClub(activeT2),
          // Le serveur s'en sert pour raccourcir son budget et écarter le
          // modèle qui vient d'échouer. Absent au premier essai.
          reprise: tentative > 0 ? tentative : undefined,
        })
      });

      if (!res.ok) {
        // Distinguer « il faut un acces payant » d une vraie panne : afficher une
        // erreur technique à un visiteur non membre le laisse croire que le
        // service est cassé alors qu'il doit simplement souscrire.
        if (res.status === 403) {
          clearInterval(interval); clearInterval(rampe);
          setAnalyzing(false);
          setAnalyzeError("PREMIUM_REQUIRED");
          return;
        }
        // 429 couvre deux cas distincts : le quota mensuel épuisé (code dédié)
        // et le simple anti-spam. Les confondre afficherait « limite atteinte »
        // à un membre qui a juste cliqué trop vite.
        if (res.status === 429) {
          const info = await res.json().catch(() => ({}));
          clearInterval(interval); clearInterval(rampe);
          setAnalyzing(false);
          if (info?.code === 'ANALYSIS_LIMIT_REACHED') {
            if (info.quota) {
              setQuota({
                used: info.quota.used,
                limit: info.quota.limit,
                remaining: info.quota.remaining,
                unlimited: false,
                periodEnd: info.quota.periodEnd ?? null,
              });
            }
            setAnalyzeError("LIMIT_REACHED");
          } else {
            setAnalyzeError("Trop de requêtes");
          }
          return;
        }
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Erreur serveur API");
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Le serveur renvoie la consommation à jour avec chaque analyse : le
      // compteur affiché reste synchronisé sans requête supplémentaire.
      if (data.quota) {
        setQuota({
          used: data.quota.used,
          limit: data.quota.unlimited ? null : data.quota.limit,
          remaining: data.quota.unlimited ? null : data.quota.remaining,
          unlimited: !!data.quota.unlimited,
          periodEnd: data.quota.periodEnd ?? null,
        });
      }

      clearInterval(interval); clearInterval(rampe);
      setAnalyzingStep(steps.length - 1);
      
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 1200 - elapsedTime);

      setTimeout(() => {
        setResult(data);
        setAnalyzing(false);

        // Enregistrer automatiquement dans l'historique privé de l'utilisateur
        try {
          const t1Obj = getClub(activeT1);
          const t2Obj = getClub(activeT2);
          const historyItem = {
            id: Date.now().toString(),
            team1: t1Obj,
            team2: t2Obj,
            date: new Date().toISOString(),
            isFinished: data.isFinished,
            competition: data.competition || t1Obj.league || "Europe",
            type: data.isFinished ? "Résultat passé" : "Analyse IA",
            // Aucune valeur de repli : un score absent doit rester absent.
            // Ce `?? 2` et ce `?? 1` inscrivaient un 2-1 en base des que la
            // prediction manquait, et venaient gonfler le fleau du 2-1.
            score: data.isFinished
              ? data.score
              : data.predictedScore
                ? `${data.predictedScore.team1Goals} - ${data.predictedScore.team2Goals}`
                : null,
            confidence: data.confidence || (data.isFinished ? 100 : 85),
            summary: data.quickSummary || data.summary || "Analyse tactique complète générée par l'IA ProFoot.",
            winProb: data.winProb,
            drawProb: data.drawProb,
            loseProb: data.loseProb,
            data: data
          };

          // 1. Sauvegarde en localStorage (rapide, fallback)
          const existing = JSON.parse(localStorage.getItem("profoot_user_history_v1") || "[]");
          localStorage.setItem("profoot_user_history_v1", JSON.stringify([historyItem, ...existing]));

          // 2. L'enregistrement durable est fait par le SERVEUR, au moment où il
          //    produit l'analyse. Il ne se fait plus ici.
          //
          //    Écrit depuis le navigateur, il ne disposait que de ce que le
          //    paywall laissait passer : un compte gratuit ne reçoit ni le score
          //    prédit ni les tendances, et la ligne partait donc vide — ou
          //    remplie d'un « 2-1 » de remplissage. Le serveur, lui, a l'analyse
          //    entière quel que soit l acces.
          //
          //    Le stockage local ci-dessus reste : il affiche l'historique sans
          //    attendre le réseau.

          console.log("[HISTORY] Analyse enregistrée avec succès.");
          
          // Notifier la Sidebar pour mettre à jour le compteur
          window.dispatchEvent(new Event("profoot-analysis-done"));
        } catch (e) {
          console.error("Erreur lors de l'enregistrement dans l'historique:", e);
        }

      }, remainingTime + 300);

    } catch (error: any) {
      clearInterval(interval); clearInterval(rampe);

      // ── LA REPRISE, AVANT D'ANNONCER UN ÉCHEC ─────────────────────────
      //
      // On ne montre rien et on ne coupe pas l'attente : l'écran d'analyse
      // reste en place, la personne ne voit pas passer l'incident.
      //
      // Les cas déjà traités plus haut — acces requis, quota épuisé,
      // session expirée — ne passent pas par ici : ils sortent avec `return`.
      // Ce qui arrive jusqu'à ce point est une vraie panne, donc quelque chose
      // qu'une seconde tentative peut réellement rattraper.
      if (tentative < RELANCES_MAX) {
        console.warn(
          `[ANALYSE] Échec (${error?.message ?? 'inconnu'}) — reprise automatique ` +
            `${tentative + 1}/${RELANCES_MAX} sur ${activeT1} — ${activeT2}.`
        );
        // Une courte pause : le fournisseur qui vient de renoncer a parfois
        // besoin d'un instant, et l'écran d'attente reste affiché.
        await new Promise((r) => setTimeout(r, 1500));
        return handleAnalyze(activeT1, activeT2, tentative + 1);
      }

      setAnalyzing(false);
      setResult(null);
      setAnalyzeError(error?.message || "Erreur inconnue");
    }
  };

  const handleQuickMatchSelect = (hId: string, aId: string) => {
    setTeam1(hId);
    setTeam2(aId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    handleAnalyze(hId, aId);
  };

  /**
   * Taper un match du jour revient EXACTEMENT à choisir deux équipes à la main.
   *
   * Les deux gestes passent par les mêmes trois lignes : inscrire le club au
   * référentiel local — sans quoi il s'afficherait « Inconnu », comme le FC
   * Bâle le jour de Bâle–Barcelone — puis appeler `handleQuickMatchSelect`,
   * qui pose les deux équipes et lance `handleAnalyze`.
   *
   * AUCUNE logique d'analyse propre à ce chemin. Une seconde façon de lancer
   * une analyse aurait fini par diverger de la première : un décompte de quota
   * oublié d'un côté, une reprise automatique manquante de l'autre — et
   * personne ne s'en serait aperçu avant qu'un client ne paie deux fois le
   * même match.
   */
  const choisirMatchDuJour = (m: MatchDuJour) => {
    enregistrerClub(m.dom);
    enregistrerClub(m.ext);
    handleQuickMatchSelect(m.dom.id, m.ext.id);
  };

  /**
   * Reprise automatique de l'analyse payée.
   *
   * Après un achat à l'unité, la page de paiement renvoie ici avec les deux
   * équipes en paramètres. Sans cette reprise, l'acheteur retombait sur une
   * page VIERGE : l'analyse vivait dans l'état de son navigateur, perdu au
   * moment de partir payer. Il voyait un formulaire vide après avoir payé, et
   * devait deviner qu'il fallait resélectionner les équipes.
   *
   * L'analyse est relancée, et non restaurée : pour un compte gratuit, le
   * serveur n'avait généré que l'aperçu. C'est ce nouvel appel qui produit
   * enfin le contenu complet, maintenant que le match est débloqué.
   *
   * Les paramètres sont retirés de l'URL aussitôt : un rechargement ne doit pas
   * relancer une analyse déjà affichée, et l'adresse partagée ne doit pas
   * déclencher d'analyse chez quelqu'un d'autre.
   */
  const repriseFaite = useRef(false);
  useEffect(() => {
    if (repriseFaite.current) return;

    const params = new URLSearchParams(window.location.search);
    const t1 = params.get('t1');
    const t2 = params.get('t2');
    if (!t1 || !t2) return;

    repriseFaite.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    handleQuickMatchSelect(t1, t2);
    // Volontairement sans dépendances : cette reprise n'a lieu qu'au premier
    // rendu, jamais à chaque changement d'état.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 80 % au plus par les etapes nommees, plus la rampe lente, plafonne a 97 :
  // les 100 % appartiennent au retour du serveur.
  const progressPercent = Math.min(
    97,
    Math.round(((analyzingStep + 1) / steps.length) * 100 + avancementLent)
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#101c24] via-[#031b25] to-[#041f1a]">
      <div className="max-w-4xl mx-auto space-y-5 pb-24 px-4 md:px-0 pt-6 animate-fade-in">
      
      {/* Team Picker Modals */}
      <TeamPicker key={`p1-${teamsVersion}`} isOpen={pickerOpen === 1} onClose={() => setPickerOpen(null)} onSelect={handleTeam1Select} currentTeamId={team1} />
      <TeamPicker key={`p2-${teamsVersion}`} isOpen={pickerOpen === 2} onClose={() => setPickerOpen(null)} onSelect={setTeam2} currentTeamId={team2} />

      {/* 1. HEADER — Visifoot style: large bold centered title */}
      <div className="text-center space-y-3 mt-2 mb-4">
        <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
          Analyse de match
        </h1>
        <p className="text-xs md:text-sm text-white/60 font-medium">
          Entre les équipes que tu veux analyser
        </p>
        <p className="text-[11px] md:text-xs text-[#10B981] font-bold max-w-sm mx-auto leading-relaxed">
          Notre IA est connectée à l'actualité foot et croise des millions de données pour chaque analyse.
        </p>
      </div>

      {/* 2. MATCH À ANALYSER CARD */}
      {!result && (
        <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[28px] p-4 md:p-5 flex flex-col shadow-lg relative overflow-hidden">
        <div className="text-[9px] font-black text-white/25 uppercase tracking-[0.2em] mb-2">
          MATCH À ANALYSER
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          {/* Selectors Area — Visifoot style */}
          <div className="flex flex-col items-center gap-2.5 w-full max-w-lg mx-auto">
              
              {/* Team 1 Selector */}
              <div className="flex flex-col items-center w-full gap-2">
                {team1 && <img src={getClub(team1!).logo} className="w-12 h-12 md:w-16 md:h-16 object-contain animate-fade-in drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" alt="" />}
                <button
                  onClick={() => setPickerOpen(1)}
                  className={`w-full bg-transparent border-2 ${team1 ? 'border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.15)] text-center' : 'border-[#10B981]/60 shadow-[0_0_15px_rgba(16,185,129,0.05)] text-left'} hover:border-[#10B981] rounded-[14px] px-4 py-3 text-sm font-semibold text-white transition-all flex items-center justify-between cursor-pointer`}
                >
                  <span className={`truncate text-white/90 ${team1 ? 'mx-auto' : ''}`}>{team1 ? getClub(team1!).name : "Cherche une équipe (ex: Barcelona, PSG...)"}</span>
                  {!team1 && <ChevronDown className="w-4 h-4 text-[#10B981]/60 shrink-0 ml-2" />}
                </button>
              </div>

              <span className="text-xs font-black text-white/30 uppercase tracking-[0.25em]">vs</span>

              {/* Team 2 Selector */}
              <div className="flex flex-col items-center w-full gap-2">
                {team2 && <img src={getClub(team2!).logo} className="w-12 h-12 md:w-16 md:h-16 object-contain animate-fade-in drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" alt="" />}
                <button
                  onClick={() => setPickerOpen(2)}
                  className={`w-full bg-transparent border-2 ${team2 ? 'border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.15)] text-center' : 'border-[#10B981]/60 shadow-[0_0_15px_rgba(16,185,129,0.05)] text-left'} hover:border-[#10B981] rounded-[14px] px-4 py-3 text-sm font-semibold text-white transition-all flex items-center justify-between cursor-pointer`}
                >
                  <span className={`truncate text-white/90 ${team2 ? 'mx-auto' : ''}`}>{team2 ? getClub(team2!).name : "Cherche une équipe (ex: Real Madrid, Bayern)"}</span>
                  {!team2 && <ChevronDown className="w-4 h-4 text-[#10B981]/60 shrink-0 ml-2" />}
                </button>
              </div>
          </div>
        </div>

        {/* Action button / Spinner */}
        <div className="w-full max-w-md mx-auto mt-4 flex flex-col items-center gap-1.5">
          {analyzing ? (
            <button disabled className="w-full bg-[#11221A] border border-[#10B981]/30 text-[#10B981] font-black py-3 rounded-full flex items-center justify-center gap-3 text-sm uppercase tracking-widest transition-all">
              <span className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
              Analyse en cours... {progressPercent}%
            </button>
          ) : (
            <button 
              onClick={() => handleAnalyze()} 
              disabled={!team1 || !team2 || team1 === team2}
              className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-black font-black py-3 rounded-full shadow-[0_4px_20px_rgba(16,185,129,0.25)] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
            >
              Analyser le match avec l'IA
            </button>
          )}
          <span className="text-[8px] text-white/25 uppercase tracking-widest font-bold mt-1">
            Basé sur stats réelles + actualités foot 2026
          </span>

          {/* ── LES GRANDS MATCHS DU JOUR ───────────────────────────────
              Sous les sélecteurs, jamais à leur place : le choix à la main
              reste le chemin principal, et il est intact. Le carrousel donne
              un point de départ à qui ouvre l'application sans idée précise —
              devant deux champs vides, il n'y avait rien à quoi se raccrocher.

              Il disparaît pendant l'analyse : proposer un autre match à
              quelqu'un qui attend le sien l'inviterait à perdre celui-là. */}
          {/* La section s'affiche MÊME sans liste : le composant dit alors
              qu'il n'y a pas de grand match. Une section qui disparaît en
              silence ne se distingue pas d'une fonctionnalité absente — on ne
              sait pas s'il n'y a rien à montrer, ou si quelque chose est cassé. */}
          {!analyzing && (
            <div className="w-full mt-4">
              <MatchsDuJour
                matchs={matchsDuJour?.matchs ?? []}
                aujourdhui={matchsDuJour?.aujourdhui ?? true}
                onChoisir={choisirMatchDuJour}
                desactive={analyzing}
              />
            </div>
          )}

          {/* ── LA NOTICE DE RECHARGEMENT ────────────────────────────────
              La même que sur le paywall et la page des tarifs : mêmes moyens
              de paiement par pays, même rappel du solde, mêmes étapes de
              mesure. Elle n'existe que pendant le clic — sa table des 243 pays
              pèse quarante-huit kilo-octets, et la page d'analyse est la plus
              visitée du site. */}
          {noticeRecharge && offreActuelle && (
            <NoticePaiement
              paysDetecte={paysRecharge}
              libelleOffre={`${offreActuelle.libelle} — ${offreActuelle.prixXof.toLocaleString('fr-FR')} FCFA`}
              cleOffre={offreActuelle.cle}
              montantXof={offreActuelle.prixXof}
              onContinuer={(paysRetenu) => rechargerAcces(paysRetenu)}
              onFermer={() => setNoticeRecharge(false)}
            />
          )}

          {/* Compteur d'analyses — valeurs fournies par le serveur, jamais
              calculées ici. Masqué pour les comptes gratuits, qui relèvent du
              paywall et non d'un quota. */}
          {isPremium && quota && (
            <div className="w-full max-w-[280px] mt-3">
              {quota.unlimited ? (
                <p className="text-[11px] text-center font-bold text-[#10B981] uppercase tracking-widest">
                  Analyses illimitées
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                    <span className="text-white/50 uppercase tracking-widest">Ce mois-ci</span>
                    <span className={quota.remaining === 0 ? 'text-red-400' : 'text-white/70'}>
                      {quota.used} / {quota.limit} analyses
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        quota.remaining === 0
                          ? 'bg-red-500'
                          : presqueASec
                            ? 'bg-warning'
                            : 'bg-gradient-to-r from-[#10B981] to-[#2DD4BF]'
                      }`}
                      style={{
                        width: `${Math.min(100, quota.limit ? (quota.used / quota.limit) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PRÉVENIR AVANT LE MUR, PAS APRÈS ─────────────────────────
              Le compteur existait déjà, mais il ne dit rien : c'est une barre
              qui se remplit, et personne ne surveille une barre. L'abonné
              découvrait sa limite en la heurtant — au moment précis où il
              voulait une analyse, donc au pire moment.

              Mesuré le 30 août 2026 : un abonné à 40/40 et un autre à 55/60,
              aucun des deux prévenu. Le premier n'a plus rien et l'ignore.

              Ce rappel n'apparaît QUE dans les trois dernières analyses, et
              disparaît à zéro — à zéro, c'est la carte « limite atteinte » qui
              parle, et deux messages sur le même sujet en même temps se
              contredisent plus qu'ils n'aident.

              Le bouton est le MÊME que celui de la carte de limite atteinte,
              avec la même offre et le même signalement d'étape : deux chemins
              d'achat écrits séparément finiraient par diverger. */}
          {presqueASec && offreActuelle && (
            <div className="w-full max-w-[300px] mt-3 rounded-[16px] border border-warning/25 bg-warning/[0.07] px-4 py-3 text-center">
              <p className="text-[12.5px] font-black text-warning">
                {quota!.remaining === 1
                  ? 'Il te reste 1 analyse'
                  : `Il te reste ${quota!.remaining} analyses`}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                Recharge maintenant : elles s&apos;ajoutent aussitôt à celles qui te
                restent, sans attendre le mois prochain.
              </p>
              <button
                type="button"
                onClick={() => {
                  signalerEtape('offre-cliquee', offreActuelle.cle);
                  setNoticeRecharge(true);
                }}
                disabled={rechargeEnCours}
                className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-warning px-5 text-[11.5px] font-black uppercase tracking-widest text-black transition-all active:scale-95 disabled:cursor-wait disabled:opacity-60"
              >
                {rechargeEnCours ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Ouverture du paiement…
                  </>
                ) : (
                  <>
                    Recharger — {offreActuelle.prixXof.toLocaleString('fr-FR')} FCFA
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
          {/* Premium Inline Error Card */}
          {analyzeError && !analyzing && (
            analyzeError === "LIMIT_REACHED" ? (
            <div className="w-full max-w-md mx-auto mt-4 bg-gradient-to-b from-[#1A150B] to-[#0A1118] border border-warning/25 rounded-[20px] p-6 flex flex-col items-center text-center gap-3 animate-fade-in shadow-[0_0_40px_rgba(234,179,8,0.10)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-warning/50 to-transparent"></div>

              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-1">
                <Timer className="w-6 h-6 text-warning drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
              </div>

              <div className="space-y-2">
                <h4 className="text-[13px] font-black text-white tracking-[0.1em] uppercase">
                  Limite mensuelle atteinte
                </h4>
                <p className="text-xs text-white/50 font-medium leading-relaxed max-w-[300px] mx-auto">
                  Vous avez utilisé vos {quota?.limit ?? ''} analyses de ce mois.
                  {quota?.periodEnd
                    ? ` Votre compteur repart le ${new Date(quota.periodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`
                    : ''}
                  {' '}Passez au VIP Annuel pour des analyses illimitées.
                </p>
              </div>

              {/* ── LE RACHAT, ICI ET MAINTENANT ───────────────────────────
                  Celui qui est à sec repaye vingt-sept fois plus que celui à
                  qui il reste du crédit — 18,8 % contre 0,7 %, mesuré le
                  24 août 2026. L'écran renvoyait vers la page des tarifs :
                  une marche de plus, pour relire trois offres et recliquer sur
                  celle qu'on avait déjà.

                  Le bouton propose SON niveau, jamais l'offre d'entrée : un
                  membre Pro qui rachèterait l'Essentiel garderait son Pro,
                  période inchangée, et perdrait son argent. */}
              {offreActuelle ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      signalerEtape('offre-cliquee', offreActuelle.cle);
                      setNoticeRecharge(true);
                    }}
                    disabled={rechargeEnCours}
                    className="mt-3 w-full max-w-[300px] bg-warning hover:bg-warning/90 active:scale-95 text-black font-bold py-3.5 px-6 rounded-full transition-all flex items-center justify-center gap-2 text-[12px] uppercase tracking-widest disabled:opacity-60 disabled:cursor-wait min-h-[52px]"
                  >
                    {rechargeEnCours ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Ouverture du paiement…
                      </>
                    ) : (
                      <>
                        Recharger — {offreActuelle.prixXof.toLocaleString('fr-FR')} FCFA
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-[10.5px] text-white/35 mt-1 leading-relaxed">
                    Vos {quota?.limit ?? ''} analyses repartent immédiatement.
                  </p>

                  {/* Celui qui veut comparer garde son chemin, en second. */}
                  <Link
                    href="/pricing"
                    onClick={() => signalerEtape('vers-tarifs')}
                    className="text-[11px] text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
                  >
                    Voir toutes les offres
                  </Link>
                </>
              ) : (
                <Link
                  href="/pricing"
                  className="mt-3 bg-warning hover:bg-warning/90 active:scale-95 text-black font-bold py-2.5 px-6 rounded-full transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
                >
                  Voir les offres <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            ) : analyzeError === "PREMIUM_REQUIRED" ? (
            <div className="w-full max-w-md mx-auto mt-4 bg-gradient-to-b from-[#16242e] to-[#16242e] border border-primary/25 rounded-[20px] p-6 flex flex-col items-center text-center gap-3 animate-fade-in shadow-[0_0_40px_rgba(16,185,129,0.10)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                <Lock className="w-6 h-6 text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>

              <div className="space-y-2">
                <h4 className="text-[13px] font-black text-white tracking-[0.1em] uppercase">
                  Analyse réservée aux accès payants
                </h4>
                <p className="text-xs text-white/50 font-medium leading-relaxed max-w-[280px] mx-auto">
                  L'analyseur IA fait partie de l'offre Premium. Obtenez l'accès pour lancer des analyses illimitées sur tous les grands championnats.
                </p>
              </div>

              <Link
                href="/pricing"
                className="mt-3 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold py-2.5 px-6 rounded-[16px] transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
              >
                Voir les offres <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            ) : (
            <div className="w-full max-w-md mx-auto mt-4 bg-gradient-to-b from-[#1A0B10] to-[#16242e] border border-red-500/20 rounded-[20px] p-6 flex flex-col items-center text-center gap-3 animate-fade-in shadow-[0_0_40px_rgba(239,68,68,0.08)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>

              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-1">
                <AlertTriangle className="w-6 h-6 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              </div>

              <div className="space-y-2">
                <h4 className="text-[13px] font-black text-white tracking-[0.1em] uppercase">
                  Analyse Interrompue
                </h4>
                <p className="text-xs text-white/50 font-medium leading-relaxed max-w-[280px] mx-auto">
                  {analyzeError.includes("introuvables")
                    ? "Les équipes sélectionnées ne sont pas reconnues dans notre base de données. Veuillez choisir une équipe valide."
                    : analyzeError.includes("statistiques")
                    ? "Le serveur de statistiques est temporairement surchargé. Réessayez dans un instant."
                    : "Une erreur de connexion au modèle d'intelligence artificielle est survenue."}
                </p>
              </div>

              <button
                onClick={() => { setAnalyzeError(null); handleAnalyze(); }}
                className="mt-3 bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/30 text-red-400 font-bold py-2.5 px-6 rounded-[16px] transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
              >
                <RefreshCcw className="w-4 h-4" /> Réessayer
              </button>
            </div>
            )
          )}
        </div>
      </div>
      )}

      {/* 3. LOADING CARD WITH CIRCULAR SVG PROGRESS (Screenshots 2 & 3 layout) */}
      {analyzing && (
        <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-8 text-center shadow-lg space-y-6 animate-pulse">
          {/* Circular SVG Ring */}
          <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="60"
                stroke="#16242e"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="60"
                stroke="#10B981"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 60}
                strokeDashoffset={2 * Math.PI * 60 * (1 - progressPercent / 100)}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <span className="absolute text-3xl font-black text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
              {progressPercent}%
            </span>
          </div>

          <div className="space-y-2">
            <h4 className="text-lg font-black text-white">Analyse en cours...</h4>
            <p className="text-xs text-[#10B981] font-bold h-5 transition-all duration-300">
              {steps[analyzingStep]}
            </p>
          </div>

          {/* Fine horizontal linear progress bar */}
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 max-w-sm mx-auto shadow-inner">
            <div 
              className="h-full bg-[#10B981] transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>
      )}

      {/* 4. PROCHAINS MATCHS
          L'historique personnel flouté qui se trouvait ici a été déplacé dans
          l'onglet « Historique ». Il n'avait rien à faire sur cette page : un
          visiteur qui n'a jamais rien analysé y voyait un bloc vide, et celui
          qui venait d'analyser y voyait son propre travail flouté derrière un
          cadenas. Ni l un ni l autre ne donne envie d acheter. */}
      {!analyzing && !result && (
        <>
          {/* DESKTOP ONLY: Prochains matchs */}
          {futureMatches.length > 0 && (
            <div className="space-y-2.5 hidden lg:block">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
                Prochains matchs
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {futureMatches.map((m) => {
                  const hCl = getClub(m.homeTeam);
                  const aCl = getClub(m.awayTeam);
                  // Le jour et l'heure sortent du MÊME instant, donc du même
                  // fuseau : ils ne peuvent plus se contredire. Avant, la
                  // colonne donnait le jour du serveur et l'heure celui de
                  // Paris — « 25/08 à 00:30 » pour un match du 26.
                  const [day, month] = jourEtMoisLocaux(m.kickoffISO ?? m.timestamp, m.date);
                  return (
                    <button 
                      key={m.id}
                      onClick={() => handleQuickMatchSelect(m.homeTeam, m.awayTeam)}
                      className="w-full bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 hover:border-primary/20 h-[56px] rounded-[20px] flex items-center px-4 shadow-sm transition-all group active:scale-[0.99]"
                    >
                      {/* Date column — fixed width */}
                      <div className="w-[52px] shrink-0 text-center border-r border-white/5 pr-3 mr-3">
                        <span className="text-[10px] text-white/40 font-bold leading-none block">{day}/{month}</span>
                        <span className="text-[10px] text-white/30 font-semibold leading-none block mt-0.5">{heureLocale(m.kickoffISO ?? m.timestamp, m.time)}</span>
                      </div>

                      {/* Match row — flex with fixed logo sizes and centered vs */}
                      <div className="flex items-center flex-1 min-w-0">
                        <span className="text-[11px] font-extrabold text-white/90 group-hover:text-primary transition-colors truncate flex-1 text-right pr-2">
                          {hCl.name}
                        </span>
                        <img src={hCl.logo} className="w-5 h-5 object-contain shrink-0" alt="" />
                        <span className="text-[9px] text-white/25 font-black mx-2 shrink-0">vs</span>
                        <img src={aCl.logo} className="w-5 h-5 object-contain shrink-0" alt="" />
                        <span className="text-[11px] font-extrabold text-white/90 truncate flex-1 text-left pl-2">
                          {aCl.name}
                        </span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-primary transition-colors shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          📊 RESULTS SECTION (Differentiated: Real Results vs IA Predictions)
          ========================================================================= */}
      {result && (
        <div className="space-y-8 animate-fade-in">
          
          {/* 🔴 MATCH EN COURS.
              Il s'affiche AU-DESSUS de l'analyse, qui reste entièrement
              visible : l'intérêt est justement de confronter ce qui avait été
              annoncé à ce qui se passe sur le terrain. */}
          {result.live && (
            <div className="mb-8 bg-[#1d2f3a]/60 backdrop-blur-md border border-[#EF4444]/25 rounded-[28px] md:rounded-[32px] p-4 sm:p-6 md:p-8 shadow-lg">
              <div className="flex items-center justify-center gap-2 mb-5 md:mb-6">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#EF4444]" />
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-black text-[#EF4444] uppercase tracking-widest text-center">
                  En direct · {result.live.statutLibelle}
                  {result.live.minute !== null && !result.live.miTemps && ` · ${result.live.minute}'`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1.5 md:gap-12 w-full">
                <div className="flex flex-col items-center gap-2 w-[32%] min-w-0">
                  <img src={getClub(team1!).logo} className="w-12 h-12 sm:w-14 sm:h-14 md:w-18 md:h-18 object-contain" alt="" />
                  {/* Deux lignes autorisées plutôt qu'un nom coupé à « Pa… » :
                      un club tronqué ne se reconnaît pas. */}
                  <span className="text-[11px] sm:text-xs md:text-base font-black text-center text-white leading-tight w-full">
                    {getClub(team1!).name}
                  </span>
                </div>

                <div className="flex items-center justify-center bg-black/40 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full border border-white/5 shrink-0 self-start mt-3 md:mt-0">
                  <span className="text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tight whitespace-nowrap">
                    {result.live.buts1} <span className="text-white/25">-</span> {result.live.buts2}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 w-[32%] min-w-0">
                  <img src={getClub(team2!).logo} className="w-12 h-12 sm:w-14 sm:h-14 md:w-18 md:h-18 object-contain" alt="" />
                  <span className="text-[11px] sm:text-xs md:text-base font-black text-center text-white leading-tight w-full">
                    {getClub(team2!).name}
                  </span>
                </div>
              </div>

              {/* Un but tient sur une ligne au bureau, jamais sur un téléphone
                  de 360 px : le nom du buteur, le passeur et le club dans une
                  seule rangée écrasaient tout. Le buteur reste donc en tête, le
                  passeur et le club passent en dessous. */}
              {result.live.buteurs?.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/5 space-y-3">
                  {result.live.buteurs.map((b: any, i: number) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="text-white/35 font-bold tabular-nums w-8 shrink-0 text-[12px] pt-[3px]">
                        {b.minute}&apos;
                      </span>
                      <span className="text-white/25 shrink-0 text-[12px] pt-[3px]">⚽</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold text-[13px] leading-tight ${
                              b.cote === "team1" ? "text-white" : "text-white/70"
                            }`}
                          >
                            {b.joueur}
                          </span>
                          {b.precision && (
                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wide">
                              {b.precision}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[10.5px] text-white/30 mt-0.5">
                          <span className="font-bold text-white/40">
                            {b.cote === "team1" ? getClub(team1!).name : getClub(team2!).name}
                          </span>
                          {b.passeur && <span>· passe de {b.passeur}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Trois statistiques côte à côte débordaient à 360 px. Une
                  grille de trois colonnes égales tient sur toutes les largeurs
                  et se lit mieux qu'une ligne qui se coupe n'importe où. */}
              {result.live.statistiques && (
                <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
                  {[
                    { libelle: "Tirs", a: result.live.statistiques.tirs1, b: result.live.statistiques.tirs2 },
                    { libelle: "Cadrés", a: result.live.statistiques.cadres1, b: result.live.statistiques.cadres2 },
                    {
                      libelle: "Possession",
                      a: result.live.statistiques.possession1,
                      b: result.live.statistiques.possession2,
                    },
                  ].map((s) => (
                    <div key={s.libelle}>
                      <p className="text-[13px] font-black text-white/80 tabular-nums whitespace-nowrap">
                        {s.a ?? "—"} <span className="text-white/20">·</span> {s.b ?? "—"}
                      </p>
                      <p className="text-[9.5px] text-white/30 uppercase tracking-wide mt-0.5">{s.libelle}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Projection de l'issue, recalculée sur le score acquis et le
                  temps restant. Réservée aux acces payants : c'est une prédiction. */}
              {result.finalPrediction && (
                <div className="mt-6 bg-black/25 border border-white/5 rounded-[20px] p-4 sm:p-5">
                  <p className="text-[9.5px] sm:text-[10px] font-black text-white/35 uppercase tracking-widest mb-2.5">
                    Prévision du résultat final
                  </p>

                  {/* ── LE SCORE FINAL PRÉVU, ÉCRIT EN TOUTES LETTRES ────────
                      Ce bloc ne montrait que du texte et des pourcentages. Le
                      score final projeté existait dans les données mais
                      n'apparaissait nulle part : impossible de savoir sur quel
                      score le moteur voyait le match se terminer. */}
                  <div className="flex items-center justify-center gap-3 bg-black/40 px-5 py-2.5 rounded-full border border-white/5 w-fit mx-auto mb-3.5">
                    <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                      {result.finalPrediction.scoreFinal1}
                      <span className="text-white/25 mx-1.5">-</span>
                      {result.finalPrediction.scoreFinal2}
                    </span>
                  </div>

                  <p className="text-[13px] sm:text-sm text-white font-bold leading-relaxed mb-4">
                    {result.finalPrediction.verdict}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    {[
                      { cle: "t1", libelle: getClub(team1!).name, valeur: result.finalPrediction.probaVictoire1 },
                      { cle: "nul", libelle: "Nul", valeur: result.finalPrediction.probaNul },
                      { cle: "t2", libelle: getClub(team2!).name, valeur: result.finalPrediction.probaVictoire2 },
                    ].map((c) => (
                      <div key={c.cle} className="bg-white/[0.03] rounded-2xl py-2.5 sm:py-3 px-1 min-w-0">
                        <p className="text-lg sm:text-xl font-black text-[#10B981] tabular-nums">{c.valeur}%</p>
                        <p className="text-[9.5px] sm:text-[10px] text-white/40 leading-tight break-words">
                          {c.libelle}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9.5px] sm:text-[10px] text-white/25 mt-3 text-center leading-relaxed">
                    Recalculé sur le score actuel et les {result.finalPrediction.minutesRestantes} minutes restantes.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* A. 🔴 MATCH TERMINÉ : REAL MATCH RESULTS REPORT */}
          {result.isFinished ? (
            <div className="space-y-8">
              
              {/* Event Header & Scoreboard */}
              <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 md:p-8 flex flex-col items-center shadow-lg">
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-full px-3 py-1 text-[9px] font-black text-[#EF4444] uppercase tracking-widest mb-6">
                  ⚽ Match Terminé - Résultats Réels
                </div>

                <div className="flex items-center justify-between gap-2 md:gap-12 w-full mb-5">
                  {/* Home */}
                  <div className="flex flex-col items-center gap-2 w-[35%]">
                    <img src={getClub(team1!).logo} className="w-14 h-14 md:w-18 md:h-18 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]" alt="" />
                    <span className="text-xs md:text-base font-black text-center leading-tight text-white truncate max-w-full">
                      {getClub(team1!).name}
                    </span>
                  </div>

                  {/* Real Score Container */}
                  <div className="flex items-center justify-center bg-black/40 px-5 py-2.5 rounded-full border border-white/5 shadow-inner shrink-0">
                    <span className="text-3xl md:text-5xl font-black text-[#10B981] font-[Space Grotesk] tracking-tight">
                      {result.score.split("-")[0].trim()}
                    </span>
                    <span className="text-lg font-bold text-white/20 mx-2.5">-</span>
                    <span className="text-3xl md:text-5xl font-black text-[#EF4444] font-[Space Grotesk] tracking-tight">
                      {result.score.split("-")[1].trim()}
                    </span>
                  </div>

                  {/* Away */}
                  <div className="flex flex-col items-center gap-2 w-[35%]">
                    <img src={getClub(team2!).logo} className="w-14 h-14 md:w-18 md:h-18 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]" alt="" />
                    <span className="text-xs md:text-base font-black text-center leading-tight text-white truncate max-w-full">
                      {getClub(team2!).name}
                    </span>
                  </div>
                </div>

                {/* Match Metadata Info */}
                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-4 mt-2">
                  <span>📅 {result.date}</span>
                  <span>📍 {result.venue}</span>
                  <span>🏆 {result.competition}</span>
                </div>
              </div>

              {/* Match Events Timeline */}
              {result.events && result.events.length > 0 && (
                <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                    <Timer className="w-5 h-5 text-[#10B981]" />
                    <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
                      Chronologie du match
                    </h4>
                  </div>

                  <div className="space-y-4 relative before:absolute before:left-1/2 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5 before:-translate-x-1/2">
                    {result.events.map((ev: any, idx: number) => {
                      const isLeft = ev.side === "team1";
                      return (
                        <div key={idx} className="flex items-center w-full relative z-10">
                          {/* Left Aligned (Team 1 Event) */}
                          <div className={`w-1/2 ${isLeft ? 'text-right pr-6 md:pr-10' : 'invisible pl-6 md:pl-10 pr-0'}`}>
                            <div className="inline-flex flex-col">
                              <span className="text-xs font-bold text-white leading-tight">
                                {ev.name}
                              </span>
                              <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-widest mt-0.5">
                                {ev.type === "goal" ? "⚽ But" : "🟨 Carton Jaune"}
                              </span>
                            </div>
                          </div>

                          {/* Central Minute Badge */}
                          <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#1d2f3a] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shadow">
                            {ev.minute}'
                          </div>

                          {/* Right Aligned (Team 2 Event) */}
                          <div className={`w-1/2 ${!isLeft ? 'text-left pl-6 md:pl-10' : 'invisible pr-6 md:pr-10 pl-0'}`}>
                            <div className="inline-flex flex-col">
                              <span className="text-xs font-bold text-white leading-tight">
                                {ev.name}
                              </span>
                              <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-widest mt-0.5">
                                {ev.type === "goal" ? "⚽ But" : "🟨 Carton Jaune"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Real Match Stats Comparison */}
              {result.stats && (
                <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6">
                    <BarChart3 className="w-5 h-5 text-[#10B981]" />
                    <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
                      Statistiques réelles de la rencontre
                    </h4>
                  </div>

                  <div className="space-y-5">
                    <DualBar label="Possession" v1={result.stats.possession.team1} v2={result.stats.possession.team2} suffix="%" />
                    <DualBar label="Tirs" v1={result.stats.shots.team1} v2={result.stats.shots.team2} />
                    <DualBar label="Tirs Cadrés" v1={result.stats.shotsOnTarget.team1} v2={result.stats.shotsOnTarget.team2} />
                    <DualBar label="Corners" v1={result.stats.corners.team1} v2={result.stats.corners.team2} />
                    <DualBar label="Fautes Commises" v1={result.stats.fouls.team1} v2={result.stats.fouls.team2} invertColors={true} />
                    <DualBar label="Passes Réussies" v1={result.stats.passes.team1} v2={result.stats.passes.team2} />
                  </div>
                </div>
              )}

              {/* Match Detailed Summary */}
              {result.summary && (
                <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[28px] p-6 shadow-md space-y-3">
                  <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
                    Résumé de la rencontre
                  </h4>
                  <p className="text-xs text-white/80 leading-relaxed font-semibold">
                    {result.summary}
                  </p>
                </div>
              )}

            </div>
          ) : (
            // B. 🔮 FUTURE MATCH : IA PREDICTION REPORT
            <div className="space-y-8">
              
              {/* HEADER VISIFOOT STYLE FOR ANALYZED MATCH */}
              <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-6 rounded-[28px] space-y-5 shadow-md flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold">Match analysé</span>
                
                <div className="flex flex-col items-center gap-4 w-full text-center">
                  <div className="flex flex-col items-center gap-3">
                    <img src={getClub(team1!).logo} className="w-14 h-14 md:w-20 md:h-20 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" alt="" />
                    <span className="font-black text-white text-base md:text-xl">{getClub(team1!).name}</span>
                  </div>
                  
                  <span className="text-xl font-black text-white/20 uppercase tracking-widest">VS</span>
                  
                  <div className="flex flex-col items-center gap-3">
                    <img src={getClub(team2!).logo} className="w-14 h-14 md:w-20 md:h-20 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" alt="" />
                    <span className="font-black text-white text-base md:text-xl">{getClub(team2!).name}</span>
                  </div>
                </div>
                
                <div className="mt-4 bg-[#10B981]/10 border border-[#10B981]/30 rounded-full px-6 py-2.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                   <span className="text-[#10B981] text-xs font-bold uppercase tracking-widest">Analyse IA prête</span>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold mb-2">Basée sur stats + actualité foot</span>
                
                {/* Contexte réel de la rencontre : compétition, coup d'envoi,
                    stade et ville. Centré et sur une seule ligne fluide, comme
                    un en-tête de match professionnel. */}
                <div className="w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-4 border-t border-white/5 text-[11px] md:text-xs font-semibold text-white/60">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm">🏆</span> {result.competition || "Match International"}
                  </span>
                  {(result.kickoffISO || result.date) && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm">📅</span>
                      {/* Date ET heure dans le fuseau du lecteur, tirées du
                          même instant. Un membre à Conakry lisait 21:00 pour
                          un coup d'envoi à 19:00 chez lui. */}
                      {dateLongueLocale(result.kickoffISO, result.date)}
                      {heureLocale(result.kickoffISO, result.time)
                        ? ` à ${heureLocale(result.kickoffISO, result.time)}`
                        : ""}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm">📍</span>
                    {result.venue || getClub(team1!).stadium || "Stade National"}
                    {result.venueCity ? ` · ${result.venueCity}` : ""}
                  </span>
                </div>
              </div>

              {/* Forme Récente - Visifoot Clone */}
              <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-5 rounded-[28px] shadow-md">
                <div className="flex justify-between items-center text-xs font-semibold text-white mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <h4 className="font-black text-sm" style={{fontFamily: "var(--police-titre), sans-serif"}}>Forme récente</h4>
                  </div>
                  <span className="text-[10px] text-white/40">Forme globale (toutes compétitions)</span>
                </div>

                <div className="flex justify-between items-start px-2 md:px-8 mb-6">
                  {/* Team 1 */}
                  <div className="flex flex-col items-center gap-3 w-1/2">
                    <span className="font-bold text-sm text-white/90">{getClub(team1!).name}</span>
                    <div className="flex items-center gap-3">
                      <img src={getClub(team1!).logo} className="w-8 h-8 object-contain shrink-0" alt="" />
                      {(() => {
                        const d = dynamique(matchsRecents(result, 'team1'));
                        return (
                          <div className="flex flex-col items-start leading-tight">
                            <span className="text-lg mb-0.5">{d.icone}</span>
                            <span className="text-[10px] font-semibold text-white/50">{d.ligne1}</span>
                            <span className="text-[10px] font-semibold text-white/50">{d.ligne2}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Team 2 */}
                  <div className="flex flex-col items-center gap-3 w-1/2">
                    <span className="font-bold text-sm text-white/90">{getClub(team2!).name}</span>
                    <div className="flex items-center gap-3">
                      <img src={getClub(team2!).logo} className="w-8 h-8 object-contain shrink-0" alt="" />
                      {(() => {
                        const d = dynamique(matchsRecents(result, 'team2'));
                        return (
                          <div className="flex flex-col items-start leading-tight">
                            <span className="text-lg mb-0.5">{d.icone}</span>
                            <span className="text-[10px] font-semibold text-white/50">{d.ligne1}</span>
                            <span className="text-[10px] font-semibold text-white/50">{d.ligne2}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <button onClick={() => setShowGlobalForm(!showGlobalForm)} className="w-full bg-transparent border border-[#10B981]/20 hover:bg-[#10B981]/10 text-[#10B981] text-[12px] font-semibold py-3 rounded-[14px] transition-all">
                  Voir la forme en ligue
                </button>
              </div>

              {/* Les cinq derniers matchs réellement joués, adversaire et score à
                  l'appui : un membre doit pouvoir vérifier lui-même ce qu'on lui
                  annonce, pas lire une suite de pastilles sans source. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {([
                  { cote: 'team1' as const, club: getClub(team1!) },
                  { cote: 'team2' as const, club: getClub(team2!) },
                ]).map(({ cote, club }) => {
                  const matchs = matchsRecents(result, cote);
                  const lettres = lettresForme(matchs);
                  return (
                    <div key={cote} className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-4 rounded-[20px] space-y-4 shadow-md">
                      <div className="flex items-center gap-2">
                        <img src={club.logo} className="w-5 h-5 object-contain" alt="" />
                        <span className="font-bold text-[13px] text-[#9ca3af]">{club.name}</span>
                      </div>

                      {matchs.length === 0 ? (
                        <p className="text-[12px] text-white/40 leading-relaxed">
                          Aucun match joué récemment pour cette équipe.
                        </p>
                      ) : (
                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2 items-center text-[12px] font-semibold text-white">
                          <span className="whitespace-nowrap">Forme :</span>
                          <div className="flex items-center gap-1.5">
                            {renderFormEmojis(lettres)}
                            <span className="text-[11px] opacity-70" title="Prochain match à venir">⏳</span>
                          </div>

                          <span className="whitespace-nowrap">V-N-D :</span>
                          <span className="font-medium tracking-wide">{calculateVND(lettres)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── CE QUE CHACUN LIT ICI ────────────────────────────────
                  Un compte SANS acces payant ne reçoit plus `quickSummary` ni
                  `scenarios` : ces champs révélaient le favori, les buts
                  attendus et le score final. Les afficher quand même donnait
                  un « Résumé rapide » VIDE surmonté de son titre, puis un
                  « Scénario #1 » rempli d'une phrase de secours identique pour
                  tous les matchs — « un schéma tactique équilibré mais tendu ».
                  Deux blocs qui, ensemble, donnaient l'impression que rien
                  n'avait été calculé.

                  Il reçoit désormais UN SEUL bloc : la bande-annonce, écrite
                  pour ces deux équipes à partir de leurs vraies données.
                  L'affichage de l'membre, lui, ne change pas d'un caractère. */}
              {result.locked ? (
                /* ── L'AVANT-GOÛT : DU RÉCIT, JAMAIS DE CHIFFRE EXPLOITABLE ──
                   Mêmes blocs que pour un membre — Résumé rapide puis
                   Scénario #1 — mais leur contenu est écrit pour donner envie,
                   pas pour répondre. Le lecteur repart avec le contexte et les
                   intentions des deux camps ; ni score, ni tendance, ni
                   buts attendus ne quittent le serveur. */
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🔍</span>
                      <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Résumé rapide</h4>
                    </div>
                    <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                      {result.apercuResume}
                      <br/><br/>
                      <span className="text-[10px] text-[#10B981] italic font-semibold">Généré à partir de millions de données et de l&apos;actualité foot.</span>
                    </p>
                  </div>

                  {result.apercuScenario && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📌</span>
                        <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Scénario #1</h4>
                      </div>
                      <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-5 rounded-[14px]">
                        <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                          {result.apercuScenario}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Un bloc vide ne s'affiche jamais : mieux vaut une section
                      absente qu'un titre suivi de rien. */}
                  {(result.quickSummary || result.scenario) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔍</span>
                        <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Résumé rapide</h4>
                      </div>
                      <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                        {result.quickSummary || result.scenario}
                        <br/><br/>
                        <span className="text-[10px] text-[#10B981] italic font-semibold">Généré à partir de millions de données et de l&apos;actualité foot.</span>
                      </p>
                    </div>
                  )}

                  {result.scenarios?.[0]?.content && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📌</span>
                        <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Scénario #1</h4>
                      </div>
                      <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-5 rounded-[14px]">
                        <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                          {result.scenarios[0].content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confiance - EXACT VISIFOOT STYLE */}
              {result.confidence && (
                <div className="bg-[#1d2f3a]/70 border border-white/10 rounded-[20px] p-4 space-y-2 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🎯</span>
                    <h5 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Confiance de l'IA</h5>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-3 flex-1 bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div className="h-full bg-gradient-to-r from-[#10B981] to-[#2DD4BF] rounded-full transition-all duration-1000" style={{ width: `${result.confidence}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-white/80 shrink-0">
                      {result.confidence >= 80 ? "Très élevée" : result.confidence >= 60 ? "Élevée" : "Moyenne"}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/40 font-semibold pt-1">Niveau de confiance basé sur la qualité des données disponibles.</p>
                </div>
              )}

              {/* PAYWALL WRAPPER BEGIN */}
              {/* Rien n'est coupé : TOUTE l'analyse premium reste dans le flux,
                  floutée. L'utilisateur fait défiler et mesure la richesse de ce
                  qu'il achète (barres, cartes, sections) sans pouvoir rien lire.
                  Une fenêtre courte donnait l'impression qu'il n'y avait presque
                  rien à acheter. */}
              {/* ── LE FLOU SUIT LA DÉCISION DU SERVEUR, PLUS L'ABONNEMENT ────
                  Il suivait `isPremium` : « cette personne a-t-elle un
                  abonnement en cours ? ». Or ce n'est pas la question. La
                  question est : « le serveur a-t-il envoyé l'analyse complète
                  ou l'aperçu ? » — et lui seul le sait, parce que lui seul
                  connaît les trois portes qui l'ouvrent : l'abonnement,
                  l'achat de ce match à l'unité, et depuis aujourd'hui
                  l'analyse offerte.
                  Avec `isPremium`, les deux dernières recevaient l'analyse
                  entière puis la voyaient floutée, avec un mur de paiement
                  par-dessus, pour un contenu déjà acquis.
                  `result.locked` est posé par le serveur, et UNIQUEMENT quand
                  il a réellement servi l'aperçu. Le flou ne peut donc plus
                  diverger de ce qui a été envoyé. */}
              <div className="relative pt-6">
                {result.locked && (
                  /* Bloc collant, placé dans le flux normal avec une hauteur
                     nulle : il ne décale rien et reste au centre de l'écran
                     pendant tout le défilement de la zone floutée. Un enfant de
                     conteneur absolu ne peut PAS être collant, d'où ce montage. */
                  <div className="sticky top-[32vh] z-30 h-0 px-4">
                    <PaywallDeuxChemins
                      equipe1Id={result.matchUnique?.equipe1Id ?? ''}
                      equipe2Id={result.matchUnique?.equipe2Id ?? ''}
                      equipe1Nom={result.matchUnique?.equipe1Nom ?? ''}
                      equipe2Nom={result.matchUnique?.equipe2Nom ?? ''}
                      prixMatch={result.matchUnique?.prix ?? 600}
                      achatUniteDisponible={!!result.matchUnique?.disponible}
                      prixOffreComplete={offre.prixXof}
                      quotaOffreComplete={offre.analyses}
                    />
                  </div>
                )}

                {/*
                  Flou fort : aucun chiffre, aucun score, aucun texte ne doit
                  être lisible — sinon l acces perd sa raison d être. Seules
                  les formes et les couleurs restent perceptibles.
                */}
                <div className={`space-y-8 ${result.locked ? 'pointer-events-none select-none blur-[16px] opacity-[0.8] saturate-125' : ''}`}>
                  {/* L offre se propose ICI, et pas ailleurs : la personne
                      vient de payer pour ce match et tient la preuve entre les
                      mains. C'est le seul instant où « et si tu débloques
                      souvent ? » se pose tout seul. */}
                  {/* ── L'ANALYSE OFFERTE SE DIT, ELLE NE SE DEVINE PAS ───────
                      Sans ce bandeau, la personne reçoit son analyse complète
                      et en conclut logiquement que l'application est gratuite.
                      Elle en lance une deuxième, se heurte au mur, et comprend
                      qu'on lui a retiré quelque chose — l'inverse exact d'un
                      cadeau.
                      Dit ici, au moment où elle tient la preuve entre les
                      mains, c'est le seul instant où le prix se présente tout
                      seul : elle vient de voir ce qu'elle achèterait. */}
                  {result.essaiOffert && (
                    <div className="rounded-[20px] border border-[#FDE047]/25 bg-[#FDE047]/[0.06] p-4 flex flex-col gap-3">
                      <p className="text-[13px] font-bold text-white leading-snug">
                        🎁 Voici votre analyse complète, offerte.
                      </p>
                      <p className="text-[12px] text-white/60 leading-relaxed">
                        C&apos;est la seule. Les suivantes demandent un accès —
                        l&apos;offre {offre.libelle} à {prixOffre} FCFA en donne {quotaOffre} par
                        mois.
                      </p>
                      <Link
                        href="/pricing"
                        className="inline-flex items-center justify-center gap-2 font-black py-3 px-5 rounded-full text-[13px] transition-all active:scale-95 min-h-[48px] w-full sm:w-auto sm:self-start"
                        style={{
                          background: "linear-gradient(135deg, #2DD4BF 0%, #10B981 100%)",
                          color: "#101c24",
                        }}
                      >
                        Voir l&apos;offre
                      </Link>
                    </div>
                  )}

                  {result.debloqueParAchat && (
                    <div className="rounded-[20px] border border-[#10B981]/25 bg-[#10B981]/[0.07] p-4 flex flex-col gap-3">
                      <p className="text-[13px] font-bold text-white leading-snug">
                        Tu débloques souvent des matchs ?
                      </p>
                      <p className="text-[12px] text-white/60 leading-relaxed">
                        L&apos;accès {offre.libelle} à {prixOffre} FCFA te donne {quotaOffre} par
                        mois.
                      </p>
                      <Link
                        href="/pricing"
                        className="inline-flex items-center justify-center gap-2 font-black py-3 px-5 rounded-full text-[13px] transition-all active:scale-95 min-h-[48px] w-full sm:w-auto sm:self-start"
                        style={{
                          background: "linear-gradient(135deg, #2DD4BF 0%, #10B981 100%)",
                          color: "#101c24",
                        }}
                      >
                        Voir l&apos;offre
                      </Link>
                    </div>
                  )}

                  {/* Le serveur ne transmet plus le contenu payant à un compte
                      gratuit : il n'y a donc rien à afficher ici, seulement la
                      silhouette de ce que contient l'analyse complète. */}
                  {result.locked ? (
                    <LockedAnalysisPreview
                      scenarios={result.lockedScenarios}
                      sections={result.lockedSections}
                    />
                  ) : (
                  <>
                  {/* Score pill */}
                  {result.predictedScore && (
                    <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 md:p-8 shadow-lg">
                      {/* ── L'ÉTIQUETTE CHANGE QUAND LE MATCH EST COMMENCÉ ──────
                          « Score estimé par l'IA » au-dessus d'un 1-2, pendant
                          qu'un direct affiche 1-1 plus haut, se lit comme une
                          contradiction. C'en est une seulement si l'on ignore
                          QUAND le pronostic a été fait.
                          Le dire lève tout le malentendu : ce chiffre est celui
                          d'avant le coup d'envoi, il ne bouge plus, et c'est sur
                          lui que l'application sera jugée. */}
                      <div className="flex items-center gap-3 mb-2">
                        <Trophy className="w-5 h-5 text-[#10B981]" />
                        <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>
                          {result.live ? "Analyse d'avant-match" : "Score estimé par l'IA"}
                        </h4>
                      </div>
                      {result.live && (
                        <p className="text-[11px] text-white/40 leading-relaxed mb-5">
                          Annoncé avant le coup d&apos;envoi, et inchangé depuis. C&apos;est cette
                          analyse qui sera jugée à la fin du match.
                        </p>
                      )}

                      <div className="flex items-center justify-center gap-4 md:gap-12 my-6 w-full">
                        <div className="flex flex-col items-center gap-2 w-[30%]">
                          <img src={getClub(team1!).logo} className="w-10 h-10 object-contain" alt="" />
                          <span className="text-xs font-black text-white/75 text-center truncate">{getClub(team1!).shortName}</span>
                        </div>
                        <div className="flex items-center justify-center gap-3 bg-black/40 px-6 py-3 rounded-full border border-white/5 shadow-inner">
                          <span className="text-3xl md:text-5xl font-black text-[#10B981] font-[Space Grotesk]">{result.predictedScore.team1Goals}</span>
                          <span className="text-lg font-bold text-white/20">-</span>
                          <span className="text-3xl md:text-5xl font-black text-[#EF4444] font-[Space Grotesk]">{result.predictedScore.team2Goals}</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 w-[30%]">
                          <img src={getClub(team2!).logo} className="w-10 h-10 object-contain" alt="" />
                          <span className="text-xs font-black text-white/75 text-center truncate">{getClub(team2!).shortName}</span>
                        </div>
                      </div>

                  <div className="mt-6 bg-black/35 border border-white/5 rounded-[20px] p-5">
                    <h5 className="text-xs font-black uppercase tracking-wider text-white/40 mb-2">Explication stratégique</h5>
                    <p className="text-xs text-white/70 leading-relaxed font-semibold">{result.predictedScore.reasoning}</p>
                  </div>

                  {/* ── LA MENTION EST ICI, PAS EN BAS DE PAGE ────────────────
                      Elle suit immédiatement la conclusion du moteur, parce
                      que c'est la seule ligne que tout le monde lit. Placée
                      sous le pied de page, elle serait vraie et invisible. */}
                  <p className="mt-4 text-[10.5px] text-white/30 leading-relaxed">
                    Projection statistique produite par un modèle mathématique, fournie à titre
                    informatif. Elle décrit une tendance, jamais une certitude : aucun résultat
                    n&apos;est garanti.
                  </p>
                </div>
              )}

              {/* Indices de performance */}
              <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 space-y-6 shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📊</span>
                  <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Indices de performance</h4>
                </div>
                <div className="space-y-4">
                  <ProbBar label={"Victoire " + getClub(team1!).name} value={result.winProb} />
                  <ProbBar label="Match nul" value={result.drawProb} />
                  <ProbBar label={"Victoire " + getClub(team2!).name} value={result.loseProb} />
                </div>
              </div>

              {/* Scenarios 2 to 4 */}
              {result.scenarios && result.scenarios.length > 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <span className="text-lg">💡</span>
                    <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Scénarios #2 à #4</h4>
                  </div>
                  <div className="space-y-3.5">
                    {result.scenarios.slice(1).map((sc: any, idx: number) => (
                      <div key={idx} className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-5 rounded-[28px] shadow-sm">
                        <h5 className="text-sm font-black text-[#10B981] mb-2">{sc.title}</h5>
                        <p className="text-xs text-white/70 leading-relaxed font-semibold">{sc.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats Comparison (Como vs Roma style) */}
              {result.comparison && (
                <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-lg">📊</span>
                    <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Comparaison statistique</h4>
                  </div>
                  <div className="flex justify-between text-xs font-black mb-6 px-1 uppercase tracking-widest">
                    <span className="text-[#10B981]">{getClub(team1!).name}</span>
                    <span className="text-[#EF4444]">{getClub(team2!).name}</span>
                  </div>
                  <div className="space-y-5">
                    <DualBar label="Attaque" v1={result.comparison.attack.team1} v2={result.comparison.attack.team2} suffix="%" />
                    <DualBar label="Défense" v1={result.comparison.defense.team1} v2={result.comparison.defense.team2} suffix="%" />
                    <DualBar label="Forme" v1={result.comparison.form.team1} v2={result.comparison.form.team2} suffix="%" />
                    <DualBar label="H2H" v1={result.comparison.h2h.team1} v2={result.comparison.h2h.team2} suffix="%" />
                    <DualBar label="Buts" v1={result.comparison.goals.team1} v2={result.comparison.goals.team2} suffix="%" />
                    <DualBar label="Global" v1={result.comparison.global.team1} v2={result.comparison.global.team2} suffix="%" />
                  </div>
                </div>
              )}

              {/* Predictions (Expected goals + BTTS) */}
              {result.predictions && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <span className="text-lg">🎯</span>
                    <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Nos analyses</h4>
                  </div>
                  
                  <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 space-y-6 shadow-sm">
                    <div>
                      <h5 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4">Buts attendus</h5>
                      <div className="space-y-3 bg-black/25 p-4 rounded-[20px] border border-white/5">
                        <div className="flex justify-between text-xs font-semibold text-white/80">
                          <span>{getClub(team1!).name}</span>
                          <span className="font-black">{result.predictions.expectedGoals.team1} buts</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-white/80">
                          <span>{getClub(team2!).name}</span>
                          <span className="font-black">{result.predictions.expectedGoals.team2} buts</span>
                        </div>
                        <div className="flex justify-between text-xs pt-3 border-t border-white/5 text-white/90">
                          <span className="font-black">Total</span>
                          <span className="font-black text-[#10B981]">{result.predictions.expectedGoals.total} buts</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5">
                      <h5 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4">Les deux équipes marquent</h5>
                      <DualBar label="" v1={result.predictions.btts.yes} v2={result.predictions.btts.no} suffix="%" customL1="Oui" customL2="Non" hideTitle={true} />
                    </div>

                    {/* ── LA CAGE INVIOLÉE ──────────────────────────────────
                        Tirée de la même grille de Poisson que tout ce qui
                        précède, sans donnée supplémentaire. Elle répond à ce
                        que « les deux marquent : non » laissait ouvert : cette
                        réponse-là couvre 1-0, 0-1 et 0-0 sans jamais dire
                        laquelle des deux défenses tient. */}
                    {result.predictions.cleanSheet && (
                      <div className="pt-4 border-t border-white/5">
                        <h5 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4">Garde sa cage inviolée</h5>
                        <div className="space-y-2.5">
                          {[
                            { nom: getClub(team1!).name, valeur: result.predictions.cleanSheet.team1 },
                            { nom: getClub(team2!).name, valeur: result.predictions.cleanSheet.team2 },
                          ].map((c) => (
                            <div key={c.nom} className="flex items-center gap-3">
                              <span className="text-xs text-white/60 flex-1 min-w-0 truncate">{c.nom}</span>
                              <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden shrink-0">
                                <div
                                  className="h-full rounded-full bg-[#10B981]"
                                  style={{ width: `${Math.max(0, Math.min(100, c.valeur))}%` }}
                                />
                              </div>
                              <span className="text-xs font-black text-white/90 tabular-nums w-10 text-right shrink-0">
                                {c.valeur} %
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-sm">
                    <h5 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6">Tendance sur le nombre de buts</h5>
                    <div className="space-y-5">
                       <DualBar label="" v1={result.predictions.overUnder.over05} v2={100 - result.predictions.overUnder.over05} suffix="%" customL1="Plus de 0.5 buts" customL2="Moins de 0.5 buts" hideTitle={true} isThin={true} />
                       <DualBar label="" v1={result.predictions.overUnder.over15} v2={100 - result.predictions.overUnder.over15} suffix="%" customL1="Plus de 1.5 buts" customL2="Moins de 1.5 buts" hideTitle={true} isThin={true} />
                       <DualBar label="" v1={result.predictions.overUnder.over25} v2={100 - result.predictions.overUnder.over25} suffix="%" customL1="Plus de 2.5 buts" customL2="Moins de 2.5 buts" hideTitle={true} isThin={true} />
                       <DualBar label="" v1={result.predictions.overUnder.over35} v2={100 - result.predictions.overUnder.over35} suffix="%" customL1="Plus de 3.5 buts" customL2="Moins de 3.5 buts" hideTitle={true} isThin={true} />
                    </div>
                  </div>
                </div>
              )}

              {/* Key strengths */}
              {result.keyStrengths && (
                <div className="space-y-4">
                   <div className="flex items-center gap-3 px-2">
                     <span className="text-lg">📋</span>
                     <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Forces clés identifiées par l'IA</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {[team1!, team2!].map((tid, idx) => {
                       const strengths = idx === 0 ? result.keyStrengths.team1 : result.keyStrengths.team2;
                       return (
                         <div key={tid} className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-5 rounded-[28px] space-y-4 shadow-md">
                           <div className="flex items-center gap-3">
                             <img src={getClub(tid).logo} className="w-6 h-6 object-contain" alt=""/>
                             <span className="font-extrabold text-sm text-white">{getClub(tid).name}</span>
                           </div>
                           <ul className="space-y-2">
                             {strengths.map((s: string, i: number) => (
                               <li key={i} className="text-xs text-white/80 font-semibold flex items-start gap-2 leading-relaxed">
                                 <span className="text-[#10B981] font-black shrink-0">•</span>
                                 <span>{s}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                       );
                     })}
                   </div>
                </div>
              )}

              {/* Advanced metrics */}
              {result.advancedMetrics && (
                <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6">
                    <Zap className="w-5 h-5 text-[#10B981]" />
                    <div>
                      <h4 className="font-black text-base text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>Modèles Tactiques Avancés</h4>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest font-black mt-0.5">Moteurs FBref & StatsBomb</p>
                    </div>
                  </div>
                  <div className="space-y-8 mt-6 px-1">
                    <ModernMetricBar label="Possession Moyenne" description="Pourcentage de contrôle du ballon estimé" val1={result.advancedMetrics.possession.team1} val2={result.advancedMetrics.possession.team2} suffix="%" />
                    <ModernMetricBar label="Expected Goals (xG)" description="Buts Attendus : Qualité des occasions créées" val1={result.advancedMetrics.xG.team1} val2={result.advancedMetrics.xG.team2} />
                    <ModernMetricBar label="Expected Threat (xT)" description="Menace Attendue : Danger généré par les passes" val1={result.advancedMetrics.xT.team1} val2={result.advancedMetrics.xT.team2} />
                    <ModernMetricBar label="Pressing (PPDA)" description="Plus ce chiffre est BAS, plus l'équipe presse haut et fort" val1={result.advancedMetrics.ppda.team1} val2={result.advancedMetrics.ppda.team2} invertColors={true} />
                  </div>
                </div>
              )}

              {/* Sections */}
              <div className="space-y-5">
                <h4 className="font-black text-lg px-2 font-[Space Grotesk] text-white">Analyse Détaillée & Explications</h4>
                {result.sections?.map((section: any, i: number) => {
                  const iconMap: any = { Brain, Zap, Shield, Target, Activity, History, Loader, BarChart3, Trophy, Award };
                  const IconComp = iconMap[section.icon] || Brain;
                  return (
                    <div key={i} className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[28px] p-5 md:p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-[16px] bg-black/40 border border-white/5 flex items-center justify-center text-[#10B981]">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-black text-white" style={{fontFamily: "var(--police-titre), sans-serif"}}>{section.title}</h4>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed font-semibold whitespace-pre-line">{section.content}</p>
                    </div>
                  );
                })}
              </div>
              
                  </>
                  )}
              {/* PAYWALL WRAPPER END */}
              </div>
              </div>

            </div>
          )}


        </div>
      )}

      {/* NOS PRONOSTICS VÉRIFIÉS.
          Hors de toute condition : la section reste visible avant l'analyse,
          pendant, et après. C'est justement quand le visiteur vient de voir son
          analyse floutée qu'il a besoin d'une raison de croire au produit. */}
      {preuves}
    </div>
    </div>
  );
}

function ProbBar({ label, value }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-black text-white uppercase tracking-widest">
        <span>{label}</span>
        <span className="text-[#10B981]">{value}%</span>
      </div>
      <div className="h-2.5 bg-black/40 border border-white/5 rounded-full overflow-hidden shadow-inner">
        <div className="h-full bg-[#10B981] transition-all duration-1000 rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DualBar({ label, v1, v2, suffix="", customL1="", customL2="", hideTitle=false, isThin=false, invertColors=false }: any) {
  const rv1 = Math.round(Number(v1) * 10) / 10;
  const rv2 = Math.round(Number(v2) * 10) / 10;
  const total = rv1 + rv2;
  const w1 = total === 0 ? 50 : (rv1 / total) * 100;
  const w2 = total === 0 ? 50 : (rv2 / total) * 100;

  const leftColor = invertColors ? "bg-[#EF4444]" : "bg-[#10B981]";
  const rightColor = invertColors ? "bg-[#10B981]" : "bg-[#EF4444]";

  return (
    <div className="space-y-2">
      {/* Title / Values Row */}
      {!hideTitle && (
        <div className="flex justify-between items-center text-xs font-black text-white/50 tracking-wider">
          <span className={`${invertColors ? 'text-[#EF4444]' : 'text-[#10B981]'} font-black`}>{rv1}{suffix}</span>
          <span className="text-white/80 font-extrabold uppercase tracking-widest" style={{fontFamily: "var(--police-titre), sans-serif"}}>{label}</span>
          <span className={`${invertColors ? 'text-[#10B981]' : 'text-[#EF4444]'} font-black`}>{rv2}{suffix}</span>
        </div>
      )}
      
      {/* Text label when title is hidden */}
      {hideTitle && (customL1 || customL2) && (
        <div className="flex justify-between text-[11px] font-black text-white/60">
          <span>{customL1}</span>
          <span>{customL2}</span>
        </div>
      )}

      {/* Progress Bar Track */}
      <div className={`relative ${isThin ? 'h-4' : 'h-6'} rounded-full flex overflow-hidden bg-black/45 border border-white/5 shadow-inner`}>
        {/* Left Segment */}
        <div 
          className={`h-full ${leftColor} flex items-center justify-center transition-all duration-1000 shrink-0`} 
          style={{ width: `${w1}%` }}
        >
          <span className="text-[10px] font-black text-black leading-none">{rv1}{suffix}</span>
        </div>
        
        {/* Small gap/divider */}
        <div className="w-[2px] h-full bg-[#1d2f3a] shrink-0 z-10" />

        {/* Right Segment */}
        <div 
          className={`h-full ${rightColor} flex items-center justify-center transition-all duration-1000 shrink-0`} 
          style={{ width: `${w2}%` }}
        >
          <span className="text-[10px] font-black text-white leading-none">{rv2}{suffix}</span>
        </div>
      </div>
    </div>
  );
}

function ModernMetricBar({ label, description, val1, val2, suffix = "", invertColors = false }: any) {
  const isV1Better = invertColors ? Number(val1) < Number(val2) : Number(val1) > Number(val2);
  const total = Number(val1) + Number(val2);
  const w1 = total === 0 ? 50 : (Number(val1) / total) * 100;
  const w2 = total === 0 ? 50 : (Number(val2) / total) * 100;

  return (
    <div className="flex flex-col space-y-4 relative group">
      <div className="flex justify-between items-end px-1 relative">
        <span className={`text-xl md:text-3xl font-black ${isV1Better ? 'text-[#10B981] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-white/60'}`} style={{fontFamily: "var(--police-titre), sans-serif"}}>{val1}{suffix}</span>
        
        <div className="absolute left-0 right-0 flex flex-col items-center justify-end bottom-0 z-10 pointer-events-none">
          <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.2em] text-white/40 bg-[#1d2f3a] px-2">{label}</span>
          {description && (
            <span className="text-[8.5px] font-bold text-[#10B981]/80 bg-[#1d2f3a] px-2 mt-0.5 tracking-wide max-w-[180px] md:max-w-xs text-center leading-tight">
              {description}
            </span>
          )}
        </div>

        <span className={`text-xl md:text-3xl font-black ${!isV1Better ? 'text-[#EF4444] drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'text-white/60'}`} style={{fontFamily: "var(--police-titre), sans-serif"}}>{val2}{suffix}</span>
      </div>
      <div className="relative h-3 bg-black/45 rounded-full flex overflow-hidden border border-white/5 shadow-inner">
        <div className="h-full bg-gradient-to-r from-[#10B981]/70 to-[#10B981] transition-all duration-1000 ease-out" style={{ width: `${w1}%` }} />
        <div className="w-[2px] h-full bg-[#1d2f3a] shrink-0 z-10" />
        <div className="h-full bg-gradient-to-l from-[#EF4444]/70 to-[#EF4444] transition-all duration-1000 ease-out" style={{ width: `${w2}%` }} />
      </div>
    </div>
  );
}

/**
 * Silhouette de l analyse complète, affichée aux comptes sans acces payant.
 *
 * Le serveur ne transmet plus les tendances, le score prédit, les métriques
 * ni les sections détaillées : il n'y a donc plus rien de payant à flouter.
 * Ce bloc reproduit la STRUCTURE de l'analyse — les titres réels des rubriques
 * et des blocs vides — pour que le visiteur mesure le volume de ce qu'il
 * achète. Aucune valeur inventée n'y figure : les emplacements sont vides,
 * volontairement.
 */
function LockedAnalysisPreview({ scenarios, sections }: { scenarios?: number; sections?: number }) {
  const bar = "h-3 rounded-full bg-white/10";
  const line = "h-2.5 rounded-full bg-white/10";

  return (
    <div className="space-y-8" aria-hidden="true">
      {/* Score prédit */}
      <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 md:p-8 shadow-lg space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-[#10B981]" />
          <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
            Score estimé par l'IA
          </h4>
        </div>
        <div className="flex items-center justify-center gap-6 py-4">
          <div className="w-16 h-12 rounded-[16px] bg-white/10" />
          <span className="text-white/20 text-2xl font-black">-</span>
          <div className="w-16 h-12 rounded-[16px] bg-white/10" />
        </div>
      </div>

      {/* Tendances */}
      <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md space-y-5">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[#10B981]" />
          <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
            Tendances du match
          </h4>
        </div>
        {[68, 42, 55].map((w, i) => (
          <div key={i} className="space-y-2">
            <div className={`${line} w-1/3`} />
            <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className={bar} style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Métriques avancées */}
      <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md space-y-5">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-[#10B981]" />
          <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
            Métriques avancées
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-black/20 rounded-[20px] p-4 space-y-3">
              <div className={`${line} w-2/3`} />
              <div className={`${bar} w-1/2`} />
            </div>
          ))}
        </div>
      </div>

      {/* Points forts */}
      <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md space-y-4">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-[#10B981]" />
          <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
            Points forts et faiblesses
          </h4>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${line} ${i % 2 === 0 ? "w-11/12" : "w-4/5"}`} />
        ))}
      </div>

      {/* Scénarios restants */}
      {Array.from({ length: Math.max(1, scenarios ?? 2) }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📌</span>
            <h4 className="font-black text-base text-white" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
              Scénario #{i + 2}
            </h4>
          </div>
          <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 p-5 rounded-[14px] space-y-3">
            <div className={`${line} w-full`} />
            <div className={`${line} w-10/12`} />
            <div className={`${line} w-2/3`} />
          </div>
        </div>
      ))}

      {/* Analyse détaillée */}
      <h4 className="font-black text-lg px-2 font-[Space Grotesk] text-white">Analyse Détaillée &amp; Explications</h4>
      {Array.from({ length: Math.max(2, sections ?? 4) }).map((_, i) => (
        <div key={i} className="bg-[#1d2f3a]/60 backdrop-blur-md border border-white/5 rounded-[28px] p-5 md:p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[16px] bg-black/40 border border-white/5 flex items-center justify-center text-[#10B981]">
              <Brain className="w-4 h-4" />
            </div>
            <div className={`${line} w-1/3`} />
          </div>
          <div className="space-y-2.5">
            <div className={`${line} w-full`} />
            <div className={`${line} w-11/12`} />
            <div className={`${line} w-3/4`} />
          </div>
        </div>
      ))}
    </div>
  );
}
