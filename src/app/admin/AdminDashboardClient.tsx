"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Users, Brain, TrendingUp, Crown, UserCheck, Activity,
  Calendar, ArrowUpRight, Shield, BarChart2, Clock, Zap, X, Search,
  Database, AlertCircle, DollarSign, Target, PieChart, Filter, ChevronDown, Repeat, Star
} from "lucide-react";

interface AdminData {
  totalUsers: number;
  newUsersToday: number;
  premiumUsers: number;
  freeUsers: number;
  totalAnalyses: number;
  analysesToday: number;
  mrr: number;
  arpu: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalAnalysesCost: number;
  recentUsers: {
    id: string;
    email: string;
    name: string;
    isPro: boolean;
    createdAt: string;
    lastSignIn: string | null;
  }[];
  recentAnalyses: {
    id: string;
    team1: string;
    team2: string;
    createdAt: string;
    userId: string;
    score: string;
    summary: string;
  }[];
  analysisChart: { label: string; count: number }[];
  revenueChart: { label: string; revenue: number }[];
  error: string | null;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Jamais";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DateFilter = "all" | "today" | "7d" | "30d";

export default function AdminDashboardClient({ data, adminEmail }: { data: AdminData; adminEmail: string }) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "finances" | "tools">("dashboard");
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filtrage des données côté client selon le filtre de date
  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoff = new Date(0);
    
    if (dateFilter === "today") {
      cutoff = new Date(now);
      cutoff.setHours(0, 0, 0, 0);
    } else if (dateFilter === "7d") {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === "30d") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filteredUsers = data.recentUsers.filter(u => new Date(u.createdAt) >= cutoff);
    const filteredAnalyses = data.recentAnalyses.filter(a => new Date(a.createdAt) >= cutoff);

    const fPremiumUsers = filteredUsers.filter(u => u.isPro).length;
    const fTotalUsers = filteredUsers.length;
    const fMrr = fPremiumUsers * 9.99;
    const fArpu = fTotalUsers > 0 ? fMrr / fTotalUsers : 0;
    
