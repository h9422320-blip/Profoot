"use client";

import { useState, useEffect } from "react";
import { 
  Search, Brain, Globe, Sparkles, ArrowRight, ExternalLink, RefreshCw, 
  Clock, Flame, Activity, BarChart2, ShieldAlert, ChevronRight, HelpCircle
} from "lucide-react";

interface SearchSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

interface SearchResult {
  answer: string;
  sources: SearchSource[];
  relatedQuestions: string[];
  timestamp: string;
}

interface HistoryItem {
  id: string;
  query: string;
  filter?: string;
  timestamp: string;
  result: SearchResult;
}

const QUICK_FILTERS = [
  { id: "all", label: "Tout le web", icon: Globe, color: "text-primary border-primary/40 bg-primary/10" },
  { id: "news", label: "🔥 Dernières News", icon: Flame, color: "text-danger border-danger/40 bg-danger/10" },
  { id: "injuries", label: "🏥 Blessures & Infirmerie", icon: Activity, color: "text-warning border-warning/40 bg-warning/10" },
  { id: "stats", label: "📊 Data & Statistiques", icon: BarChart2, color: "text-info border-info/40 bg-info/10" },
  { id: "tactics", label: "🧠 Analyses Tactiques", icon: Brain, color: "text-purple-400 border-purple-500/40 bg-purple-500/10" },
  { id: "mercato", label: "🔄 Rumeurs Mercato", icon: RefreshCw, color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
];

const LOADING_STEPS = [
  { text: "🌐 Connexion au moteur Google Search...", delay: 0 },
  { text: "📰 Analyse des flux d'actualité (L'Équipe, The Athletic, Sky Sports)...", delay: 600 },
  { text: "📊 Croisement des données statistiques (FBref, Transfermarkt)...", delay: 1400 },
  { text: "💡 Synthèse experte de l'analyste IA...", delay: 2200 },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Charger l'historique depuis le localStorage au montage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("profoot_search_history_v1");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Erreur chargement historique:", e);
    }
  }, []);

  // Gestion des étapes de chargement en streaming
  useEffect(() => {
    if (!loading) return;
    setCurrentStepIndex(0);
    const intervals = LOADING_STEPS.map((step, idx) => {
      return setTimeout(() => {
        setCurrentStepIndex(idx);
      }, step.delay);
    });

    return () => intervals.forEach(clearTimeout);
  }, [loading]);

  const handleSearch = async (searchQuery: string, searchFilter: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, filter: searchFilter === "all" ? "" : searchFilter }),
      });

      if (!res.ok) {
        throw new Error("Erreur de communication avec le serveur IA");
      }

      const data: SearchResult = await res.json();
      setResult(data);

      // Sauvegarder dans l'historique
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        query: searchQuery,
        filter: searchFilter,
        timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        result: data,
      };

      const updatedHistory = [newItem, ...history.filter(h => h.query.toLowerCase() !== searchQuery.toLowerCase())].slice(0, 10);
      setHistory(updatedHistory);
      localStorage.setItem("profoot_search_history_v1", JSON.stringify(updatedHistory));

    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la recherche.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query, activeFilter);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setQuery(item.query);
    setActiveFilter(item.filter || "all");
    setResult(item.result);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("profoot_search_history_v1");
  };

  // Fonction de rendu du texte formaté Markdown (sans dépendances externes)
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h3 key={idx} className="text-xl font-black text-white mt-6 mb-3 flex items-center gap-2 border-b border-white/10 pb-2">{line.replace("### ", "")}</h3>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={idx} className="text-2xl font-black text-white mt-8 mb-4">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("- ")) {
        const content = line.replace("- ", "");
        // Formatage du gras **texte**
        const parts = content.split(/(\*\*.*?\*\*)/g);
        return (
          <li key={idx} className="flex items-start gap-2 text-foreground/80 my-2 leading-relaxed ml-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span>
              {parts.map((part, pIdx) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return <strong key={pIdx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </span>
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-3" />;
      }

      // Paragraphe normal avec gestion du gras
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={idx} className="text-foreground/85 leading-relaxed my-2.5">
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={pIdx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#0A1118] text-foreground pb-24 pt-8 px-4 lg:px-8 max-w-7xl mx-auto">
      {/* HEADER HERO */}
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary mb-6 animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-wider">Connexion Web Temps Réel (Mai 2026)</span>
        </div>
        <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Moteur de Recherche <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">Web IA</span>
        </h1>
        <p className="text-base lg:text-lg text-foreground/60 max-w-2xl mx-auto leading-relaxed">
          Interrogez le web en direct sur l'actualité, les blessures de dernière minute, les rumeurs de transfert et les analyses tactiques du football mondial.
        </p>
      </div>

      {/* SEARCH BAR CONTAINER */}
      <div className="max-w-4xl mx-auto mb-12">
        <form onSubmit={onSubmit} className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-emerald-500 to-teal-500 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition duration-500" />
          <div className="relative flex items-center bg-[#111A24] border border-white/10 rounded-3xl shadow-2xl px-4 py-3 lg:py-4 transition-all focus-within:border-primary/50">
            <Search className="w-6 h-6 text-foreground/40 ml-2 mr-4 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Quelles sont les compos et les blessés au Real Madrid pour le prochain match ?"
              className="w-full bg-transparent text-white placeholder-foreground/40 text-base lg:text-lg focus:outline-none pr-4"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-emerald-500 text-[#0A1118] font-black text-sm px-6 py-3 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex-shrink-0"
            >
              <span>Rechercher</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* QUICK FILTERS */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
          {QUICK_FILTERS.map((f) => {
            const active = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  active 
                    ? `${f.color} shadow-lg scale-105` 
                    : "border-border-card bg-card/40 text-foreground/60 hover:bg-card/80 hover:text-white"
                }`}
              >
                <f.icon className="w-3.5 h-3.5" />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT AREA: RESULTS & HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        
        {/* LEFT/CENTER: SEARCH RESULTS (2 COLS) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* LOADING STATE (STREAMING STEPS) */}
          {loading && (
            <div className="bg-[#111A24] border border-border-card rounded-3xl p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-teal-500 animate-pulse" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary animate-spin">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Recherche Web en cours...</h3>
                  <p className="text-xs text-foreground/50">Exploration des bases de données en temps réel (Mai 2026)</p>
                </div>
              </div>

              {/* STEPS */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                {LOADING_STEPS.map((step, idx) => {
                  const active = idx === currentStepIndex;
                  const done = idx < currentStepIndex;
                  return (
                    <div key={idx} className={`flex items-center gap-3 transition-all duration-500 ${active ? "text-primary scale-[1.01]" : done ? "text-foreground/40" : "text-foreground/20"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${active ? "bg-primary text-[#0A1118] shadow-lg shadow-primary/30 animate-pulse" : done ? "bg-card border border-border-card text-foreground/40" : "bg-card/50 border border-border-card text-foreground/20"}`}>
                        {done ? "✓" : idx + 1}
                      </div>
                      <span className={`text-sm font-semibold ${active ? "text-white font-bold" : ""}`}>{step.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {error && !loading && (
            <div className="bg-danger/10 border border-danger/30 rounded-3xl p-6 flex items-start gap-4 text-danger">
              <ShieldAlert className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-lg mb-1">Erreur de la recherche</h4>
                <p className="text-sm text-danger/80">{error}</p>
              </div>
            </div>
          )}

          {/* EMPTY STATE / INITIAL PROMPT */}
          {!result && !loading && !error && (
            <div className="bg-[#111A24]/60 border border-border-card rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
              <div className="w-16 h-16 rounded-3xl bg-card border border-border-card flex items-center justify-center text-foreground/40 mb-6 shadow-inner">
                <Globe className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Aucune recherche active</h3>
              <p className="text-sm text-foreground/50 max-w-md mx-auto mb-8 leading-relaxed">
                Utilisez la barre de recherche ci-dessus ou sélectionnez l'un de nos filtres pour interroger les bases de données mondiales du football.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg text-left">
                <button onClick={() => handleSearch("Quelles sont les dernières rumeurs de transfert au PSG ?", "mercato")} className="p-4 rounded-2xl bg-card/50 border border-border-card hover:border-primary/40 hover:bg-card transition-all group flex items-start gap-3">
                  <Flame className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors mb-1">Mercato PSG</p>
                    <p className="text-[11px] text-foreground/50 line-clamp-1">Dernières rumeurs de transfert</p>
                  </div>
                </button>
                <button onClick={() => handleSearch("Liste des blessés au Real Madrid et Manchester City", "injuries")} className="p-4 rounded-2xl bg-card/50 border border-border-card hover:border-primary/40 hover:bg-card transition-all group flex items-start gap-3">
                  <Activity className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors mb-1">Point Infirmerie</p>
                    <p className="text-[11px] text-foreground/50 line-clamp-1">Blessés Real Madrid & City</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* SEARCH RESULT DISPLAY */}
          {result && !loading && (
            <div className="space-y-8 animate-fade-in">
              
              {/* ANSWER CARD */}
              <div className="bg-[#111A24] border border-border-card rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-primary via-emerald-500 to-teal-500" />
                
                <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-white">Synthèse de l'IA (Web Grounded)</h3>
                      <p className="text-xs text-foreground/50 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>Généré en direct le {result.timestamp ? new Date(result.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Mai 2026"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl text-primary text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Sources Vérifiées</span>
                  </div>
                </div>

                {/* ANSWER CONTENT */}
                <div className="text-base leading-relaxed space-y-4 text-foreground/90">
                  {renderFormattedText(result.answer)}
                </div>
              </div>

              {/* WEB SOURCES SECTION */}
              {result.sources && result.sources.length > 0 && (
                <div className="bg-[#111A24] border border-border-card rounded-3xl p-6 lg:p-8 shadow-xl">
                  <h4 className="font-black text-base text-white mb-6 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    <span>Sources Web & Citations (Mai 2026)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {result.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-card/50 border border-border-card hover:border-primary/50 rounded-2xl p-4 flex flex-col justify-between transition-all group hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-white/5 rounded-lg text-foreground/60 group-hover:text-primary transition-colors truncate max-w-[120px]">
                              {src.domain || "web"}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>
                          <h5 className="font-bold text-sm text-white group-hover:text-primary transition-colors mb-2 line-clamp-2 leading-snug">
                            {src.title}
                          </h5>
                          <p className="text-xs text-foreground/60 line-clamp-3 leading-relaxed">
                            {src.snippet}
                          </p>
                        </div>
                        <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Consulter l'article</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* RELATED QUESTIONS */}
              {result.relatedQuestions && result.relatedQuestions.length > 0 && (
                <div className="bg-[#111A24] border border-border-card rounded-3xl p-6 lg:p-8 shadow-xl">
                  <h4 className="font-black text-base text-white mb-6 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-info" />
                    <span>Questions Connexes & Approfondissement</span>
                  </h4>
                  <div className="space-y-3">
                    {result.relatedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSearch(q, activeFilter)}
                        className="w-full bg-card/40 border border-border-card hover:border-info/40 rounded-2xl p-4 flex items-center justify-between text-left transition-all group hover:bg-card hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 pr-4">
                          <div className="w-8 h-8 rounded-xl bg-info/10 text-info flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Search className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-foreground/80 group-hover:text-white transition-colors">{q}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-foreground/30 group-hover:text-info group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* RIGHT: SEARCH HISTORY & RECENT SEARCHES (1 COL) */}
        <div className="space-y-8">
          <div className="bg-[#111A24] border border-border-card rounded-3xl p-6 lg:p-8 shadow-xl sticky top-24">
            <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-primary" />
                <h4 className="font-black text-base text-white">Recherches Récentes</h4>
              </div>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs font-bold text-foreground/40 hover:text-danger transition-colors"
                >
                  Eff:acer
                </button>
              )}
            </div>

            {/* HISTORY LIST */}
            {history.length === 0 ? (
              <div className="text-center py-12 text-foreground/40 space-y-3">
                <Search className="w-8 h-8 mx-auto opacity-20" />
                <p className="text-sm font-semibold">Aucun historique de recherche</p>
                <p className="text-xs text-foreground/30">Vos recherches récentes apparaîtront ici pour y accéder rapidement.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectHistory(item)}
                    className="w-full bg-card/40 border border-border-card hover:border-primary/40 rounded-2xl p-3.5 flex items-start gap-3 text-left transition-all group hover:bg-card"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate mb-1">
                        {item.query}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-foreground/50">
                        {item.filter && item.filter !== "all" && (
                          <span className="px-1.5 py-0.5 rounded bg-white/5 uppercase tracking-wider font-bold">
                            {item.filter}
                          </span>
                        )}
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
