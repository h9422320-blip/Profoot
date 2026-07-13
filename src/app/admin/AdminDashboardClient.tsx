"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Users, Brain, TrendingUp, Crown, UserCheck, Activity,
  AlertCircle, DollarSign, Target, PieChart, ChevronDown,
  Repeat, Star, X, Search, Calendar, Clock, Check,
  ChevronLeft, ChevronRight, Zap, BarChart2, Mail, Wifi,
  ArrowUpRight, ArrowDownRight, Info, Shield, Settings
} from "lucide-react";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface PricingConfig {
  currentPriceCfa: number;
  monthlyPriceCfa: number;
  annualPriceCfa: number;
  isTestMode: boolean;
  costPerAnalysisCfa: number;
}

interface MonthlyStatRow {
  id: string;
  year: number;
  month: number;
  newUsers: number;
  cancelledUsers: number;
  totalPremiumUsers: number;
  totalAnalyses: number;
  marketingBudgetCfa: number;
  notes: string;
  mrr: number;
  churnRate: number;
  cac: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isPro: boolean;
  createdAt: string;
  lastSignIn: string | null;
  phone: string | null;
  provider: string;
  emailConfirmed: boolean;
  country: string | null;
}

interface Analysis {
  id: string;
  team1: string;
  team2: string;
  createdAt: string;
  userId: string;
  score: string;
  summary: string;
  confidence: number;
}

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
  recentUsers: AdminUser[];
  recentAnalyses: Analysis[];
  monthlyStats: MonthlyStatRow[];
  analysisChart: { label: string; count: number }[];
  pricingConfig: PricingConfig;
  error: string | null;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function formatCfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " CFA";
}

// Hook: Count-up animation for numbers
function useCountUp(target: number, duration = 900, active = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) { setCount(target); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, active]);
  return count;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Jamais";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Il y a ${d}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── CALENDAR PICKER COMPONENT ──────────────────────────────────────────────

interface DateRange { start: Date | null; end: Date | null }