    return {
      users: filteredUsers,
      analyses: filteredAnalyses,
      premiumCount: fPremiumUsers,
      totalCount: fTotalUsers,
      mrr: fMrr,
      arpu: fArpu,
      cost: filteredAnalyses.length * 0.02,
      // Retention estimate (users who signed in at least 1 day after creation)
      retainedUsers: filteredUsers.filter(u => {
        if (!u.lastSignIn) return false;
        const created = new Date(u.createdAt).getTime();
        const last = new Date(u.lastSignIn).getTime();
        return (last - created) > (24 * 60 * 60 * 1000);
      }).length
    };
  }, [data, dateFilter]);

  const premiumRate = filteredData.totalCount > 0 ? Math.round((filteredData.premiumCount / filteredData.totalCount) * 100) : 0;
  const retentionRate = filteredData.totalCount > 0 ? Math.round((filteredData.retainedUsers / filteredData.totalCount) * 100) : 0;
  
  const maxChart = Math.max(...data.analysisChart.map(d => d.count), 1);
  const maxRevChart = Math.max(...data.revenueChart.map(d => d.revenue), 10);

  const searchedUsers = filteredData.users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="w-full flex-1 min-h-screen bg-[#060608] text-slate-200 selection:bg-emerald-500/30 overflow-x-hidden font-sans relative">
      
      {/* Background Glows for Premium Look */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Modale Analyse Details */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f0f13] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-white/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg tracking-tight">{selectedAnalysis.team1} vs {selectedAnalysis.team2}</h3>
                  <p className="text-xs text-slate-400 font-medium">{formatDate(selectedAnalysis.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAnalysis(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all active:scale-90">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
              <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <span className="text-sm font-medium text-emerald-200">Score Prédit par l'IA</span>
                <span className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">{selectedAnalysis.score}</span>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" /> Résumé Détaillé
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-5 rounded-xl border border-white/5 shadow-inner">
                  {selectedAnalysis.summary}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bannière d'erreur */}
      {data.error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center gap-3 relative z-50">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm font-medium text-red-200">{data.error}</p>
        </div>
      )}

      {/* Header Premium Glassmorphism */}
      <div className="sticky top-0 z-40 bg-[#060608]/80 backdrop-blur-xl border-b border-white/5 px-4 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-6">
            {/* Logo Officiel ProFoot */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_20px_rgba(16,185,129,0.2)] group-hover:scale-105 group-hover:drop-shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-500 border border-white/10">
                <Image src="/logo.png" alt="ProFoot AI" width={48} height={48} className="w-full h-full object-cover scale-[1.35]" priority />
              </div>
              <div>
                <span className="font-black text-2xl tracking-tight text-white" style={{fontFamily:"'Outfit',sans-serif"}}>
                  PROFOOT <span className="text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">NEXUS</span>
                </span>
                <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
                  Admin Access • {adminEmail}
                </p>
              </div>
            </div>

            <div className="hidden md:block h-8 w-px bg-white/10" />

            {/* Global Date Filter */}
            <div className="relative group">
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="appearance-none bg-white/5 border border-white/10 hover:border-white/20 text-white text-sm font-semibold rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer"
              >
                <option value="all" className="bg-[#0f0f13]">Depuis le début</option>
                <option value="today" className="bg-[#0f0f13]">Aujourd'hui</option>
                <option value="7d" className="bg-[#0f0f13]">7 Derniers Jours</option>
                <option value="30d" className="bg-[#0f0f13]">30 Derniers Jours</option>
              </select>
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          
          {/* Main Navigation */}
          <div className="flex items-center p-1.5 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto hide-scrollbar shadow-inner">
            <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={Activity} label="Vue Globale" />
            <TabButton active={activeTab === "finances"} onClick={() => setActiveTab("finances")} icon={TrendingUp} label="Finances & Croissance" />
            <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={Users} label="Base Utilisateurs" badge={filteredData.totalCount} />
            <TabButton active={activeTab === "tools"} onClick={() => setActiveTab("tools")} icon={Star} label="Outils CEO" />
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 lg:p-8 relative z-10">
        
        {/* TAB: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* SaaS Metrics Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <MetricCard 
                title="Revenu MRR" 
                value={`${filteredData.mrr.toFixed(2)} €`} 
                icon={DollarSign} 
                trend={dateFilter === "all" ? "+12.5% vs last month" : "Période active"} 
                trendUp={true}
                color="from-emerald-500 to-teal-600"
                glowColor="rgba(16, 185, 129, 0.4)"
              />
              <MetricCard 
                title="Abonnés Premium" 
                value={filteredData.premiumCount.toLocaleString("fr-FR")} 
                icon={Crown} 
                trend={`Conversion: ${premiumRate}%`} 
                trendUp={premiumRate > 5}
                color="from-amber-400 to-orange-500"
                glowColor="rgba(245, 158, 11, 0.4)"
              />
              <MetricCard 
                title="Taux de Rétention" 
                value={`${retentionRate}%`} 
                icon={Repeat} 
                trend="Retour après J+1" 
                trendUp={retentionRate > 20}
                color="from-blue-500 to-indigo-500"
                glowColor="rgba(59, 130, 246, 0.4)"
              />
              <MetricCard 
                title="Requêtes IA" 
                value={filteredData.analyses.length.toLocaleString("fr-FR")} 
                icon={Brain} 
                trend={`Coût: ${filteredData.cost.toFixed(2)}€`} 
                trendUp={false}
                color="from-violet-500 to-purple-600"
                glowColor="rgba(139, 92, 246, 0.4)"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Chart */}
              <div className="lg:col-span-2 bg-[#0f0f13] rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
                <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700" />
                
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Activité de l'Intelligence Artificielle</h2>
                    <p className="text-sm text-slate-400 mt-1">Volume d'analyses générées (7 derniers jours)</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Temps Réel</span>
                  </div>
                </div>
                
                <div className="flex items-end gap-3 h-64 relative z-10">
                  {data.analysisChart.map((d, i) => {
                    const h = maxChart > 0 ? Math.max((d.count / maxChart) * 100, 4) : 4;
                    const isToday = i === data.analysisChart.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar relative h-full justify-end">
                        <div className="absolute -top-12 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 transform translate-y-2 group-hover/bar:translate-y-0 z-20">
                          <div className="bg-white text-black text-sm font-black px-4 py-2 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative">
                            {d.count} <span className="font-normal text-xs text-slate-500">analyses</span>
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
                          </div>
                        </div>
                        <div className="w-full relative h-full flex items-end">
                          <div
                            className={`w-full rounded-t-xl transition-all duration-700 ease-out relative overflow-hidden ${isToday ? "bg-gradient-to-t from-emerald-600/50 to-emerald-400 border-t border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "bg-white/5 border-t border-white/10 group-hover/bar:bg-white/10 group-hover/bar:border-white/20"}`}
                            style={{ height: `${h}%` }}
                          >
                            {isToday && <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold tracking-widest uppercase ${isToday ? "text-emerald-400" : "text-slate-500"}`}>
                          {d.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Activity Feed */}
              <div className="bg-[#0f0f13] rounded-2xl border border-white/5 p-6 flex flex-col h-[400px] lg:h-auto relative overflow-hidden group hover:border-white/10 transition-colors">
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0f0f13] to-transparent z-10 pointer-events-none" />
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" /> Flux d'Activité <span className="text-xs font-normal text-slate-500 bg-white/5 px-2 py-1 rounded-md ml-auto">{filteredData.analyses.length + filteredData.users.length} événements</span>
                </h2>
                <div className="space-y-5 flex-1 overflow-auto pr-2 custom-scrollbar relative z-0">
                  {filteredData.analyses.slice(0, 10).map((a, i) => (
                    <div key={a.id} className="flex gap-4 group/feed items-start relative cursor-pointer" onClick={() => setSelectedAnalysis(a)}>
                      <div className="relative mt-1">
                        <div className="absolute -inset-1 bg-indigo-500/20 rounded-full blur opacity-0 group-hover/feed:opacity-100 transition-opacity" />
                        <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center relative z-10 group-hover/feed:bg-indigo-500/20 transition-colors">
                          <Brain className="w-4 h-4 text-indigo-400" />
                        </div>
                        {i !== 9 && <div className="absolute top-9 bottom-[-28px] left-1/2 w-px bg-white/5 -translate-x-1/2 group-hover/feed:bg-indigo-500/30 transition-colors" />}
                      </div>
                      <div className="flex-1 pb-2 group-hover/feed:translate-x-1 transition-transform">
                        <p className="text-sm text-slate-200 font-bold group-hover/feed:text-indigo-300 transition-colors">Analyse IA complétée</p>
                        <p className="text-xs text-slate-400 mt-0.5"><span className="text-white font-semibold">{a.team1}</span> vs <span className="text-white font-semibold">{a.team2}</span></p>
                        <p className="text-[10px] font-bold tracking-wider uppercase text-slate-600 mt-1.5">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {filteredData.users.slice(0, 5).map((u, i) => (
                    <div key={u.id} className="flex gap-4 group/feed items-start relative">
                      <div className="relative mt-1">
                        <div className="absolute -inset-1 bg-amber-500/20 rounded-full blur opacity-0 group-hover/feed:opacity-100 transition-opacity" />
                        <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center relative z-10 group-hover/feed:bg-amber-500/20 transition-colors">
                          {u.isPro ? <Crown className="w-4 h-4 text-amber-400" /> : <UserCheck className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                      <div className="flex-1 pb-2 group-hover/feed:translate-x-1 transition-transform">
                        <p className="text-sm text-slate-200 font-bold">{u.isPro ? "Nouvel Abo Premium 👑" : "Nouvel Inscrit"}</p>
                        <p className="text-xs text-amber-400 mt-0.5 font-semibold capitalize">{u.name}</p>
                        <p className="text-[10px] font-bold tracking-wider uppercase text-slate-600 mt-1.5">{timeAgo(u.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: FINANCES & SAAS */}
        {activeTab === "finances" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* MRR Growth Chart */}
              <div className="md:col-span-2 bg-[#0f0f13] rounded-2xl border border-white/5 p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-1000" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Croissance des Revenus (MRR)</h2>
                    <p className="text-sm text-slate-400 mt-1">Projection basée sur les abonnements actuels</p>
                  </div>
                  <div className="text-right bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                    <p className="text-sm font-black text-emerald-400">+{(data.revenueChart[data.revenueChart.length-1].revenue - data.revenueChart[0].revenue).toFixed(2)}€</p>
                    <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Objectif YTD</p>
                  </div>
                </div>
                
                {/* Custom CSS Line/Area Chart */}
                <div className="h-72 flex items-end justify-between relative z-10 mt-10">
                  <div className="absolute inset-x-0 bottom-0 top-0 border-b border-white/5" />
                  <div className="absolute inset-x-0 bottom-1/3 top-0 border-b border-white/5 border-dashed" />
                  <div className="absolute inset-x-0 bottom-2/3 top-0 border-b border-white/5 border-dashed" />
                  <div className="absolute inset-x-0 top-0 border-b border-white/5 border-dashed" />
                  
                  {data.revenueChart.map((d, i) => {
                    const h = maxRevChart > 0 ? Math.max((d.revenue / maxRevChart) * 100, 10) : 10;
                    return (
                      <div key={i} className="flex flex-col items-center gap-4 w-full group/point relative h-full justify-end">
                        <div className="absolute -top-14 opacity-0 group-hover/point:opacity-100 transition-all duration-300 z-30 transform translate-y-2 group-hover/point:translate-y-0">
                          <div className="bg-emerald-500 text-white text-sm font-black px-4 py-2 rounded-xl shadow-[0_10px_30px_rgba(16,185,129,0.5)] relative whitespace-nowrap">
                            {d.revenue.toFixed(2)} €
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-500 rotate-45" />
                          </div>
                        </div>
                        <div className="w-full relative h-full flex items-end justify-center">
                          {/* Point */}
                          <div 
                            className="absolute z-20 w-4 h-4 rounded-full bg-emerald-400 border-4 border-[#0f0f13] group-hover/point:scale-[1.7] transition-transform duration-300 shadow-[0_0_15px_rgba(52,211,153,0.8)] cursor-pointer"
                            style={{ bottom: `calc(${h}% - 8px)` }}
                          />
                          {/* Gradient Area beneath point */}
                          <div 
                            className="w-[80%] rounded-t-sm bg-gradient-to-t from-emerald-500/20 to-transparent transition-all duration-1000 ease-in-out group-hover/point:from-emerald-500/40"
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 tracking-widest uppercase">
                          {d.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SaaS Metrics List */}
              <div className="bg-[#0f0f13] rounded-2xl border border-white/5 p-6 flex flex-col group hover:border-white/10 transition-colors">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Target className="w-5 h-5 text-sky-400" /> Métriques Clés SaaS
                </h2>
                <div className="space-y-4 flex-1">
                  <SaasMetricRow label="ARPU (Revenu/User)" value={`${filteredData.arpu.toFixed(2)} €`} trend="Calculé sur total inscrits" icon={DollarSign} color="text-sky-400 bg-sky-500/10 border-sky-500/20" />
                  <SaasMetricRow label="Taux de Conversion" value={`${premiumRate}%`} trend="Inscrits → Premium" icon={TrendingUp} color="text-amber-400 bg-amber-500/10 border-amber-500/20" />
                  <SaasMetricRow label="Utilisateurs Actifs" value={filteredData.totalCount > 0 ? `${Math.round(filteredData.analyses.length / filteredData.totalCount)}/u` : '0'} trend="Analyses par utilisateur" icon={Activity} color="text-indigo-400 bg-indigo-500/10 border-indigo-500/20" />
                  <SaasMetricRow label="Marge Opérationnelle" value={`${(filteredData.mrr - filteredData.cost).toFixed(2)} €`} trend="MRR - Coût API IA" icon={PieChart} color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20" />
                </div>
                
                <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-16 bg-indigo-500/20 blur-[50px]" />
                  <p className="text-sm text-indigo-200 leading-relaxed relative z-10">
                    <span className="font-black text-white block mb-1">Stratégie Recommandée :</span> 
                    Votre rétention est de {retentionRate}%. Créez des campagnes d'emailing pour faire revenir les utilisateurs inactifs. Le coût IA ({filteredData.cost.toFixed(2)}€) est très faible par rapport au MRR potentiel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: USERS */}
        {activeTab === "users" && (
          <div className="bg-[#0f0f13] rounded-2xl border border-white/5 shadow-2xl overflow-hidden animate-in fade-in zoom-in-[0.98] duration-500 flex flex-col h-[75vh]">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/[0.02]">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" /> Base Utilisateurs
                </h2>
                <p className="text-sm text-slate-400 mt-1">{filteredData.users.length} comptes trouvés pour la période sélectionnée</p>
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-indigo-500/30 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Rechercher par email ou nom..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:bg-black/80 w-full sm:w-80 transition-all shadow-inner"
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#0a0a0c] sticky top-0 shadow-[0_1px_0_rgba(255,255,255,0.05)] z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Client</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Plan</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Inscription</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Dernière Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {searchedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-24 text-center text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-bold text-slate-400">Aucun utilisateur trouvé</p>
                        <p className="text-sm mt-1">Essaie de modifier les filtres ou la recherche.</p>
                      </td>
                    </tr>
                  ) : (
                    searchedUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.03] transition-colors group cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow-lg border border-white/10 ${u.isPro ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-slate-700 to-slate-800'}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-200 capitalize tracking-tight group-hover:text-white transition-colors">{u.name}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {u.isPro ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                              <Crown className="w-3.5 h-3.5" /> Premium Plan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-semibold">
                              Free Plan
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {formatDate(u.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center text-slate-400 text-xs bg-black/40 border border-white/5 px-3 py-1.5 rounded-lg font-medium shadow-inner">
                            <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                            {timeAgo(u.lastSignIn)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: TOOLS */}
        {activeTab === "tools" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Outils CEO Placeholder */}
            <ToolCard 
              title="Analyse de Cohorte (Bientôt)" 
              desc="Comprenez la rétention de vos utilisateurs mois par mois pour réduire le churn." 
              icon={BarChart2} 
              color="text-indigo-400" 
              bg="bg-indigo-500/10" 
              border="border-indigo-500/20" 
            />
            <ToolCard 
              title="Campagnes Emailing" 
              desc="Envoyez des newsletters ciblées aux utilisateurs gratuits pour les convertir." 
              icon={TrendingUp} 
              color="text-emerald-400" 
              bg="bg-emerald-500/10" 
              border="border-emerald-500/20" 
            />
            <ToolCard 
              title="Logs d'Erreurs IA" 
              desc="Surveillez en temps réel les échecs de génération de l'IA pour améliorer l'outil." 
              icon={AlertCircle} 
              color="text-rose-400" 
              bg="bg-rose-500/10" 
              border="border-rose-500/20" 
            />
          </div>
        )}

      </div>
    </div>
  );
}

// Composants Réutilisables
function TabButton({ active, onClick, icon: Icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap relative outline-none active:scale-95 ${
        active 
          ? "text-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10" 
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
      }`}
    >
      <Icon className={`w-4.5 h-4.5 transition-colors ${active ? "text-emerald-400" : "text-slate-500"}`} />
      {label}
      {badge !== undefined && (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${active ? "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-white/10 text-slate-500"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function MetricCard({ title, value, icon: Icon, trend, trendUp, color, glowColor }: any) {
  return (
    <div className="bg-[#0f0f13] rounded-3xl p-6 md:p-8 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
      <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-[60px] opacity-20 group-hover:opacity-50 transition-opacity duration-700`} style={{ backgroundColor: glowColor }} />
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} p-[1px] shadow-lg group-hover:scale-110 transition-transform duration-500`}>
          <div className="w-full h-full bg-[#0f0f13] rounded-2xl flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        {trend && (
          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border backdrop-blur-sm shadow-sm ${trendUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <h3 className="text-4xl font-black text-white tracking-tighter mb-1.5 drop-shadow-md" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</h3>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
      </div>
    </div>
  );
}

function SaasMetricRow({ label, value, trend, icon: Icon, color }: any) {
  return (
    <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 group cursor-default">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{label}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-semibold">{trend}</p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-lg font-black text-white tracking-tight drop-shadow-sm">{value}</span>
      </div>
    </div>
  );
}

function ToolCard({ title, desc, icon: Icon, color, bg, border }: any) {
  return (
    <div className="bg-[#0f0f13] rounded-3xl p-8 border border-white/5 group hover:border-white/10 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl cursor-pointer relative overflow-hidden">
      <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-[50px] opacity-10 group-hover:opacity-30 transition-opacity duration-700 ${bg}`} />
      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 ${bg} ${border} ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      <div className="mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">
        Découvrir <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
      </div>
    </div>
  );
}
