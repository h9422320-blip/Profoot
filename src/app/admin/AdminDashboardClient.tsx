"use client";

import { useState, useEffect } from "react";
import {
  Users, Brain, TrendingUp, Crown, UserCheck, Activity,
  ExternalLink, Calendar, ArrowUpRight, Shield,
  BarChart2, Clock, Zap, X, Search, Eye,
  Database, AlertCircle, DollarSign, Target, PieChart
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

export default function AdminDashboardClient({ data, adminEmail }: { data: AdminData; adminEmail: string }) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "finances">("dashboard");
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const premiumRate = data.totalUsers > 0 ? Math.round((data.premiumUsers / data.totalUsers) * 100) : 0;
  const maxChart = Math.max(...data.analysisChart.map(d => d.count), 1);
  const maxRevChart = Math.max(...data.revenueChart.map(d => d.revenue), 10);

  const filteredUsers = data.recentUsers.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (!mounted) return null; // Avoid hydration mismatch on animations

  return (
    <div className="w-full flex-1 min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-indigo-500/30 overflow-x-hidden font-sans relative">
      
      {/* Background Glows for Premium Look */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Modale Analyse Details */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#111113] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg tracking-tight">{selectedAnalysis.team1} vs {selectedAnalysis.team2}</h3>
                  <p className="text-xs text-slate-400 font-medium">{formatDate(selectedAnalysis.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAnalysis(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
              <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20">
                <span className="text-sm font-medium text-indigo-200">Score Prédit par l'IA</span>
                <span className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">{selectedAnalysis.score}</span>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Résumé Détaillé</h4>
                <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-5 rounded-xl border border-white/5">
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
      <div className="sticky top-0 z-40 bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/5 px-6 lg:px-10 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 group cursor-default">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
              <div className="w-11 h-11 relative rounded-xl bg-gradient-to-b from-slate-800 to-black border border-white/10 flex items-center justify-center shadow-2xl">
                <Shield className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                ProFoot
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs text-white/70 font-semibold border border-white/5 uppercase tracking-wider">
                  Nexus
                </span>
              </h1>
              <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
                Admin: {adminEmail}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 p-1.5 bg-white/5 rounded-xl border border-white/5 overflow-x-auto hide-scrollbar">
            <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={Activity} label="Vue Globale" />
            <TabButton active={activeTab === "finances"} onClick={() => setActiveTab("finances")} icon={TrendingUp} label="Finances & SaaS" />
            <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={Users} label="Base Utilisateurs" badge={data.totalUsers} />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 lg:p-10 relative z-10">
        
        {/* TAB: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* SaaS Metrics Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricCard 
                title="Revenu Mensuel (MRR)" 
                value={`${data.mrr.toFixed(2)} €`} 
                icon={DollarSign} 
                trend="+12.5%" 
                trendUp={true}
                color="from-emerald-500 to-emerald-600"
                glowColor="rgba(16, 185, 129, 0.4)"
              />
              <MetricCard 
                title="Abonnés Premium" 
                value={data.premiumUsers.toLocaleString("fr-FR")} 
                icon={Crown} 
                trend={`${premiumRate}% Conv.`} 
                trendUp={premiumRate > 5}
                color="from-amber-400 to-orange-500"
                glowColor="rgba(245, 158, 11, 0.4)"
              />
              <MetricCard 
                title="Utilisateurs Actifs (MAU)" 
                value={data.activeUsers30d.toLocaleString("fr-FR")} 
                icon={UserCheck} 
                trend={`${Math.round((data.activeUsers30d/Math.max(data.totalUsers,1))*100)}% Engagement`} 
                trendUp={true}
                color="from-blue-500 to-indigo-500"
                glowColor="rgba(59, 130, 246, 0.4)"
              />
              <MetricCard 
                title="Requêtes IA Totales" 
                value={data.totalAnalyses.toLocaleString("fr-FR")} 
                icon={Brain} 
                trend={`Coût: ${data.totalAnalysesCost.toFixed(2)}€`} 
                trendUp={false}
                color="from-violet-500 to-purple-600"
                glowColor="rgba(139, 92, 246, 0.4)"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Chart */}
              <div className="lg:col-span-2 bg-[#111113] rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-700" />
                
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Activité de l'Intelligence Artificielle</h2>
                    <p className="text-sm text-slate-400 mt-1">Volume d'analyses générées sur les 7 derniers jours</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">En direct</span>
                  </div>
                </div>
                
                <div className="flex items-end gap-3 h-56 relative z-10">
                  {data.analysisChart.map((d, i) => {
                    const h = maxChart > 0 ? Math.max((d.count / maxChart) * 100, 4) : 4;
                    const isToday = i === data.analysisChart.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar relative h-full justify-end">
                        <div className="absolute -top-10 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 transform translate-y-2 group-hover/bar:translate-y-0 z-20">
                          <div className="bg-white text-black text-xs font-black px-3 py-1.5 rounded-lg shadow-xl relative">
                            {d.count}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
                          </div>
                        </div>
                        <div className="w-full relative h-full flex items-end">
                          <div
                            className={`w-full rounded-t-lg transition-all duration-700 ease-out relative overflow-hidden ${isToday ? "bg-gradient-to-t from-indigo-600/50 to-indigo-400" : "bg-white/5 group-hover/bar:bg-white/10"}`}
                            style={{ height: `${h}%` }}
                          >
                            {isToday && <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />}
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold tracking-wider uppercase ${isToday ? "text-indigo-400" : "text-slate-500"}`}>
                          {d.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Activity Feed */}
              <div className="bg-[#111113] rounded-2xl border border-white/5 p-6 flex flex-col h-full relative overflow-hidden">
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#111113] to-transparent z-10 pointer-events-none" />
                <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" /> Flux d'Activité Récent
                </h2>
                <div className="space-y-4 flex-1 overflow-auto pr-2 custom-scrollbar relative z-0">
                  {data.recentAnalyses.slice(0, 5).map((a, i) => (
                    <div key={a.id} className="flex gap-4 group/feed items-start" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="relative mt-1">
                        <div className="absolute -inset-1 bg-violet-500/20 rounded-full blur opacity-0 group-hover/feed:opacity-100 transition-opacity" />
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative z-10 group-hover/feed:border-violet-500/50 transition-colors">
                          <Brain className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                        {i !== 4 && <div className="absolute top-8 bottom-[-24px] left-1/2 w-px bg-white/5 -translate-x-1/2" />}
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm text-slate-200 font-medium">Nouvelle analyse générée</p>
                        <p className="text-xs text-slate-400 mt-0.5"><span className="text-indigo-300 font-semibold">{a.team1}</span> vs <span className="text-indigo-300 font-semibold">{a.team2}</span></p>
                        <p className="text-[10px] text-slate-500 mt-1">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {data.recentUsers.slice(0, 2).map((u, i) => (
                    <div key={u.id} className="flex gap-4 group/feed items-start">
                      <div className="relative mt-1">
                        <div className="absolute -inset-1 bg-emerald-500/20 rounded-full blur opacity-0 group-hover/feed:opacity-100 transition-opacity" />
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative z-10 group-hover/feed:border-emerald-500/50 transition-colors">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm text-slate-200 font-medium">Nouvel utilisateur inscrit</p>
                        <p className="text-xs text-emerald-400 mt-0.5 font-semibold capitalize">{u.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{timeAgo(u.createdAt)}</p>
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* MRR Growth Chart */}
              <div className="md:col-span-2 bg-[#111113] rounded-2xl border border-white/5 p-8 relative overflow-hidden group">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-1000" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Croissance des Revenus (MRR)</h2>
                    <p className="text-sm text-slate-400 mt-1">Évolution estimée sur les 6 derniers mois</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-400">+{(data.revenueChart[data.revenueChart.length-1].revenue - data.revenueChart[0].revenue).toFixed(2)}€</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">vs Mois M-6</p>
                  </div>
                </div>
                
                {/* Custom CSS Line/Area Chart */}
                <div className="h-64 flex items-end justify-between relative z-10 mt-10">
                  <div className="absolute inset-x-0 bottom-0 top-0 border-b border-white/5" />
                  <div className="absolute inset-x-0 bottom-1/2 top-0 border-b border-white/5 border-dashed" />
                  <div className="absolute inset-x-0 top-0 border-b border-white/5 border-dashed" />
                  
                  {data.revenueChart.map((d, i) => {
                    const h = maxRevChart > 0 ? Math.max((d.revenue / maxRevChart) * 100, 10) : 10;
                    return (
                      <div key={i} className="flex flex-col items-center gap-4 w-full group/point relative h-full justify-end">
                        <div className="absolute -top-12 opacity-0 group-hover/point:opacity-100 transition-all duration-300 z-30">
                          <div className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.5)] relative whitespace-nowrap">
                            {d.revenue.toFixed(2)} €
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-500 rotate-45" />
                          </div>
                        </div>
                        <div className="w-full relative h-full flex items-end justify-center">
                          {/* Point */}
                          <div 
                            className="absolute z-20 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111113] group-hover/point:scale-150 transition-transform duration-300 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                            style={{ bottom: `calc(${h}% - 6px)` }}
                          />
                          {/* Gradient Area beneath point */}
                          <div 
                            className="w-1/2 bg-gradient-to-t from-emerald-500/20 to-transparent transition-all duration-1000 ease-in-out group-hover/point:from-emerald-500/40"
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
                          {d.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SaaS Metrics List */}
              <div className="bg-[#111113] rounded-2xl border border-white/5 p-6 flex flex-col">
                <h2 className="text-base font-bold text-white mb-6">Indicateurs de Performance</h2>
                <div className="space-y-4 flex-1">
                  <SaasMetricRow label="ARPU (Revenu Moyen/User)" value={`${data.arpu.toFixed(2)} €`} trend="Idéal > 1.5€" icon={Target} color="text-sky-400" />
                  <SaasMetricRow label="Taux de Conversion (Gratuit → Pro)" value={`${premiumRate}%`} trend="Objectif: 5%" icon={TrendingUp} color="text-amber-400" />
                  <SaasMetricRow label="Utilisateurs Actifs (7 Jours)" value={data.activeUsers7d} trend="Sur la plateforme" icon={Activity} color="text-indigo-400" />
                  <SaasMetricRow label="Coût Opérationnel IA" value={`${data.totalAnalysesCost.toFixed(2)} €`} trend={`Pour ${data.totalAnalyses} requêtes`} icon={PieChart} color="text-rose-400" />
                </div>
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <p className="text-xs text-emerald-200 leading-relaxed">
                    <span className="font-bold text-emerald-400">Conseil Stratégique:</span> Ton MRR est de {data.mrr.toFixed(2)}€. Pour passer au niveau supérieur, focalise-toi sur l'acquisition via les réseaux et le SEO pour augmenter le trafic tout en gardant ton taux de conversion.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: USERS */}
        {activeTab === "users" && (
          <div className="bg-[#111113] rounded-2xl border border-white/5 shadow-2xl overflow-hidden animate-in fade-in zoom-in-[0.98] duration-500 flex flex-col h-[75vh]">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Gestion des Utilisateurs</h2>
                <p className="text-sm text-slate-400 mt-1">Contrôle et supervision des comptes inscrits</p>
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-indigo-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Chercher un email ou un nom..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-full sm:w-72 transition-colors"
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#111113] sticky top-0 shadow-[0_1px_0_rgba(255,255,255,0.05)] z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Utilisateur</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Statut / Plan</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Inscription</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Dernière Connexion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-slate-500">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        Aucun utilisateur ne correspond à ta recherche.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group cursor-default">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg ${u.isPro ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-slate-700 to-slate-800'}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200 capitalize tracking-tight">{u.name}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {u.isPro ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                              <Crown className="w-3.5 h-3.5" /> Pro Plan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold">
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
                          <span className="text-slate-400 text-xs bg-white/5 border border-white/5 px-2.5 py-1 rounded-md font-medium">
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

      </div>
    </div>
  );
}

// Composants Réutilisables
function TabButton({ active, onClick, icon: Icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 whitespace-nowrap relative outline-none ${
        active 
          ? "text-white bg-white/10" 
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      }`}
    >
      <Icon className={`w-4 h-4 transition-colors ${active ? "text-indigo-400" : "text-slate-500"}`} />
      {label}
      {badge !== undefined && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${active ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-500"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function MetricCard({ title, value, icon: Icon, trend, trendUp, color, glowColor }: any) {
  return (
    <div className="bg-[#111113] rounded-2xl p-6 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors duration-500">
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity duration-700`} style={{ backgroundColor: glowColor }} />
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} p-[1px]`}>
          <div className="w-full h-full bg-[#111113] rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${trendUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <h3 className="text-3xl font-black text-white tracking-tight mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</h3>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{title}</p>
      </div>
    </div>
  );
}

function SaasMetricRow({ label, value, trend, icon: Icon, color }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-black/50 border border-white/5 flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{trend}</p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-base font-bold text-white">{value}</span>
      </div>
    </div>
  );
}
