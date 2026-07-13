"use client";

import { useState } from "react";
import {
  Users, Brain, TrendingUp, Crown, UserCheck, Activity,
  ExternalLink, Calendar, ArrowUpRight, Star, Shield,
  BarChart2, Clock, Zap, X, Search, Filter, Eye, ChevronRight,
  Database, AlertCircle
} from "lucide-react";
import Link from "next/link";

interface AdminData {
  totalUsers: number;
  newUsersToday: number;
  premiumUsers: number;
  freeUsers: number;
  totalAnalyses: number;
  analysesToday: number;
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
    analysisData: any;
  }[];
  analysisChart: { label: string; count: number }[];
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "analyses">("dashboard");
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");

  const premiumRate = data.totalUsers > 0 ? Math.round((data.premiumUsers / data.totalUsers) * 100) : 0;
  const maxChart = Math.max(...data.analysisChart.map(d => d.count), 1);

  const filteredUsers = data.recentUsers.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="w-full flex-1 min-h-screen bg-[#F8FAFC]">
      {/* Modale Analyse Details */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{selectedAnalysis.team1} vs {selectedAnalysis.team2}</h3>
                  <p className="text-xs text-slate-500 font-medium">{formatDate(selectedAnalysis.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAnalysis(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-sm font-semibold text-slate-500">Score Prédit</span>
                <span className="text-2xl font-black text-indigo-600">{selectedAnalysis.score}</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Résumé de l'IA</h4>
                <p className="text-sm text-slate-700 leading-relaxed bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                  {selectedAnalysis.summary}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ID Utilisateur</h4>
                <code className="text-xs text-slate-600 bg-slate-100 px-3 py-2 rounded-lg block font-mono">
                  {selectedAnalysis.userId}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bannière d'erreur */}
      {data.error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-800">{data.error}</p>
        </div>
      )}

      {/* Header Premium */}
      <div className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              ProFoot Command Center
            </h1>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Connecté en tant que {adminEmail}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={Activity} label="Vue d'ensemble" />
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={Users} label="Utilisateurs" badge={data.totalUsers} />
          <TabButton active={activeTab === "analyses"} onClick={() => setActiveTab("analyses")} icon={Database} label="Base Analyses" badge={data.totalAnalyses} />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 lg:p-10">
        
        {/* TAB: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <KPICard label="Total Utilisateurs" value={data.totalUsers.toLocaleString("fr-FR")} icon={Users} color="bg-blue-500" sub={`+${data.newUsersToday} aujourd'hui`} />
              <KPICard label="Abonnés Premium" value={data.premiumUsers.toLocaleString("fr-FR")} icon={Crown} color="bg-amber-500" sub={`${premiumRate}% de conversion`} />
              <KPICard label="Analyses Générées" value={data.totalAnalyses.toLocaleString("fr-FR")} icon={Brain} color="bg-indigo-500" sub={`+${data.analysesToday} aujourd'hui`} />
              <KPICard label="Activité (7 jours)" value={`${data.analysisChart.reduce((a,b)=>a+b.count,0)}`} icon={Activity} color="bg-emerald-500" sub="Analyses récentes" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Volume d'Analyses IA</h2>
                    <p className="text-sm text-slate-500">Activité générée sur les 7 derniers jours</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <BarChart2 className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
                <div className="flex items-end gap-3 h-48">
                  {data.analysisChart.map((d, i) => {
                    const h = maxChart > 0 ? Math.max((d.count / maxChart) * 100, 5) : 5;
                    const isToday = i === data.analysisChart.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <div className="absolute -top-8 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {d.count}
                        </div>
                        <div
                          className={`w-full rounded-t-xl transition-all duration-300 ${isToday ? "bg-indigo-500" : "bg-indigo-100 group-hover:bg-indigo-300"}`}
                          style={{ height: `${h}%` }}
                        />
                        <span className={`text-xs font-medium whitespace-nowrap ${isToday ? "text-indigo-600 font-bold" : "text-slate-400"}`}>
                          {d.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions / Info */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                <h2 className="text-base font-bold text-slate-800 mb-6">Liens Rapides</h2>
                <div className="space-y-3 flex-1">
                  <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
                        <svg viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor"/></svg>
                      </div>
                      <span className="font-semibold text-sm text-slate-700">Vercel Analytics</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </a>
                  <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#3ECF8E]/20 flex items-center justify-center">
                        <Database className="w-4 h-4 text-[#3ECF8E]" />
                      </div>
                      <span className="font-semibold text-sm text-slate-700">Supabase Studio</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: USERS */}
        {activeTab === "users" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in flex flex-col h-[75vh]">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-800">Base Utilisateurs</h2>
                <p className="text-sm text-slate-500">Tous les comptes inscrits sur la plateforme</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Rechercher un email..." 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-64"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white sticky top-0 shadow-[0_1px_0_rgba(226,232,240,1)] z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Utilisateur</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Inscription</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Dernière Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Aucun utilisateur trouvé.</td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors group cursor-default">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.isPro ? 'bg-amber-500' : 'bg-slate-300'}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 capitalize">{u.name}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {u.isPro ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-bold">
                              <Crown className="w-3 h-3" /> Premium
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                              Gratuit
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(u.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-500 text-xs bg-slate-100 px-2 py-1 rounded">
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

        {/* TAB: ANALYSES */}
        {activeTab === "analyses" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in flex flex-col h-[75vh]">
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">Historique des Analyses IA</h2>
              <p className="text-sm text-slate-500">Toutes les analyses générées par les utilisateurs</p>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white sticky top-0 shadow-[0_1px_0_rgba(226,232,240,1)] z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Match Analysé</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Score IA</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentAnalyses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Aucune analyse dans la base de données.</td>
                    </tr>
                  ) : (
                    data.recentAnalyses.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <Brain className="w-4 h-4 text-indigo-500" />
                            </div>
                            <span className="font-bold text-slate-700">{a.team1} vs {a.team2}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                            {a.score}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {formatDate(a.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedAnalysis(a)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-lg transition-colors shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" /> Voir
                          </button>
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
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
        active 
          ? "bg-slate-900 text-white shadow-sm" 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      <Icon className={`w-4 h-4 ${active ? "text-indigo-400" : ""}`} />
      {label}
      {badge !== undefined && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${active ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function KPICard({ label, value, icon: Icon, color, sub }: any) {
  const colorMap: Record<string, string> = {
    "bg-indigo-500": "bg-indigo-50 text-indigo-600",
    "bg-amber-500": "bg-amber-50 text-amber-600",
    "bg-emerald-500": "bg-emerald-50 text-emerald-600",
    "bg-violet-500": "bg-violet-50 text-violet-600",
    "bg-sky-500": "bg-sky-50 text-sky-600",
    "bg-rose-500": "bg-rose-50 text-rose-600",
    "bg-blue-500": "bg-blue-50 text-blue-600",
  };
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={`w-10 h-10 rounded-xl ${colorMap[color] || colorMap["bg-indigo-500"]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</h3>
        <p className="text-[10px] text-slate-500 mt-1 font-semibold">{sub}</p>
      </div>
      {/* Background decoration */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${color} opacity-[0.03] group-hover:scale-150 transition-transform duration-500 ease-out`} />
    </div>
  );
}
