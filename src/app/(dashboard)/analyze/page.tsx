"use client";

import { useState, useRef, useEffect } from "react";
import { Brain, Target, Shield, Zap, BarChart3, ChevronRight, ChevronDown, ChevronLeft, Search, Pin, Award, Trophy, Timer, X, Activity, History, Loader } from "lucide-react";
import { clubs, getClub, matches, competitions } from "@/lib/data";

// Extract future matches for the "Prochains matchs" list
const futureMatches = matches.filter(m => m.status === "upcoming");

// Group clubs by league for the picker
const leagueOrder = ["ucl", "epl", "laliga", "ligue1", "seriea", "bundesliga", "eredivisie", "ligaportugal", "proleague", "premiership", "superlig", "wc", "can", "caf"];
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
  ucl: "Autres Europe",
  wc: "Coupe du Monde 2026",
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
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedLeague(null);
      setSearchQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // French -> English translation dictionary for search
  const frToEn: Record<string, string> = {
    "écosse": "scotland", "ecosse": "scotland", "france": "france", "espagne": "spain",
    "allemagne": "germany", "angleterre": "england", "italie": "italy",
    "brésil": "brazil", "bresil": "brazil", "pays-bas": "netherlands", "hollande": "netherlands",
    "belgique": "belgium", "portugal": "portugal", "maroc": "morocco",
    "sénégal": "senegal", "senegal": "senegal", "algérie": "algeria", "algerie": "algeria",
    "côte d'ivoire": "ivory", "cote d'ivoire": "ivory", "ivoire": "ivory",
    "cameroun": "cameroon", "égypte": "egypt", "egypte": "egypt", "ghana": "ghana",
    "nigeria": "nigeria", "mali": "mali", "guinée": "guinea", "guinee": "guinea",
    "tunisie": "tunisia", "argentine": "argentina", "colombie": "colombia",
    "mexique": "mexico", "croatie": "croatia", "danemark": "denmark",
    "suisse": "switzerland", "suède": "sweden", "suede": "sweden",
    "norvège": "norway", "norvege": "norway", "pologne": "poland",
    "turquie": "turkey", "grèce": "greece", "russie": "russia",
    "galles": "wales", "états-unis": "usa", "etats-unis": "usa",
    "paris": "paris", "madrid": "madrid", "barcelone": "barcelona", "barcelona": "barcelona",
    "munich": "munich", "milan": "milan", "inter": "inter", "juventus": "juventus",
    "arsenal": "arsenal", "chelsea": "chelsea", "liverpool": "liverpool",
    "marseille": "marseille", "lyon": "lyon", "monaco": "monaco", "lille": "lille",
    "porto": "porto", "benfica": "benfica", "sporting": "sporting",
    "ajax": "ajax", "psv": "psv", "feyenoord": "feyenoord",
    "celtic": "celtic", "rangers": "rangers", "dortmund": "dortmund",
  };

  // Translate French query to English for matching
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const translatedQuery = frToEn[normalizedQuery] || normalizedQuery;

  // Search across all clubs (matching French names too)
  const searchResults = searchQuery.trim().length >= 2
    ? Object.values(clubs).filter((c: any) =>
        c.name.toLowerCase().includes(normalizedQuery) ||
        c.name.toLowerCase().includes(translatedQuery) ||
        c.shortName.toLowerCase().includes(normalizedQuery) ||
        c.shortName.toLowerCase().includes(translatedQuery)
      )
    : [];

  const showSearch = searchQuery.trim().length >= 2;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#0D1520] border border-white/10 rounded-t-[28px] md:rounded-[28px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {selectedLeague && (
              <button onClick={() => setSelectedLeague(null)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-4 h-4 text-white/70" />
              </button>
            )}
            <h3 className="text-sm font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {selectedLeague ? leagueLabels[selectedLeague] : "Choisir une équipe"}
            </h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
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
                className="w-full bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-white placeholder:text-white/25 outline-none focus:border-[#10B981]/40 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-5 pt-1 custom-scrollbar">
          {/* Search results */}
          {showSearch ? (
            <div className="space-y-1 px-2">
              {searchResults.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-6 font-semibold">Aucun résultat</p>
              ) : (
                searchResults.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
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
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/5 transition-all group"
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
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

function renderFormEmojis(form: ("W" | "D" | "L")[]) {
  const emojis: string[] = form.map(f => f === "W" ? "✅" : f === "D" ? "🟡" : "❌");
  // Pad with hourglass up to 5 elements
  while (emojis.length < 5) {
    emojis.push("⏳");
  }
  // Add one future match indicator
  emojis.push("⏳");
  return emojis.join(" ");
}

function calculateVND(form: ("W" | "D" | "L")[]) {
  const w = form.filter(f => f === "W").length;
  const d = form.filter(f => f === "D").length;
  const l = form.filter(f => f === "L").length;
  return `${w}-${d}-${l}`;
}

function CompetitionCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayComps = competitions.filter(c => c.region === "europe" || c.id === "wc" || c.id === "can");
  
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

export default function AnalyzePage() {
  const [team1, setTeam1] = useState<string | null>(null);
  const [team2, setTeam2] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showGlobalForm, setShowGlobalForm] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<1 | 2 | null>(null);
  const [todayHistory, setTodayHistory] = useState<any[]>([]);

  const steps = [
    "🔍 Recherche des statistiques en temps réel...",
    "🧠 Analyse tactique et styles de jeu...",
    "⚡ Analyse des blessures et suspensions...",
    "📊 Calcul des probabilités et xG...",
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

  const handleAnalyze = async (overrideT1?: string, overrideT2?: string) => {
    const activeT1 = overrideT1 || team1;
    const activeT2 = overrideT2 || team2;
    
    if (!activeT1 || !activeT2 || activeT1 === activeT2) return;
    
    setAnalyzing(true);
    setResult(null);
    setAnalyzingStep(0);
    setAnalysisError(null);
    
    const startTime = Date.now();
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length - 1) {
        setAnalyzingStep(currentStep);
      }
    }, 1200);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: getClub(activeT1),
          team2: getClub(activeT2)
        })
      });

      if (!res.ok) {
        throw new Error("Erreur serveur API");
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      clearInterval(interval);
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
            type: data.isFinished ? "Résultat passé" : "Prédiction IA",
            score: data.isFinished ? data.score : `${data.predictedScore?.team1Goals ?? 2} - ${data.predictedScore?.team2Goals ?? 1}`,
            confidence: data.confidence || (data.isFinished ? 100 : 85),
            summary: data.quickSummary || data.summary || "Analyse tactique et prédictive complète générée par l'IA ProFoot.",
            winProb: data.winProb,
            drawProb: data.drawProb,
            loseProb: data.loseProb,
            data: data
          };

          const existing = JSON.parse(localStorage.getItem("profoot_user_history_v1") || "[]");
          localStorage.setItem("profoot_user_history_v1", JSON.stringify([historyItem, ...existing]));
          console.log("[HISTORY] Analyse enregistrée avec succès dans l'historique personnel.");
          
          // Notifier la Sidebar pour mettre à jour le compteur
          window.dispatchEvent(new Event("profoot-analysis-done"));
        } catch (e) {
          console.error("Erreur lors de l'enregistrement dans l'historique:", e);
        }

      }, remainingTime + 300);

    } catch (error: any) {
      clearInterval(interval);
      setAnalyzing(false);
      setAnalysisError(error?.message || "Une erreur est survenue lors de l'analyse tactique.");
    }
  };

  const handleQuickMatchSelect = (hId: string, aId: string) => {
    setTeam1(hId);
    setTeam2(aId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    handleAnalyze(hId, aId);
  };

  const progressPercent = Math.round(((analyzingStep + 1) / steps.length) * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24 px-4 md:px-0 pt-0 animate-fade-in">
      
      {/* Team Picker Modals */}
      <TeamPicker isOpen={pickerOpen === 1} onClose={() => setPickerOpen(null)} onSelect={setTeam1} currentTeamId={team1} />
      <TeamPicker isOpen={pickerOpen === 2} onClose={() => setPickerOpen(null)} onSelect={setTeam2} currentTeamId={team2} />

      {/* 1. HEADER — tighter, premium */}
      <div className="text-center space-y-1 mt-0">
        <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Analyse de match
        </h1>
        <p className="text-[11px] md:text-xs text-white/50 font-medium">
          Entre les équipes que tu veux analyser
        </p>
        <p className="text-[10px] md:text-[11px] text-[#10B981] font-bold max-w-sm mx-auto leading-snug">
          Notre IA est connectée à l'actualité foot et croise des millions de données pour chaque pronostic.
        </p>
      </div>
      {/* ERROR BANNER - shown when analysis fails */}
      {analysisError && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 animate-fade-in">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <X className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-red-400">Erreur d&apos;analyse</p>
            <p className="text-xs text-red-400/70 mt-0.5 leading-relaxed">
              {analysisError === "Erreur serveur API" || analysisError.includes("404") || analysisError.includes("introuvables")
                ? "Cette équipe n'a pas encore été trouvée dans notre base de données. Essayez avec un autre nom ou choisissez une autre équipe."
                : "Une erreur est survenue lors de la connexion au serveur d'analyse. Vérifiez votre connexion et réessayez."}
            </p>
          </div>
          <button onClick={() => setAnalysisError(null)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors shrink-0">
            <X className="w-3 h-3 text-red-400/60" />
          </button>
        </div>
      )}


      <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[24px] p-4 md:p-5 flex flex-col shadow-lg relative overflow-hidden">
        <div className="text-[9px] font-black text-white/25 uppercase tracking-[0.2em] mb-2">
          MATCH À ANALYSER
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          {/* Animated Logos Area */}
          <div className="flex items-center justify-center w-full min-h-[140px] mb-4">
            {(!team1 || !team2) ? (
              <CompetitionCarousel />
            ) : (
              <div className="flex items-center justify-center gap-6 md:gap-16 w-full animate-fade-in">
                <img src={getClub(team1!).logo} className="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform hover:scale-110" alt="" />
                <span className="text-sm md:text-xl font-black text-white/15 uppercase tracking-[0.25em]">vs</span>
                <img src={getClub(team2!).logo} className="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform hover:scale-110" alt="" />
              </div>
            )}
          </div>

          {/* Selectors Area */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-6 w-full max-w-lg mx-auto">
              <button
                onClick={() => setPickerOpen(1)}
                className="w-full bg-black/40 border border-[#10B981]/40 hover:border-[#10B981] rounded-[14px] px-4 py-3.5 text-sm font-black text-white text-center shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">{team1 ? getClub(team1!).name : "Sélectionner Équipe 1"}</span>
                <ChevronDown className="w-4 h-4 text-white/40 shrink-0 ml-2" />
              </button>

              <span className="text-[10px] font-black text-white/15 uppercase tracking-[0.25em] sm:hidden">vs</span>

              <button
                onClick={() => setPickerOpen(2)}
                className="w-full bg-black/40 border border-[#10B981]/40 hover:border-[#10B981] rounded-[14px] px-4 py-3.5 text-sm font-black text-white text-center shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">{team2 ? getClub(team2!).name : "Sélectionner Équipe 2"}</span>
                <ChevronDown className="w-4 h-4 text-white/40 shrink-0 ml-2" />
              </button>
          </div>
        </div>

        {/* Action button / Spinner */}
        <div className="w-full max-w-md mx-auto mt-6 flex flex-col items-center gap-1.5">
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
        </div>
      </div>

      {/* 3. LOADING CARD WITH CIRCULAR SVG PROGRESS (Screenshots 2 & 3 layout) */}
      {analyzing && (
        <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-8 text-center shadow-lg space-y-6 animate-pulse">
          {/* Circular SVG Ring */}
          <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="60"
                stroke="#0A1118"
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
            <span className="absolute text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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

      {/* 4. HISTORIQUE / PROCHAINS MATCHS */}
      {!analyzing && !result && (
        <>
          {/* MOBILE ONLY: Analyses d'aujourd'hui */}
          <div className="space-y-3 block lg:hidden">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
              {todayHistory.length > 0 
                ? `${todayHistory.length} match${todayHistory.length > 1 ? 's' : ''} analysé${todayHistory.length > 1 ? 's' : ''}` 
                : "Historique des analyses"}
            </h4>
            {todayHistory.length === 0 ? (
              <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[18px] p-5 text-center shadow-sm">
                <span className="block text-sm font-bold text-white mb-2">Aucun match analysé pour le moment</span>
                <span className="block text-xs text-white/40">Analysez votre premier match pour commencer votre historique.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {todayHistory.map((item, idx) => {
                  // Ensure we handle both string IDs and object structures from local storage safely
                  const hCl = typeof item.team1 === 'string' ? getClub(item.team1) : item.team1;
                  const aCl = typeof item.team2 === 'string' ? getClub(item.team2) : item.team2;
                  
                  return (
                    <button 
                      key={idx}
                      onClick={() => handleQuickMatchSelect(hCl?.id || '', aCl?.id || '')}
                      className="w-full bg-[#111A24]/60 backdrop-blur-md border border-white/5 hover:border-primary/20 rounded-[18px] flex flex-col p-4 shadow-sm transition-all group active:scale-[0.99] text-left"
                    >
                      <div className="flex items-center w-full mb-3">
                        <span className="text-[13px] font-extrabold text-white/90 truncate flex-1 text-right pr-2">
                          {hCl?.name || "Inconnu"}
                        </span>
                        <img src={hCl?.logo} className="w-6 h-6 object-contain shrink-0" alt="" />
                        <span className="text-[10px] text-white/25 font-black mx-2 shrink-0">vs</span>
                        <img src={aCl?.logo} className="w-6 h-6 object-contain shrink-0" alt="" />
                        <span className="text-[13px] font-extrabold text-white/90 truncate flex-1 text-left pl-2">
                          {aCl?.name || "Inconnu"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 w-full bg-white/5 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-white/40 font-medium">
                            {item.date ? new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Récemment"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-white/60 font-semibold">Score prédit :</span>
                          <span className="text-[12px] text-[#10B981] font-black">{item.score}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-white/60 font-semibold">Fiabilité :</span>
                          <span className="text-[11px] text-white font-bold">{item.confidence}%</span>
                        </div>
                      </div>
                      {item.summary && (
                        <p className="mt-3 text-[10px] text-white/40 leading-relaxed line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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
                  const [day, month] = m.date.split("/");
                  return (
                    <button 
                      key={m.id}
                      onClick={() => handleQuickMatchSelect(m.homeTeam, m.awayTeam)}
                      className="w-full bg-[#111A24]/60 backdrop-blur-md border border-white/5 hover:border-primary/20 h-[56px] rounded-[18px] flex items-center px-4 shadow-sm transition-all group active:scale-[0.99]"
                    >
                      {/* Date column — fixed width */}
                      <div className="w-[52px] shrink-0 text-center border-r border-white/5 pr-3 mr-3">
                        <span className="text-[10px] text-white/40 font-bold leading-none block">{day}/{month}</span>
                        <span className="text-[10px] text-white/30 font-semibold leading-none block mt-0.5">{m.time}</span>
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
          
          {/* A. 🔴 MATCH TERMINÉ : REAL MATCH RESULTS REPORT */}
          {result.isFinished ? (
            <div className="space-y-8">
              
              {/* Event Header & Scoreboard */}
              <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 md:p-8 flex flex-col items-center shadow-lg">
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
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                    <Timer className="w-5 h-5 text-[#10B981]" />
                    <h4 className="font-black text-base text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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
                          <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#0B151E] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shadow">
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
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6">
                    <BarChart3 className="w-5 h-5 text-[#10B981]" />
                    <h4 className="font-black text-base text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[24px] p-6 shadow-md space-y-3">
                  <h4 className="font-black text-base text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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
              
              {/* Form Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 p-5 rounded-[24px] space-y-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <img src={getClub(team1!).logo} className="w-6 h-6 object-contain" alt="" />
                    <span className="font-extrabold text-sm text-white">{getClub(team1!).name}</span>
                  </div>
                  <div className="text-xs font-semibold text-white/60 flex items-center gap-2">
                    <span>Forme :</span>
                    <span className="text-sm flex items-center gap-1">
                      {renderFormEmojis(getClub(team1!).form)}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white/60">
                    <span>V-N-D : </span>
                    <span className="font-black text-white">{calculateVND(getClub(team1!).form)}</span>
                  </div>
                </div>
                
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 p-5 rounded-[24px] space-y-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <img src={getClub(team2!).logo} className="w-6 h-6 object-contain" alt="" />
                    <span className="font-extrabold text-sm text-white">{getClub(team2!).name}</span>
                  </div>
                  <div className="text-xs font-semibold text-white/60 flex items-center gap-2">
                    <span>Forme :</span>
                    <span className="text-sm flex items-center gap-1">
                      {renderFormEmojis(getClub(team2!).form)}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white/60">
                    <span>V-N-D : </span>
                    <span className="font-black text-white">{calculateVND(getClub(team2!).form)}</span>
                  </div>
                </div>
              </div>

              {/* Scenarios */}
              <div className="bg-[#111A24]/40 backdrop-blur-md border border-white/5 rounded-[32px] p-6 space-y-6 shadow-md">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔍</span>
                    <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Résumé rapide</h4>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed font-semibold">{result.quickSummary || result.scenario}</p>
                  <p className="text-[10px] text-[#10B981] font-black uppercase tracking-wider">Généré à partir de millions de données et de l'actualité foot.</p>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📌</span>
                    <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Scénario #1</h4>
                  </div>
                  <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 p-5 rounded-[24px]">
                    <p className="text-sm text-white/80 leading-relaxed font-semibold">
                      {result.scenarios?.[0]?.content || "Le match devrait se dérouler selon un schéma tactique équilibré mais tendu."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Score pill */}
              {result.predictedScore && (
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 md:p-8 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <Trophy className="w-5 h-5 text-[#10B981]" />
                    <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Score prédit par l'IA</h4>
                  </div>
                  
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

                  {/* Confiance */}
                  <div className="mt-8 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      <h5 className="text-xs font-black text-white/50 uppercase tracking-widest">Confiance de l'IA</h5>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-3.5 flex-1 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                        <div className="h-full bg-[#10B981]" style={{ width: `${result.confidence}%` }}></div>
                      </div>
                      <span className="text-xs font-black text-white shrink-0">
                        {result.confidence >= 80 ? "Très élevée" : result.confidence >= 60 ? "Élevée" : "Moyenne"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 bg-black/35 border border-white/5 rounded-[20px] p-5">
                    <h5 className="text-xs font-black uppercase tracking-wider text-white/40 mb-2">Explication stratégique</h5>
                    <p className="text-xs text-white/70 leading-relaxed font-semibold">{result.predictedScore.reasoning}</p>
                  </div>
                </div>
              )}

              {/* Win probabilities */}
              <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 space-y-6 shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📊</span>
                  <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Probabilités exactes</h4>
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
                    <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Scénarios #2 à #4</h4>
                  </div>
                  <div className="space-y-3.5">
                    {result.scenarios.slice(1).map((sc: any, idx: number) => (
                      <div key={idx} className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 p-5 rounded-[24px] shadow-sm">
                        <h5 className="text-sm font-black text-[#10B981] mb-2">{sc.title}</h5>
                        <p className="text-xs text-white/70 leading-relaxed font-semibold">{sc.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats Comparison (Como vs Roma style) */}
              {result.comparison && (
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-lg">📊</span>
                    <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Comparaison statistique</h4>
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
                    <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Nos prédictions</h4>
                  </div>
                  
                  <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 space-y-6 shadow-sm">
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
                  </div>

                  <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-sm">
                    <h5 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6">Probabilités sur le nombre de buts</h5>
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
                     <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Forces clés identifiées par l'IA</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {[team1!, team2!].map((tid, idx) => {
                       const strengths = idx === 0 ? result.keyStrengths.team1 : result.keyStrengths.team2;
                       return (
                         <div key={tid} className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 p-5 rounded-[24px] space-y-4 shadow-md">
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
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-6">
                    <Zap className="w-5 h-5 text-[#10B981]" />
                    <div>
                      <h4 className="font-black text-base text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Modèles Tactiques Avancés</h4>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest font-black mt-0.5">Moteurs FBref & StatsBomb</p>
                    </div>
                  </div>
                  <div className="space-y-6 mt-6 px-1">
                    <ModernMetricBar label="Possession Moyenne Estimée" val1={result.advancedMetrics.possession.team1} val2={result.advancedMetrics.possession.team2} suffix="%" />
                    <ModernMetricBar label="Expected Goals (xG)" val1={result.advancedMetrics.xG.team1} val2={result.advancedMetrics.xG.team2} />
                    <ModernMetricBar label="Expected Threat (xT)" val1={result.advancedMetrics.xT.team1} val2={result.advancedMetrics.xT.team2} />
                    <ModernMetricBar label="Intensité du Pressing (PPDA)" val1={result.advancedMetrics.ppda.team1} val2={result.advancedMetrics.ppda.team2} invertColors={true} />
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
                    <div key={i} className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[28px] p-5 md:p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-[#10B981]">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-black text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{section.title}</h4>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed font-semibold whitespace-pre-line">{section.content}</p>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* GLOBAL FORM (Dynamicmatches list toggle) */}
          {result.globalForm && (
            <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-md">
              <button onClick={() => setShowGlobalForm(!showGlobalForm)} className="w-full bg-transparent border border-primary/25 py-3.5 rounded-[20px] text-xs font-black text-primary hover:bg-[#10B981]/5 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                {showGlobalForm ? "Masquer" : "Voir"} l'historique complet (5 derniers matchs)
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showGlobalForm ? 'rotate-180' : ''}`} />
              </button>

              {showGlobalForm && (
                <div className="mt-6 space-y-6 border-t border-white/5 pt-6 animate-fade-in">
                  {[team1!, team2!].map((tid, idx) => {
                    const cl = getClub(tid);
                    const formData = idx === 0 ? result.globalForm.team1 : result.globalForm.team2;
                    if (!formData) return null;
                    return (
                      <div key={tid} className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          <img src={cl.logo} className="w-6 h-6 object-contain" alt="" />
                          <h5 className="font-black text-xs uppercase tracking-wider text-white">{cl.name}</h5>
                        </div>

                        {/* Recent Matches List */}
                        {formData.recentMatches && (
                          <div className="space-y-2">
                            {formData.recentMatches.map((m: any, mi: number) => (
                              <div key={mi} className="flex items-center justify-between bg-black/25 border border-white/5 rounded-[20px] px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${m.result === 'W' ? 'bg-primary/10 text-primary border border-primary/20' : m.result === 'D' ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-danger/10 text-danger border border-danger/20'}`}>
                                    {m.result === 'W' ? 'V' : m.result === 'D' ? 'N' : 'D'}
                                  </span>
                                  <div className="truncate">
                                    <span className="text-xs font-bold text-white block truncate max-w-[120px]">{m.opponent}</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block mt-0.5">{m.competition}</span>
                                  </div>
                                </div>
                                <span className="text-xs font-black text-white/80 shrink-0">{m.score}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Stats Summary */}
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                          <div className="bg-black/20 border border-white/5 rounded-[16px] p-2 text-center shadow-inner">
                            <p className="text-base font-black text-[#10B981] font-[Space Grotesk]">{formData.goalsScored}</p>
                            <p className="text-[8px] text-white/40 uppercase tracking-widest font-black mt-0.5">Marqués</p>
                          </div>
                          <div className="bg-black/20 border border-white/5 rounded-[16px] p-2 text-center shadow-inner">
                            <p className="text-base font-black text-danger font-[Space Grotesk]">{formData.goalsConceded}</p>
                            <p className="text-[8px] text-white/40 uppercase tracking-widest font-black mt-0.5">Encaissés</p>
                          </div>
                          <div className="bg-black/20 border border-white/5 rounded-[16px] p-2 text-center shadow-inner">
                            <p className="text-base font-black text-white font-[Space Grotesk]">{formData.cleanSheets}</p>
                            <p className="text-[8px] text-white/40 uppercase tracking-widest font-black mt-0.5">Clean S.</p>
                          </div>
                          <div className="bg-black/20 border border-white/5 rounded-[16px] p-2 text-center shadow-inner">
                            <p className="text-base font-black text-[#10B981] font-[Space Grotesk]">{formData.avgPossession}%</p>
                            <p className="text-[8px] text-white/40 uppercase tracking-widest font-black mt-0.5">Poss.</p>
                          </div>
                          <div className="bg-black/20 border border-white/5 rounded-[16px] p-2 text-center shadow-inner col-span-3 md:col-span-1 mx-auto w-1/2 md:w-full">
                            <p className="text-base font-black text-warning font-[Space Grotesk]">{formData.winStreak}</p>
                            <p className="text-[8px] text-white/40 uppercase tracking-widest font-black mt-0.5">Série V</p>
                          </div>
                        </div>

                        {idx === 0 && <div className="border-b border-white/5 mt-4"></div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}
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
          <span className="text-white/80 font-extrabold uppercase tracking-widest" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{label}</span>
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
        <div className="w-[2px] h-full bg-[#0B151E] shrink-0 z-10" />

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

function ModernMetricBar({ label, val1, val2, suffix = "", invertColors = false }: any) {
  const isV1Better = invertColors ? val1 < val2 : val1 > val2;
  const total = Number(val1) + Number(val2);
  const w1 = total === 0 ? 50 : (Number(val1) / total) * 100;
  const w2 = total === 0 ? 50 : (Number(val2) / total) * 100;

  return (
    <div className="flex flex-col space-y-3 relative group">
      <div className="flex justify-between items-end px-1 relative">
        <span className={`text-xl md:text-3xl font-black ${isV1Better ? 'text-[#10B981] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-white/60'}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>{val1}{suffix}</span>
        <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.2em] text-white/40 absolute left-0 right-0 text-center bottom-1.5">{label}</span>
        <span className={`text-xl md:text-3xl font-black ${!isV1Better ? 'text-[#EF4444] drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'text-white/60'}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>{val2}{suffix}</span>
      </div>
      <div className="relative h-3 bg-black/45 rounded-full flex overflow-hidden border border-white/5 shadow-inner">
        <div className="h-full bg-gradient-to-r from-[#10B981]/70 to-[#10B981] transition-all duration-1000 ease-out" style={{ width: `${w1}%` }} />
        <div className="w-[2px] h-full bg-[#0B151E] shrink-0 z-10" />
        <div className="h-full bg-gradient-to-l from-[#EF4444]/70 to-[#EF4444] transition-all duration-1000 ease-out" style={{ width: `${w2}%` }} />
      </div>
    </div>
  );
}