function CalendarPicker({ value, onChange, onClose }: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  onClose: () => void;
}) {
  const [viewYear, setViewYear] = useState(value.start?.getFullYear() ?? 2026);
  const [viewMonth, setViewMonth] = useState(value.start?.getMonth() ?? 0);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [hovered, setHovered] = useState<Date | null>(null);

  const startYear = 2026;
  const today = new Date(); today.setHours(23, 59, 59, 999);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (d: Date) => {
    if (selecting === "start") {
      onChange({ start: d, end: null });
      setSelecting("end");
    } else {
      if (value.start && d < value.start) {
        onChange({ start: d, end: value.start });
      } else {
        onChange({ start: value.start, end: d });
      }
      setSelecting("start");
      onClose();
    }
  };

  const isInRange = (d: Date) => {
    const s = value.start;
    const e = value.end || hovered;
    if (!s || !e) return false;
    const [lo, hi] = s <= e ? [s, e] : [e, s];
    return d >= lo && d <= hi;
  };

  const isSelected = (d: Date) =>
    (value.start && d.toDateString() === value.start.toDateString()) ||
    (value.end && d.toDateString() === value.end.toDateString());

  const isDisabled = (d: Date) =>
    d < new Date(startYear, 0, 1) || d > today;

  const days: (Date | null)[] = [];
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon-first
  for (let i = 0; i < offset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(viewYear, viewMonth, i));
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 w-[340px] animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} disabled={viewYear === startYear && viewMonth === 0}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <span className="font-bold text-slate-800 text-sm">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} disabled={viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth())}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Year quick-nav */}
      <div className="flex gap-1 mb-4 overflow-x-auto hide-scrollbar">
        {Array.from({ length: today.getFullYear() - startYear + 1 }, (_, i) => startYear + i).map(y => (
          <button key={y} onClick={() => setViewYear(y)}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${viewYear === y ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {y}
          </button>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const sel = isSelected(d);
          const inRange = isInRange(d);
          const dis = isDisabled(d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => !dis && handleDayClick(d)}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              disabled={dis}
              className={`h-8 w-full flex items-center justify-center text-xs font-semibold rounded-lg transition-all duration-150 ${
                sel ? "bg-emerald-500 text-white shadow-md scale-105" :
                inRange ? "bg-emerald-100 text-emerald-700" :
                dis ? "text-slate-300 cursor-not-allowed" :
                "text-slate-700 hover:bg-slate-100"
              }`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-medium">
          {selecting === "start" ? "Sélectionne la date de début" : "Sélectionne la date de fin"}
        </span>
        <button onClick={() => { onChange({ start: null, end: null }); setSelecting("start"); onClose(); }}
          className="text-[10px] text-slate-400 hover:text-red-500 font-bold transition-colors underline">
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function AdminDashboardClient({ data, adminEmail }: { data: AdminData; adminEmail: string }) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "finances" | "tools">("dashboard");
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [marketingBudget, setMarketingBudget] = useState(1818000); // 5M GNF ≈ 1 818 000 CFA
  const { pricingConfig } = data;

  // ── Date filtering across all data ─────────────────────────────────────
  const filtered = useMemo(() => {
    const lo = dateRange.start ? new Date(dateRange.start).setHours(0, 0, 0, 0) : 0;
    const hi = dateRange.end
      ? new Date(dateRange.end).setHours(23, 59, 59, 999)
      : Date.now();

    const users = data.recentUsers.filter(u => {
      const t = new Date(u.createdAt).getTime();
      return t >= lo && t <= hi;
    });
    const analyses = data.recentAnalyses.filter(a => {
      const t = new Date(a.createdAt).getTime();
      return t >= lo && t <= hi;
    });

    const premiumCount = users.filter(u => u.isPro).length;
    const mrr = premiumCount * pricingConfig.currentPriceCfa;
    const arpu = users.length > 0 ? mrr / users.length : 0;
    const cost = analyses.length * pricingConfig.costPerAnalysisCfa;
    const newUsers = users.length;
    // Retention: utilisateurs qui se sont reconnectés > 24h après inscription
    const retained = users.filter(u => {
      if (!u.lastSignIn) return false;
      return new Date(u.lastSignIn).getTime() - new Date(u.createdAt).getTime() > 86_400_000;
    }).length;
    const retentionRate = newUsers > 0 ? Math.round((retained / newUsers) * 100) : 0;
    // CAC = Budget marketing / Nouveaux utilisateurs de la période
    const cac = newUsers > 0 ? Math.round(marketingBudget / newUsers) : 0;

    return { users, analyses, premiumCount, mrr, arpu, cost, newUsers, retentionRate, cac };
  }, [data, dateRange, marketingBudget, pricingConfig]);

  // Latest monthlyStats row for the current month
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    return data.monthlyStats.find(s => s.year === now.getFullYear() && s.month === now.getMonth() + 1) || null;
  }, [data.monthlyStats]);

  const premiumRate = data.totalUsers > 0 ? ((data.premiumUsers / data.totalUsers) * 100).toFixed(1) : "0";
  const maxChart = Math.max(...data.analysisChart.map(d => d.count), 1);

  const dateRangeLabel = useMemo(() => {
    if (!dateRange.start) return "Toute la période";
    const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    return dateRange.end
      ? `${fmt(dateRange.start)} → ${fmt(dateRange.end)}`
      : `Depuis ${fmt(dateRange.start)}`;
  }, [dateRange]);

  const searchedUsers = filtered.users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="w-full flex-1 min-h-screen bg-slate-50 text-slate-800 font-sans relative overflow-x-hidden">

      {/* Subtle background pattern */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
        backgroundSize: "24px 24px"
      }} />

      {/* Top gradient accent */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500 z-50" />

      {/* ── MODALES ────────────────────────────────────────────────────── */}

      {/* Modale Analyse */}
      {selectedAnalysis && (
        <Modal onClose={() => setSelectedAnalysis(null)}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Brain className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-xl">{selectedAnalysis.team1} vs {selectedAnalysis.team2}</h3>
              <p className="text-sm text-slate-500">{formatDate(selectedAnalysis.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 mb-6">
            <div>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Score Prédit</p>
              <p className="text-4xl font-black text-indigo-700">{selectedAnalysis.score}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Confiance IA</p>
              <p className="text-3xl font-black text-slate-700">{selectedAnalysis.confidence}%</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Résumé de l'Analyse</p>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              {selectedAnalysis.summary}
            </p>
          </div>
        </Modal>
      )}

      {/* Modale Utilisateur */}
      {selectedUser && (
        <Modal onClose={() => setSelectedUser(null)}>
          <div className="flex items-center gap-5 mb-8">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg ${selectedUser.isPro ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-slate-500 to-slate-700"}`}>
              {selectedUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-800 text-xl capitalize">{selectedUser.name}</h3>
                {selectedUser.isPro
                  ? <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold flex items-center gap-1"><Crown className="w-3 h-3" /> Premium</span>
                  : <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">Free</span>
                }
              </div>
              <p className="text-sm text-slate-500 font-mono mt-1">{selectedUser.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <UserInfoRow icon={Mail} label="Email" value={selectedUser.email} />
            <UserInfoRow icon={Shield} label="Fournisseur Auth" value={selectedUser.provider} />
            <UserInfoRow icon={Calendar} label="Inscription" value={formatDate(selectedUser.createdAt)} />
            <UserInfoRow icon={Clock} label="Dernière connexion" value={timeAgo(selectedUser.lastSignIn)} />
            <UserInfoRow icon={Check} label="Email confirmé" value={selectedUser.emailConfirmed ? "✅ Oui" : "❌ Non"} />
            {selectedUser.phone && <UserInfoRow icon={Info} label="Téléphone" value={selectedUser.phone} />}
            {selectedUser.country && <UserInfoRow icon={Info} label="Pays" value={selectedUser.country} />}
          </div>

          {/* Analyses de cet utilisateur */}
          <div className="mt-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Analyses de cet Utilisateur</p>
            <div className="space-y-2 max-h-40 overflow-auto custom-scrollbar">
              {data.recentAnalyses.filter(a => a.userId === selectedUser.id).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Aucune analyse trouvée.</p>
              ) : (
                data.recentAnalyses
                  .filter(a => a.userId === selectedUser.id)
                  .map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                      <span className="font-medium text-slate-700">{a.team1} vs {a.team2}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-indigo-100 text-indigo-600 font-bold px-2 py-0.5 rounded">{a.score}</span>
                        <span className="text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-1 z-40 mx-4 mt-4 mb-6 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-sm px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          {/* Logo + Titre */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-2 border-emerald-500/30 shadow-md">
              <Image src="/logo.png" alt="ProFoot AI" width={48} height={48} className="w-full h-full object-cover scale-[1.35]" priority />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-800" style={{ fontFamily: "'Outfit',sans-serif" }}>
                PROFOOT <span className="text-emerald-500">NEXUS</span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                Tableau de Bord Admin · {adminEmail}
              </p>
            </div>

            {/* Calendar Filter */}
            <div className="hidden md:block ml-4 relative">
              <button
                onClick={() => setShowCalendar(v => !v)}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-xl text-sm font-semibold text-slate-700 transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span className="max-w-[200px] truncate">{dateRangeLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showCalendar ? "rotate-180" : ""}`} />
              </button>
              {showCalendar && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
                  <div className="absolute top-full mt-2 left-0 z-50">
                    <CalendarPicker
                      value={dateRange}
                      onChange={setDateRange}
                      onClose={() => setShowCalendar(false)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center p-1 bg-slate-100 rounded-xl gap-0.5 overflow-x-auto hide-scrollbar">
            <TabBtn active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={Activity} label="Vue Globale" />
            <TabBtn active={activeTab === "finances"} onClick={() => setActiveTab("finances")} icon={TrendingUp} label="Finances & Churn" />
            <TabBtn active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={Users} label="Utilisateurs" badge={filtered.users.length} />
            <TabBtn active={activeTab === "tools"} onClick={() => setActiveTab("tools")} icon={Settings} label="Outils CEO" />
          </nav>
        </div>
      </header>

      {/* ── BANNIÈRE ERREUR ──────────────────────────────────────────────── */}
      {data.error && (
        <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">{data.error}</p>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="px-4 pb-12 max-w-[1800px] mx-auto">

        {/* ════════════════ TAB: DASHBOARD ═══════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">

            {/* KPI Cards Row — staggered entrance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: "MRR (Revenu Mensuel)", rawValue: filtered.mrr, display: formatCfa(filtered.mrr), icon: DollarSign, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", borderAccent: "border-l-emerald-400", trend: `${data.premiumUsers} abonné(s) × ${formatCfa(pricingConfig.currentPriceCfa)}`, positive: true },
                { label: "Abonnés Premium", rawValue: data.premiumUsers, display: String(data.premiumUsers), icon: Crown, iconBg: "bg-amber-100", iconColor: "text-amber-600", borderAccent: "border-l-amber-400", trend: `Conversion : ${premiumRate}% des ${data.totalUsers} inscrits`, positive: parseFloat(premiumRate) > 5 },
                { label: "Utilisateurs Actifs (30j)", rawValue: data.activeUsers30d, display: String(data.activeUsers30d), icon: UserCheck, iconBg: "bg-blue-100", iconColor: "text-blue-600", borderAccent: "border-l-blue-400", trend: `24h: ${data.activeUsers24h} · 7j: ${data.activeUsers7d}`, positive: true },
                { label: "Analyses IA Totales", rawValue: data.totalAnalyses, display: String(data.totalAnalyses), icon: Brain, iconBg: "bg-violet-100", iconColor: "text-violet-600", borderAccent: "border-l-violet-400", trend: `Coût IA estimé : ${formatCfa(data.totalAnalysesCost)}`, positive: true },
              ].map((card, i) => (
                <KpiCard key={card.label} {...card} delay={i * 80} />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Graphique Activité IA (7 jours réels) avec barres animées */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Activité des Analyses IA</h2>
                    <p className="text-sm text-slate-400 mt-0.5">Volume réel des 7 derniers jours · depuis Supabase</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Données réelles</span>
                  </div>
                </div>

                <div className="flex items-end gap-3 h-52">
                  {data.analysisChart.map((d, i) => {
                    const h = Math.max((d.count / maxChart) * 100, 5);
                    const isToday = i === data.analysisChart.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar relative h-full justify-end">
                        <div className="absolute -top-10 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 translate-y-2 group-hover/bar:translate-y-0 z-20 pointer-events-none">
                          <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap relative">
                            {d.count} analyse{d.count !== 1 ? "s" : ""}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                          </div>
                        </div>
                        <div className="w-full relative h-full flex items-end">
                          <div
                            className={`w-full rounded-t-xl relative overflow-hidden ${isToday ? "bg-gradient-to-t from-emerald-500 to-teal-400 shadow-[0_-4px_16px_rgba(52,211,153,0.3)]" : "bg-slate-100 group-hover/bar:bg-slate-200"}`}
                            style={{
                              height: `${h}%`,
                              animation: `barGrow 0.6s ease-out ${i * 60}ms both`,
                              transformOrigin: "bottom",
                            }}
                          >
                            {isToday && <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-emerald-600" : "text-slate-400"}`}>
                          {d.label.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* CSS keyframe injected inline */}
                <style>{`
                  @keyframes barGrow {
                    from { transform: scaleY(0); opacity: 0; }
                    to   { transform: scaleY(1); opacity: 1; }
                  }
                `}</style>
              </div>

              {/* Live Feed */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col max-h-[420px] relative overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-5">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Flux Temps Réel
                  <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                    {filtered.analyses.length + filtered.users.length} événements
                  </span>
                </h2>
                <div className="flex-1 overflow-auto pr-1 custom-scrollbar space-y-4">
                  {filtered.analyses.slice(0, 8).map((a, i) => (
                    <FeedItem key={a.id} icon={Brain} color="text-indigo-600 bg-indigo-100"
                      title="Analyse IA générée"
                      sub={`${a.team1} vs ${a.team2}`}
                      time={timeAgo(a.createdAt)}
                      onClick={() => setSelectedAnalysis(a)}
                      isLast={i === Math.min(7, filtered.analyses.length - 1)}
                      delay={i * 50}
                    />
                  ))}
                  {filtered.users.slice(0, 4).map((u, i) => (
                    <FeedItem key={u.id} icon={u.isPro ? Crown : UserCheck}
                      color={u.isPro ? "text-amber-600 bg-amber-100" : "text-slate-500 bg-slate-100"}
                      title={u.isPro ? "Nouveau membre Premium 👑" : "Nouvel inscrit"}
                      sub={u.name}
                      time={timeAgo(u.createdAt)}
                      onClick={() => setSelectedUser(u)}
                      isLast={i === 3}
                      delay={(filtered.analyses.slice(0, 8).length + i) * 50}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ TAB: FINANCES & CHURN ════════════════════════ */}
        {activeTab === "finances" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-400">

            {/* KPIs Financiers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="MRR Période" value={formatCfa(filtered.mrr)} icon={DollarSign} iconBg="bg-emerald-100" iconColor="text-emerald-600" trend="Revenus récurrents mensuels réels" positive />
              <KpiCard label="ARPU" value={formatCfa(filtered.arpu)} icon={Target} iconBg="bg-sky-100" iconColor="text-sky-600" trend="Revenu moyen par utilisateur (période)" positive />
              <KpiCard label="CAC (Coût d'Acquisition)" value={formatCfa(filtered.cac)} icon={TrendingUp} iconBg="bg-rose-100" iconColor="text-rose-600" trend={`Budget: ${formatCfa(marketingBudget)} / ${filtered.newUsers} users`} positive={filtered.cac < 5000} />
              <KpiCard label="Taux de Rétention" value={`${filtered.retentionRate}%`} icon={Repeat} iconBg="bg-violet-100" iconColor="text-violet-600" trend="Retour utilisateur après J+1" positive={filtered.retentionRate > 30} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tableau Monthly Stats (données Supabase) */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Historique Mensuel</h2>
                    <p className="text-sm text-slate-400 mt-0.5">Données issues de ta table <code className="bg-slate-100 px-1 rounded text-xs">monthly_stats</code> Supabase</p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100">
                    {data.monthlyStats.length} entrée(s)
                  </span>
                </div>
                <div className="overflow-auto custom-scrollbar max-h-[420px]">
                  {data.monthlyStats.length === 0 ? (
                    <div className="py-16 text-center">
                      <BarChart2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                      <p className="font-bold text-slate-400">Aucune donnée mensuelle</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Exécute le fichier SQL dans Supabase pour créer la table.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {["Période", "MRR", "Nouveaux", "Résiliés", "Churn %", "CAC", "Analyses"].map(h => (
                            <th key={h} className="px-4 py-3 text-left font-bold text-slate-500 text-[10px] uppercase tracking-widest whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.monthlyStats.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-700">{MONTH_NAMES[row.month - 1]} {row.year}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">{formatCfa(row.mrr)}</td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1 text-blue-600 font-semibold"><ArrowUpRight className="w-3.5 h-3.5" />{row.newUsers}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1 text-red-500 font-semibold"><ArrowDownRight className="w-3.5 h-3.5" />{row.cancelledUsers}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${row.churnRate > 10 ? "bg-red-100 text-red-600" : row.churnRate > 5 ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"}`}>
                                {row.churnRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">{formatCfa(row.cac)}</td>
                            <td className="px-4 py-3 text-slate-600 font-medium">{row.totalAnalyses}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Panneau Paramètres Financiers */}
              <div className="space-y-4">
                {/* Budget Marketing (CAC) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Target className="w-4 h-4 text-rose-500" /> Budget Pub Mensuel
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">Saisir pour calculer le CAC en temps réel</p>
                  <div className="relative">
                    <input
                      type="number"
                      value={marketingBudget}
                      onChange={e => setMarketingBudget(Number(e.target.value))}
                      className="w-full pl-4 pr-20 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all"
                      placeholder="ex: 1818000"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">CFA</span>
                  </div>
                  <div className="mt-4 flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-xs text-rose-600 font-semibold">CAC Calculé</span>
                    <span className="text-lg font-black text-rose-700">{formatCfa(filtered.cac)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    ≈ 5 000 000 GNF converti en CFA
                  </p>
                </div>

                {/* Prix Abonnement */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" /> Tarification Actuelle
                  </h3>
                  <div className="space-y-3">
                    <PriceRow label="Abonnement Mensuel" value={formatCfa(pricingConfig.currentPriceCfa)} highlighted />
                    <PriceRow label="Abonnement Annuel" value={formatCfa(pricingConfig.annualPriceCfa)} />
                    <PriceRow label="Coût / Analyse IA" value={formatCfa(pricingConfig.costPerAnalysisCfa)} dim />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ TAB: UTILISATEURS ════════════════════════════ */}
        {activeTab === "users" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in-[0.99] duration-300 flex flex-col h-[75vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" /> Base Utilisateurs
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Clique sur un utilisateur pour voir toutes ses informations.
                </p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Email ou nom..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent w-full sm:w-72 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/80 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                  <tr>
                    {["Utilisateur", "Plan", "Inscription", "Dernière Connexion", "Analyses"].map(h => (
                      <th key={h} className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {searchedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <Users className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                        <p className="font-bold text-slate-400">Aucun utilisateur</p>
                        <p className="text-sm text-slate-400 mt-1">Modifie les filtres ou la période sélectionnée.</p>
                      </td>
                    </tr>
                  ) : (
                    searchedUsers.map(u => {
                      const userAnalyses = data.recentAnalyses.filter(a => a.userId === u.id).length;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow ${u.isPro ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-slate-500 to-slate-700"}`}>
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 capitalize group-hover:text-indigo-700 transition-colors">{u.name}</p>
                                <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {u.isPro ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">
                                <Crown className="w-3 h-3" /> Premium
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                                Free
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-medium">{formatDate(u.createdAt)}</td>
                          <td className="px-6 py-4">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium">
                              {timeAgo(u.lastSignIn)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                              <Brain className="w-3 h-3" /> {userAnalyses}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════ TAB: OUTILS CEO ══════════════════════════════ */}
        {activeTab === "tools" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-400">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ToolCard
                icon={BarChart2} iconBg="bg-indigo-100" iconColor="text-indigo-600"
                title="Analyse de Cohorte"
                desc="Visualisez la rétention par mois d'inscription. Comprenez à quel moment vos utilisateurs abandonnent."
                status="Bientôt disponible"
              />
              <ToolCard
                icon={Mail} iconBg="bg-emerald-100" iconColor="text-emerald-600"
                title="Campagnes Email Ciblées"
                desc="Envoyez des messages de relance aux utilisateurs Free pour les convertir au Premium."
                status="Bientôt disponible"
              />
              <ToolCard
                icon={AlertCircle} iconBg="bg-rose-100" iconColor="text-rose-600"
                title="Logs & Erreurs IA"
                desc="Surveillez les failures de l'API Gemini, les temps de réponse et le taux d'erreur."
                status="Bientôt disponible"
              />
            </div>

            {/* Migration SQL */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-500" /> Instruction : Activer la Table <code>monthly_stats</code>
              </h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                Pour que le graphique de Churn et les KPIs historiques soient 100% réels, exécute ce SQL dans ton éditeur Supabase : <strong>SQL Editor → New query</strong>.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 overflow-auto custom-scrollbar max-h-64">
                <pre className="text-emerald-400 text-xs font-mono leading-relaxed whitespace-pre">{`CREATE TABLE IF NOT EXISTS public.monthly_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  new_users int DEFAULT 0,
  cancelled_users int DEFAULT 0,
  total_premium_users int DEFAULT 0,
  total_analyses int DEFAULT 0,
  marketing_budget_cfa bigint DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE public.monthly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access"
  ON public.monthly_stats AS PERMISSIVE FOR ALL
  TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.monthly_stats (year, month)
VALUES (2026,1),(2026,2),(2026,3),(2026,4),(2026,5),(2026,6),(2026,7)
ON CONFLICT (year, month) DO NOTHING;`}</pre>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Après exécution, tu pourras remplir manuellement les colonnes (new_users, cancelled_users, etc.) dans l'interface Table Editor de Supabase.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-300 border border-slate-200">
        <div className="flex justify-end p-4 pb-0">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-8 pb-8 overflow-y-auto flex-1 custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, badge }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap active:scale-95 ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/60"}`}>
      <Icon className={`w-4 h-4 ${active ? "text-emerald-500" : "text-slate-400"}`} />
      {label}
      {badge !== undefined && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>{badge}</span>
      )}
    </button>
  );
}

function KpiCard({ label, display, icon: Icon, iconBg, iconColor, borderAccent, trend, positive, delay = 0 }: any) {
  return (
    <div
      className={`bg-white border border-slate-200 border-l-4 ${borderAccent ?? "border-l-slate-300"} rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default group`}
      style={{ animation: `cardSlideUp 0.5s ease-out ${delay}ms both` }}
    >
      <style>{`
        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="flex items-start justify-between mb-5">
        <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {positive !== undefined && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
            positive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
          }`}>{positive ? "▲" : "●"}</span>
        )}
      </div>
      <p className="text-3xl font-black text-slate-800 tracking-tight mb-1.5 tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{display}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      {trend && (
        <p className={`text-xs font-medium flex items-center gap-1 ${positive ? "text-emerald-600" : "text-slate-400"}`}>
          {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
          {trend}
        </p>
      )}
    </div>
  );
}

function FeedItem({ icon: Icon, color, title, sub, time, onClick, isLast, delay = 0 }: any) {
  return (
    <div
      className="flex gap-3 group/item cursor-pointer hover:translate-x-1 transition-all duration-200"
      onClick={onClick}
      style={{ animation: `feedSlide 0.4s ease-out ${delay}ms both` }}
    >
      <style>{`
        @keyframes feedSlide {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div className="relative mt-1 shrink-0">
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center group-hover/item:scale-110 transition-transform shadow-sm`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {!isLast && <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-5 bg-slate-100" />}
      </div>
      <div className="flex-1 pb-1">
        <p className="text-sm font-bold text-slate-700 group-hover/item:text-indigo-700 transition-colors">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-1">{time}</p>
      </div>
    </div>
  );
}

function UserInfoRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function PriceRow({ label, value, highlighted, dim }: any) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${highlighted ? "bg-emerald-50 border border-emerald-200" : dim ? "opacity-60" : "bg-slate-50 border border-slate-100"}`}>
      <span className={`text-sm font-semibold ${highlighted ? "text-emerald-700" : "text-slate-600"}`}>{label}</span>
      <span className={`text-sm font-black ${highlighted ? "text-emerald-700" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

function ToolCard({ icon: Icon, iconBg, iconColor, title, desc, status }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative overflow-hidden">
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-5.5 h-5.5 ${iconColor}`} />
      </div>
      <h3 className="text-base font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      <div className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        {status}
      </div>
    </div>
  );
}
