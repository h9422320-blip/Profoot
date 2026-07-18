"use client";

import { useEffect, useState } from "react";
import { History, Brain, Clock, Trash2, ChevronLeft, Sparkles, Filter, Search, X, ChevronRight, RefreshCw, Lock, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MobileHistoryListPage() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const saved = localStorage.getItem("profoot_user_history_v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          // Trier du plus récent au plus ancien
          parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setHistory(parsed);
          setFilteredHistory(parsed);
        }
      } catch (error) {
        console.error("Erreur de lecture historique", error);
      }

      // Check Pro Status
      try {
        const res = await fetch('/api/payments/moneroo/status');
        const data = await res.json();
        setIsPro(data.isPro);
      } catch { /* ignore */ }
    };
    init();
  }, []);

  useEffect(() => {
    let result = history;

    if (filterType === "future") result = result.filter(h => !h.isFinished);
    if (filterType === "past") result = result.filter(h => h.isFinished);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(h => 
        h.team1?.name?.toLowerCase().includes(query) ||
        h.team2?.name?.toLowerCase().includes(query) ||
        h.competition?.toLowerCase().includes(query) ||
        h.summary?.toLowerCase().includes(query)
      );
    }

    setFilteredHistory(result);
  }, [searchQuery, filterType, history]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Supprimer cette analyse définitivement ?")) {
      const newHistory = history.filter(h => h.id !== id);
      setHistory(newHistory);
      localStorage.setItem("profoot_user_history_v1", JSON.stringify(newHistory));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="lg:hidden flex flex-col min-h-screen pb-24">
      {/* HEADER MOBILE */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/5 transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Mon Historique
          </h1>
          <p className="text-[10px] text-white/50 font-medium uppercase tracking-widest mt-0.5">
            Toutes mes analyses IA
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-[#111A24]/60 border border-white/5 rounded-[24px] p-8 text-center flex flex-col items-center justify-center space-y-6 mt-8">
          <div className="w-20 h-20 rounded-full bg-[#10B981]/10 flex items-center justify-center border border-[#10B981]/20">
            <History className="w-8 h-8 text-[#10B981]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Aucune analyse</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Vous n'avez pas encore effectué d'analyse. C'est le moment de tester l'IA !
            </p>
          </div>
          <Link href="/analyze" className="bg-[#10B981] text-black font-black text-xs uppercase tracking-widest px-6 py-3 rounded-full flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Analyser un match
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* FILTERS MOBILE */}
          <div className="bg-[#111A24]/60 border border-white/5 rounded-2xl p-3 flex flex-col gap-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Chercher équipe, compétition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white placeholder:text-white/30 outline-none focus:border-[#10B981]/40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-white outline-none focus:border-[#10B981]/40"
              >
                <option value="all" className="bg-[#0D1520]">Tous les types</option>
                <option value="future" className="bg-[#0D1520]">Prédictions IA</option>
                <option value="past" className="bg-[#0D1520]">Résultats passés</option>
              </select>
            </div>
          </div>

          {/* RESULTS */}
          {filteredHistory.length === 0 ? (
            <div className="text-center text-xs font-medium text-white/40 py-8">
              Aucun résultat pour cette recherche.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((item) => {
                const t1 = item.team1;
                const t2 = item.team2;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="bg-gradient-to-b from-[#111A24] to-[#0A1118] border border-white/5 rounded-2xl p-4 shadow-xl relative overflow-hidden"
                  >
                    {/* Top Bar */}
                    <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-white/5">
                      <div className="flex flex-col gap-1">
                        {item.isFinished ? (
                          <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Terminé
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#10B981] font-black uppercase tracking-widest flex items-center gap-1">
                            <Brain className="w-3 h-3" /> Prédiction IA
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-white/60 truncate max-w-[150px]">
                          {item.competition}
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-semibold text-white/40">{formatDate(item.date)}</span>
                        <button onClick={(e) => handleDelete(item.id, e)} className="text-red-400/50 hover:text-red-400 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Score */}
                    <div className="flex items-center justify-between mb-4 px-2 relative">
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <img src={t1?.logo} className="w-8 h-8 object-contain" alt="" />
                        <span className="text-[10px] font-bold text-white text-center line-clamp-1">{t1?.name}</span>
                      </div>

                      <div className={`flex flex-col items-center shrink-0 px-4 ${!isPro ? 'blur-md select-none' : ''}`}>
                        <span className="text-xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {item.score}
                        </span>
                        {item.confidence && (
                          <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full mt-1">
                            {item.confidence}% Fiable
                          </span>
                        )}
                      </div>
                      {!isPro && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <Lock className="w-5 h-5 text-white/60" />
                        </div>
                      )}

                      <div className="flex flex-col items-center gap-2 flex-1">
                        <img src={t2?.logo} className="w-8 h-8 object-contain" alt="" />
                        <span className="text-[10px] font-bold text-white text-center line-clamp-1">{t2?.name}</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between mt-2">
                      <span className={`text-[10px] text-white/50 font-medium line-clamp-1 flex-1 pr-4 ${!isPro ? 'blur-sm select-none' : ''}`}>
                        {item.summary}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#10B981] shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL DETAIL - MOBILE OPTIMIZED */}
      {selectedItem && (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex flex-col animate-fade-in">
          {/* Mobile Modal Header */}
          <div className="flex items-center justify-between p-4 bg-[#0D1520] border-b border-white/5 shrink-0 pt-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedItem(null)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center">
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <h3 className="text-sm font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Détail de l'Analyse</h3>
            </div>
            <Brain className="w-5 h-5 text-[#10B981]" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
            
            {/* PREMIUM LOCK OVERLAY for free users */}
            {!isPro && (
              <div className="absolute inset-0 z-30 bg-[#0D1520]/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-orange-400" />
                </div>
                <h3 className="text-base font-black text-white text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Contenu Premium</h3>
                <p className="text-[11px] text-white/50 text-center">Passez à Premium pour voir les détails complets.</p>
                <Link href="/pricing" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-black font-black px-6 py-2.5 rounded-full text-[11px] uppercase tracking-widest flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Devenir Premium
                </Link>
              </div>
            )}

            {/* Score Banner Mobile */}
            <div className="bg-[#111A24] rounded-2xl p-4 border border-white/5">
              <div className="flex justify-between items-center text-center">
                <div className="flex flex-col items-center gap-2 w-[35%]">
                  <img src={selectedItem.team1?.logo} className="w-12 h-12 object-contain" alt="" />
                  <span className="text-xs font-bold text-white line-clamp-2">{selectedItem.team1?.name}</span>
                </div>
                <div className={`flex flex-col items-center justify-center w-[30%] ${!isPro ? 'blur-lg select-none' : ''}`}>
                  <span className="text-2xl font-black text-white">{selectedItem.score}</span>
                  <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-wider mt-1">
                    {selectedItem.isFinished ? "Final" : "Prédit"}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2 w-[35%]">
                  <img src={selectedItem.team2?.logo} className="w-12 h-12 object-contain" alt="" />
                  <span className="text-xs font-bold text-white line-clamp-2">{selectedItem.team2?.name}</span>
                </div>
              </div>
            </div>

            {/* Confidence Mobile */}
            {!selectedItem.isFinished && selectedItem.data?.winProb && (
              <div className={`flex justify-between gap-2 ${!isPro ? 'blur-lg select-none' : ''}`}>
                <div className="flex-1 bg-white/5 rounded-xl p-2 text-center border border-white/5">
                  <span className="text-[8px] font-bold text-white/40 block mb-0.5">VICTOIRE T1</span>
                  <span className="text-sm font-black text-[#10B981]">{selectedItem.data.winProb}%</span>
                </div>
                <div className="flex-1 bg-white/5 rounded-xl p-2 text-center border border-white/5">
                  <span className="text-[8px] font-bold text-white/40 block mb-0.5">NUL</span>
                  <span className="text-sm font-black text-yellow-400">{selectedItem.data.drawProb}%</span>
                </div>
                <div className="flex-1 bg-white/5 rounded-xl p-2 text-center border border-white/5">
                  <span className="text-[8px] font-bold text-white/40 block mb-0.5">VICTOIRE T2</span>
                  <span className="text-sm font-black text-red-400">{selectedItem.data.loseProb}%</span>
                </div>
              </div>
            )}

            {/* Summary Mobile */}
            <div className={`bg-white/5 rounded-2xl p-4 border border-white/5 ${!isPro ? 'blur-lg select-none' : ''}`}>
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-[#10B981]" /> Résumé
              </h4>
              <p className="text-xs text-white/80 leading-relaxed font-medium">{selectedItem.summary}</p>
            </div>

            {/* Stats Mobile */}
            {selectedItem.isFinished && selectedItem.data?.stats && (
              <div className={`bg-white/5 rounded-2xl p-4 border border-white/5 ${!isPro ? 'blur-lg select-none' : ''}`}>
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center mb-3">Statistiques</h4>
                <div className="space-y-2">
                  {[
                    { label: "Possession", val1: `${selectedItem.data.stats.possession?.team1}%`, val2: `${selectedItem.data.stats.possession?.team2}%` },
                    { label: "Tirs", val1: selectedItem.data.stats.shots?.team1, val2: selectedItem.data.stats.shots?.team2 },
                    { label: "Cadrés", val1: selectedItem.data.stats.shotsOnTarget?.team1, val2: selectedItem.data.stats.shotsOnTarget?.team2 },
                  ].map((st, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] font-bold">
                      <span className="w-12 text-center text-white">{st.val1}</span>
                      <span className="text-white/40">{st.label}</span>
                      <span className="w-12 text-center text-white">{st.val2}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-white/5 bg-[#0D1520] shrink-0">
            <Link
              href={`/analyze?t1=${selectedItem.team1?.id}&t2=${selectedItem.team2?.id}`}
              className="w-full bg-[#10B981] hover:bg-[#059669] text-black font-black py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <RefreshCw className="w-4 h-4" /> Relancer l'Analyse
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
