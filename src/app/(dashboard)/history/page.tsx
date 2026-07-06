"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  History, 
  Search, 
  Filter, 
  Trash2, 
  RefreshCw, 
  ChevronRight, 
  Brain, 
  Calendar, 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  X, 
  ExternalLink, 
  Eye, 
  Target,
  Clock,
  AlertCircle,
  User,
  LogOut,
  Settings,
  Lock,
  CreditCard
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { logout } from "@/app/login/actions";

interface HistoryItem {
  id: string;
  team1: any;
  team2: any;
  date: string;
  isFinished: boolean;
  competition: string;
  type: string;
  score: string;
  confidence: number;
  summary: string;
  winProb?: number;
  drawProb?: number;
  loseProb?: number;
  data?: any;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterComp, setFilterComp] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1. Charger le profil utilisateur
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserProfile(user);
      } catch (e) {
        console.error(e);
      }

      // 2. Check Pro Status
      try {
        const res = await fetch('/api/payments/moneroo/status');
        const data = await res.json();
        setIsPro(data.isPro);
      } catch { /* ignore */ }

      // 3. Charger l'historique depuis Supabase (priorité) puis localStorage (fallback)
      try {
        const res = await fetch('/api/history');
        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            // Transformer le format Supabase vers le format de l'interface
            const mapped: HistoryItem[] = data.history.map((item: any) => ({
              id: item.id,
              team1: { id: item.team1_id, name: item.team1_name, logo: item.team1_logo, league: item.team1_league },
              team2: { id: item.team2_id, name: item.team2_name, logo: item.team2_logo, league: item.team2_league },
              date: item.created_at,
              isFinished: item.is_finished,
              competition: item.competition,
              type: item.is_finished ? 'Résultat passé' : 'Prédiction IA',
              score: item.score,
              confidence: item.confidence,
              summary: item.summary,
              winProb: item.win_prob,
              drawProb: item.draw_prob,
              loseProb: item.lose_prob,
              data: item.analysis_data
            }));
            setHistory(mapped);
            console.log(`[HISTORY] ✅ ${mapped.length} analyses chargées depuis Supabase`);
          } else {
            // Fallback localStorage si Supabase vide
            const stored = localStorage.getItem("profoot_user_history_v1");
            if (stored) setHistory(JSON.parse(stored));
          }
        } else {
          // Fallback localStorage si erreur API
          const stored = localStorage.getItem("profoot_user_history_v1");
          if (stored) setHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Erreur chargement historique:", e);
        // Fallback localStorage
        try {
          const stored = localStorage.getItem("profoot_user_history_v1");
          if (stored) setHistory(JSON.parse(stored));
        } catch { /* ignore */ }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    // Supprimer du localStorage
    try { localStorage.setItem("profoot_user_history_v1", JSON.stringify(updated)); } catch { /* ignore */ }
    // Supprimer de Supabase
    try { await fetch(`/api/history?id=${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
  };

  const handleClearAll = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer tout votre historique d'analyses ?")) {
      setHistory([]);
      // Vider localStorage
      try { localStorage.removeItem("profoot_user_history_v1"); } catch { /* ignore */ }
      // Vider Supabase
      try { await fetch('/api/history?all=true', { method: 'DELETE' }); } catch { /* ignore */ }
    }
  };

  // Formatage de la date
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;

      if (diffDays === 0) return `Aujourd'hui — ${timeStr}`;
      if (diffDays === 1) return `Hier — ${timeStr}`;
      if (diffDays === 2) return `Il y a 2 jours`;

      const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} — ${timeStr}`;
    } catch {
      return "Date inconnue";
    }
  };

  // Filtrage et recherche
  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.team1?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.team2?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.competition?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesComp = filterComp === "all" || item.competition === filterComp;
    const matchesType = filterType === "all" || 
      (filterType === "future" && !item.isFinished) ||
      (filterType === "past" && item.isFinished);

    return matchesSearch && matchesComp && matchesType;
  });

  // Liste unique des compétitions pour le filtre
  const competitionsList = Array.from(new Set(history.map(h => h.competition))).filter(Boolean);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Chargement de l'historique...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 px-4 md:px-0 animate-fade-in h-full">
      
      {/* =========================================
          📱 MOBILE APP EXPERIENCE (PROFILE VIEW)
          ========================================= */}
      <div className="block lg:hidden space-y-6 pt-6">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Mon Profil</h1>
        <div className="bg-[#111A24]/80 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-2xl">
           
           <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-6">
              <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#10B981] to-[#059669] text-white flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                 <User className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white capitalize truncate">{userProfile?.email?.split('@')[0].replace('.', ' ') || "Utilisateur"}</h2>
                  {isPro && <span className="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-orange-500/20 shrink-0">Pro</span>}
                </div>
                <p className="text-xs text-white/50 truncate mt-0.5">{userProfile?.email}</p>
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4 mb-6">
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                <span className="text-2xl font-black text-white">{history.length}</span>
                <span className="block text-[10px] text-white/40 uppercase tracking-widest mt-1">Analyses totales</span>
             </div>
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                <span className="text-2xl font-black text-[#10B981]">{history.filter(h => new Date(h.date).toDateString() === new Date().toDateString()).length}</span>
                <span className="block text-[10px] text-white/40 uppercase tracking-widest mt-1">Aujourd'hui</span>
             </div>
           </div>
           
           <div className="space-y-2 mb-6">
             <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                <span className="text-xs text-white/60 font-semibold">Date d'inscription</span>
                <span className="text-xs font-bold text-white">{userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString('fr-FR') : "Inconnue"}</span>
             </div>
             <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                <span className="text-xs text-white/60 font-semibold">Dernière connexion</span>
                <span className="text-xs font-bold text-[#10B981]">{userProfile?.last_sign_in_at ? new Date(userProfile.last_sign_in_at).toLocaleDateString('fr-FR') : "Inconnue"}</span>
             </div>
           </div>

           <div className="space-y-3">
             <Link href="/pricing" className="w-full flex items-center justify-between p-4 bg-orange-500/10 hover:bg-orange-500/20 rounded-[20px] transition-colors border border-orange-500/20 group">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-orange-400">Abonnement Pro</span>
                </div>
                <ChevronRight className="w-4 h-4 text-orange-400/50" />
             </Link>
             
             <Link href="/history/list" className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-[20px] transition-colors border border-white/5 group">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
                  <span className="text-sm font-bold text-white">Historique</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
             </Link>
             

             
             <form action={logout}>
                <button type="submit" className="w-full mt-4 flex items-center justify-center gap-2 p-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-[20px] transition-colors font-bold shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-bold">Déconnexion</span>
                </button>
             </form>
           </div>
        </div>
      </div>

      {/* =========================================
          💻 DESKTOP EXPERIENCE (HISTORY VIEW)
          ========================================= */}
      <div className="hidden lg:block space-y-8 pt-4">
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <History className="w-8 h-8 text-[#10B981]" />
            Historique des analyses
          </h1>
          <p className="text-xs md:text-sm text-white/50 font-medium mt-1">
            Retrouvez l'intégralité de vos analyses tactiques, prédictions IA et historiques de matchs.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="self-start md:self-auto bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Vider l'historique
          </button>
        )}
      </div>

      {/* ==========================================
          CAS 1 — NOUVEL UTILISATEUR (VIDE)
          ========================================== */}
      {history.length === 0 ? (
        <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-8 md:p-16 text-center shadow-2xl flex flex-col items-center justify-center max-w-2xl mx-auto space-y-8 my-12 animate-fade-in">
          
          {/* Illustration moderne AI Football */}
          <div className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-[#10B981]/10 blur-[40px] rounded-full animate-pulse"></div>
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-tr from-[#0D1520] to-[#1A2636] border border-[#10B981]/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <Brain className="w-12 h-12 md:w-16 md:h-16 text-[#10B981] animate-float" />
            </div>
          </div>

          <div className="space-y-3 max-w-md">
            <h3 className="text-xl md:text-2xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Aucune analyse disponible pour le moment.
            </h3>
            <p className="text-xs md:text-sm text-white/50 font-medium leading-relaxed">
              Votre historique personnel est vide. Commencez votre première analyse IA pour débloquer des rapports tactiques et des prédictions ultra-précises.
            </p>
          </div>

          <Link
            href="/analyze"
            className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:brightness-110 active:scale-[0.98] text-black font-black px-8 py-4 rounded-full shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all flex items-center gap-3 text-sm uppercase tracking-widest"
          >
            <Sparkles className="w-5 h-5" />
            Analyser un match
          </Link>
        </div>
      ) : (
        /* ==========================================
            CAS 2 — UTILISATEUR AVEC ANALYSES
            ========================================== */
        <div className="space-y-6">
          
          {/* BARRE DE RECHERCHE ET FILTRES */}
          <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[24px] p-4 shadow-lg flex flex-col md:flex-row items-center gap-4">
            
            {/* Recherche */}
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Rechercher par équipe, compétition, résumé..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-xs font-semibold text-white placeholder:text-white/30 outline-none focus:border-[#10B981]/40 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtre Compétition */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-[#10B981] shrink-0 ml-1" />
              <select
                value={filterComp}
                onChange={(e) => setFilterComp(e.target.value)}
                className="w-full md:w-auto bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs font-semibold text-white outline-none focus:border-[#10B981]/40 transition-colors cursor-pointer"
              >
                <option value="all" className="bg-[#0D1520]">Toutes les compétitions</option>
                {competitionsList.map(c => (
                  <option key={c} value={c} className="bg-[#0D1520]">{c}</option>
                ))}
              </select>
            </div>

            {/* Filtre Type */}
            <div className="w-full md:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full md:w-auto bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs font-semibold text-white outline-none focus:border-[#10B981]/40 transition-colors cursor-pointer"
              >
                <option value="all" className="bg-[#0D1520]">Tous les types</option>
                <option value="future" className="bg-[#0D1520]">Prédictions IA (Futur)</option>
                <option value="past" className="bg-[#0D1520]">Résultats passés (Terminé)</option>
              </select>
            </div>
          </div>

          {/* RÉSULTATS DU FILTRE */}
          {filteredHistory.length === 0 ? (
            <div className="bg-[#111A24]/40 border border-white/5 rounded-[24px] p-12 text-center text-white/50 font-medium text-sm">
              Aucune analyse ne correspond à vos critères de recherche.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredHistory.map((item) => {
                const t1 = item.team1;
                const t2 = item.team2;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 hover:border-[#10B981]/30 rounded-[24px] p-5 flex flex-col justify-between shadow-lg transition-all hover:translate-y-[-2px] cursor-pointer group relative overflow-hidden"
                  >
                    {/* Top bar: Badge + Date + Trash */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        {item.isFinished ? (
                          <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> Résultat passé
                          </span>
                        ) : (
                          <span className="bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Brain className="w-3 h-3" /> Prédiction IA
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-white/40 truncate max-w-[120px]">
                          {item.competition}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-white/40">
                          {formatDate(item.date)}
                        </span>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-white/20 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                          title="Supprimer cette analyse"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Teams & Score/Prediction */}
                    <div className="flex items-center justify-between my-2 py-3 bg-white/5 rounded-2xl px-4 border border-white/5 group-hover:border-white/10 transition-colors">
                      {/* Team 1 */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <img src={t1?.logo} className="w-10 h-10 object-contain drop-shadow" alt="" />
                        <span className="text-xs font-bold text-white text-center truncate w-full">{t1?.name}</span>
                      </div>

                      {/* Score / Center display */}
                      <div className="flex flex-col items-center justify-center px-4 shrink-0">
                        <span className="text-lg md:text-xl font-black text-white tracking-wider" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {item.score}
                        </span>
                        {item.confidence && (
                          <span className="text-[10px] font-extrabold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full mt-1 border border-[#10B981]/20">
                            {item.confidence}% Fiabilité
                          </span>
                        )}
                      </div>

                      {/* Team 2 */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <img src={t2?.logo} className="w-10 h-10 object-contain drop-shadow" alt="" />
                        <span className="text-xs font-bold text-white text-center truncate w-full">{t2?.name}</span>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-white/60 font-medium line-clamp-2 my-3 leading-relaxed">
                      {item.summary}
                    </p>

                    {/* Bottom action bar */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                      <Link 
                        href={`/analyze?t1=${t1?.id}&t2=${t2?.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-bold text-white/50 hover:text-[#10B981] transition-colors flex items-center gap-1.5 py-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Relancer l'analyse
                      </Link>

                      <span className="text-xs font-bold text-[#10B981] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Voir détails <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          MODAL DE DÉTAILS DE L'ANALYSE
          ========================================== */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="bg-[#0D1520] border border-white/10 rounded-[32px] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#111A24]">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-[#10B981]" />
                <div>
                  <h3 className="text-base font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Rapport d'Analyse IA
                  </h3>
                  <span className="text-xs text-white/40 font-medium">{formatDate(selectedItem.date)}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Teams & Score Banner */}
              <div className="bg-gradient-to-r from-[#111A24] to-[#1A2636] border border-white/5 rounded-2xl p-6 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-4 flex-1">
                  <img src={selectedItem.team1?.logo} className="w-14 h-14 object-contain drop-shadow" alt="" />
                  <div>
                    <h4 className="text-sm md:text-base font-bold text-white">{selectedItem.team1?.name}</h4>
                    <span className="text-[10px] text-white/40 uppercase font-semibold">{selectedItem.team1?.league}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center px-6 shrink-0">
                  <span className="text-2xl md:text-3xl font-black text-white tracking-wider" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {selectedItem.score}
                  </span>
                  <span className="text-xs font-black text-[#10B981] mt-1">
                    {selectedItem.isFinished ? "Score Final" : "Score Prédit"}
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-1 justify-end">
                  <div className="text-right">
                    <h4 className="text-sm md:text-base font-bold text-white">{selectedItem.team2?.name}</h4>
                    <span className="text-[10px] text-white/40 uppercase font-semibold">{selectedItem.team2?.league}</span>
                  </div>
                  <img src={selectedItem.team2?.logo} className="w-14 h-14 object-contain drop-shadow" alt="" />
                </div>
              </div>

              {/* Confidence & Probabilities (if future) */}
              {!selectedItem.isFinished && selectedItem.data?.winProb && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">Victoire {selectedItem.team1?.name}</span>
                    <span className="text-xl font-black text-[#10B981]">{selectedItem.data.winProb}%</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">Match Nul</span>
                    <span className="text-xl font-black text-yellow-400">{selectedItem.data.drawProb}%</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">Victoire {selectedItem.team2?.name}</span>
                    <span className="text-xl font-black text-red-400">{selectedItem.data.loseProb}%</span>
                  </div>
                </div>
              )}

              {/* Summary Section */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#10B981]" /> Résumé Tactique
                </h4>
                <p className="text-sm text-white/80 font-medium leading-relaxed">
                  {selectedItem.summary}
                </p>
              </div>

              {/* Advanced Sections from AI data if available */}
              {selectedItem.data?.sections && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white/40 uppercase tracking-widest">Points Clés de l'Analyse</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedItem.data.sections.map((sec: any, idx: number) => (
                      <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2">
                        <h5 className="text-xs font-bold text-[#10B981] flex items-center gap-2">
                          <Brain className="w-4 h-4" /> {sec.title}
                        </h5>
                        <p className="text-xs text-white/70 leading-relaxed">{sec.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real Match Stats if finished */}
              {selectedItem.isFinished && selectedItem.data?.stats && (
                <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-black text-white/40 uppercase tracking-widest text-center">Statistiques du Match</h4>
                  <div className="space-y-3 max-w-md mx-auto">
                    {[
                      { label: "Possession", val1: `${selectedItem.data.stats.possession?.team1}%`, val2: `${selectedItem.data.stats.possession?.team2}%` },
                      { label: "Tirs (Cadrés)", val1: `${selectedItem.data.stats.shots?.team1} (${selectedItem.data.stats.shotsOnTarget?.team1})`, val2: `${selectedItem.data.stats.shots?.team2} (${selectedItem.data.stats.shotsOnTarget?.team2})` },
                      { label: "Passes", val1: selectedItem.data.stats.passes?.team1, val2: selectedItem.data.stats.passes?.team2 },
                      { label: "Corners", val1: selectedItem.data.stats.corners?.team1, val2: selectedItem.data.stats.corners?.team2 },
                    ].map((st, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-white w-20 text-left">{st.val1}</span>
                        <span className="text-white/40 text-center flex-1">{st.label}</span>
                        <span className="text-white w-20 text-right">{st.val2}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-[#111A24]">
              <Link
                href={`/analyze?t1=${selectedItem.team1?.id}&t2=${selectedItem.team2?.id}`}
                className="bg-[#10B981] hover:bg-[#059669] text-black font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Relancer l'analyse
              </Link>

              <button
                onClick={() => setSelectedItem(null)}
                className="bg-white/5 hover:bg-white/10 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

    </div>
  );
}
