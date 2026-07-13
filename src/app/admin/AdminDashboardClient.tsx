"use client";

import { useState } from "react";
import {
  Users, Brain, TrendingUp, Crown, UserCheck, Activity,
  ExternalLink, Calendar, ArrowUpRight, Star, Shield,
  BarChart2, Clock, Zap
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
  }[];
  analysisChart: { label: string; count: number }[];
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
  const premiumRate = data.totalUsers > 0 ? Math.round((data.premiumUsers / data.totalUsers) * 100) : 0;
  const maxChart = Math.max(...data.analysisChart.map(d => d.count), 1);

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 md:px-10 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              ProFoot AI — Admin
            </h1>
            <p className="text-xs text-gray-400 font-medium">{adminEmail}</p>
          </div>
        </div>
        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors px-4 py-2 rounded-lg"
        >
          Analytics Vercel
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            label="Inscrits total"
            value={data.totalUsers.toLocaleString("fr-FR")}
            icon={Users}
            color="indigo"
            sub={`+${data.newUsersToday} aujourd'hui`}
          />
          <KPICard
            label="Membres Premium"
            value={data.premiumUsers.toString()}
            icon={Crown}
            color="amber"
            sub={`${premiumRate}% du total`}
          />
          <KPICard
            label="Membres Gratuits"
            value={data.freeUsers.toString()}
            icon={UserCheck}
            color="emerald"
            sub="Sans abonnement"
          />
          <KPICard
            label="Analyses totales"
            value={data.totalAnalyses.toLocaleString("fr-FR")}
            icon={Brain}
            color="violet"
            sub="Depuis le début"
          />
          <KPICard
            label="Analyses du jour"
            value={data.analysesToday.toString()}
            icon={Zap}
            color="sky"
            sub="Aujourd'hui"
          />
          <KPICard
            label="Taux conversion"
            value={`${premiumRate}%`}
            icon={TrendingUp}
            color="rose"
            sub="Gratuit → Premium"
          />
        </div>

        {/* Chart + Recent Analyses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Bar chart analyses 7 jours */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-500" />
                Analyses — 7 derniers jours
              </h2>
              <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                Total: {data.analysisChart.reduce((s, d) => s + d.count, 0)}
              </span>
            </div>
            <div className="flex items-end gap-2 h-36">
              {data.analysisChart.map((d, i) => {
                const h = maxChart > 0 ? Math.max((d.count / maxChart) * 100, 4) : 4;
                const isToday = i === data.analysisChart.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {d.count > 0 && (
                      <span className="absolute -top-6 text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.count}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-lg transition-all ${isToday ? "bg-indigo-500" : "bg-indigo-200 group-hover:bg-indigo-400"}`}
                      style={{ height: `${h}%` }}
                    />
                    <span className={`text-[9px] font-semibold text-center ${isToday ? "text-indigo-600" : "text-gray-400"}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {data.totalAnalyses === 0 && (
              <p className="text-center text-sm text-gray-400 mt-4">Aucune analyse encore effectuée.</p>
            )}
          </div>

          {/* Dernières analyses */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-violet-500" />
              Dernières analyses effectuées
            </h2>
            {data.recentAnalyses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Brain className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Aucune analyse pour l'instant.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.recentAnalyses.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 hover:bg-indigo-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {a.team1} <span className="text-gray-400 font-normal">vs</span> {a.team2}
                        </p>
                        <p className="text-[10px] text-gray-400">{formatDate(a.createdAt)}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[80px]">
                      {a.userId.slice(0, 8)}…
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table utilisateurs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Derniers inscrits
            </h2>
            <span className="text-xs text-gray-400 font-semibold bg-gray-100 px-3 py-1 rounded-full">
              {data.totalUsers} au total
            </span>
          </div>
          {data.recentUsers.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Aucun utilisateur inscrit pour l'instant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Inscription</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Dernière connexion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.recentUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs font-mono">{u.email}</td>
                      <td className="px-6 py-4">
                        {u.isPro ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                            <Crown className="w-3 h-3" /> Premium
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                            <UserCheck className="w-3 h-3" /> Gratuit
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {formatDate(u.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {timeAgo(u.lastSignIn)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Supabase Link */}
        <div className="flex flex-wrap gap-4 justify-center pb-4">
          <a
            href="https://supabase.com/dashboard/project/rhxagubyuidautkejbfm/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition px-5 py-2.5 rounded-xl shadow"
          >
            <ArrowUpRight className="w-4 h-4" />
            Gérer les utilisateurs sur Supabase
          </a>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold text-white bg-black hover:bg-gray-800 transition px-5 py-2.5 rounded-xl shadow"
          >
            <ExternalLink className="w-4 h-4" />
            Analytics de trafic — Vercel
          </a>
        </div>

      </div>
    </div>
  );
}

function KPICard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string; icon: any; color: string; sub: string;
}) {
  const colors: Record<string, { bg: string; icon: string; text: string }> = {
    indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", text: "text-indigo-700" },
    amber:  { bg: "bg-amber-50",  icon: "text-amber-600",  text: "text-amber-700" },
    emerald:{ bg: "bg-emerald-50",icon: "text-emerald-600",text: "text-emerald-700" },
    violet: { bg: "bg-violet-50", icon: "text-violet-600", text: "text-violet-700" },
    sky:    { bg: "bg-sky-50",    icon: "text-sky-600",    text: "text-sky-700" },
    rose:   { bg: "bg-rose-50",   icon: "text-rose-600",   text: "text-rose-700" },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <p className="text-2xl font-black text-gray-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {value}
      </p>
      <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">{label}</p>
      <p className="text-[10px] text-gray-400 mt-1 font-medium">{sub}</p>
    </div>
  );
}
