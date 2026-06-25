"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Trophy, History, Settings, 
  LogOut, User, Menu, X, ChevronDown, Award, TrendingUp, Globe, CreditCard, BarChart2,
  Search, Brain, Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/login/actions";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

import { useLanguage } from "@/context/LanguageContext";

export function Sidebar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("Utilisateur");
  const [todayCount, setTodayCount] = useState(0);
  const [isPro, setIsPro] = useState(false);

  const mainNav = [
    { href: "/analyze", label: t("sidebar.tacticalAnalysis"), icon: Brain },
    { href: "/competitions", label: t("sidebar.competitions"), icon: Trophy },
    { href: "/competitions/wc", label: t("sidebar.worldCup"), icon: Globe, special: true },
    { href: "/expert", label: "Agent VIP (ProFoot)", icon: Shield, special: true },
  ];

  // Fonction pour compter les analyses du jour
  function countTodayAnalyses() {
    try {
      const history = JSON.parse(localStorage.getItem("profoot_user_history_v1") || "[]");
      const today = new Date().toDateString();
      const count = history.filter((item: any) => {
        const itemDate = new Date(item.date).toDateString();
        return itemDate === today;
      }).length;
      setTodayCount(count);
    } catch {
      setTodayCount(0);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });

    // Check Pro Status
    fetch('/api/payments/moneroo/status')
      .then(res => res.json())
      .then(data => {
        setIsPro(data.isPro);
      })
      .catch(console.error);

    // Compter les analyses au chargement
    countTodayAnalyses();

    // Écouter l'événement custom émis quand une analyse est terminée
    const handleNewAnalysis = () => countTodayAnalyses();
    window.addEventListener("profoot-analysis-done", handleNewAnalysis);

    return () => {
      window.removeEventListener("profoot-analysis-done", handleNewAnalysis);
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const linkClass = (href: string, special?: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[15px] font-semibold ${
      isActive(href)
        ? "bg-primary/20 text-primary"
        : special
        ? "border border-warning/50 text-warning hover:bg-warning/10"
        : "text-foreground/70 hover:bg-card/80 hover:text-foreground"
    }`;

  return (
    <>
      {/* =========================================
          📱 MOBILE APP EXPERIENCE (BOTTOM NAV)
          ========================================= */}
      
      {/* Top Header Mobile */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-20 bg-gradient-to-b from-[#0A1118] to-transparent z-40 flex items-start justify-between pt-6 px-6 pointer-events-none">
        <Link href="/dashboard" className="flex items-center gap-2 pointer-events-auto group">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#0A1118] to-[#111A24] border border-primary/20 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform flex items-center justify-center">
            <Image src="/logo.png" alt="ProFoot AI" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <span className="font-black text-xl tracking-tight text-white" style={{fontFamily:"'Outfit',sans-serif"}}>PROFOOT <span style={{color:"#10B981"}}>AI</span></span>
        </Link>
      </div>

      {/* Bottom Nav Mobile */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="bg-card/90 backdrop-blur-2xl border border-border-card rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center justify-between px-2 py-2">
          {mainNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-full transition-all duration-300 ${active ? "bg-primary/10 text-primary" : "text-foreground/50 hover:text-foreground"}`}
              >
                <item.icon className={`w-5 h-5 transition-transform duration-300 ${active ? "scale-110 mb-0.5" : ""}`} />
                {active && <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
          <Link href="/history" className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-full transition-all duration-300 ${isActive("/history") || isActive("/settings") ? "bg-primary/10 text-primary" : "text-foreground/50 hover:text-foreground"}`}>
            <User className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* =========================================
          💻 DESKTOP EXPERIENCE (SIDEBAR)
          ========================================= */}
      <aside className="hidden lg:flex w-[260px] h-screen bg-background flex-col border-r border-border-card fixed left-0 top-0 z-50">
        <div className="p-8 pb-4">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-[#0A1118] border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.35)] transition-all">
              <Image src="/logo.png" alt="ProFoot AI" width={44} height={44} className="w-full h-full object-contain" priority />
            </div>
            <span className="font-black text-2xl tracking-tight text-foreground" style={{fontFamily:"'Outfit',sans-serif"}}>PROFOOT <span className="text-primary">AI</span></span>
          </Link>
        </div>

        <nav className="px-6 flex-1 space-y-8 mt-6 overflow-y-auto">
          <div>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-2 mb-4">{t("sidebar.analysis")}</p>
            <div className="space-y-2">
              {mainNav.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(item.href, item.special)}>
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Link href="/history" className={linkClass("/history")}>
              <History className="w-5 h-5" />
              <span>{t("sidebar.history")}</span>
            </Link>
            <Link href="/pricing" className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all text-[14px] font-bold text-foreground/70 border border-border-card hover:bg-card/80`}>
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5" />
                <span>{t("sidebar.pricing")}</span>
              </div>
              <span className="bg-warning/20 text-warning text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-wider">{t("sidebar.pro")}</span>
            </Link>
          </div>
        </nav>

        <div className="p-6 border-t border-border-card space-y-6 bg-gradient-to-t from-black/5 to-transparent">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-foreground/60">
              <BarChart2 className="w-4 h-4" />
              <span className="text-xs font-semibold">{t("sidebar.todayAnalyses")}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-primary tracking-tight">{todayCount}</span>
              <span className="text-sm font-bold text-foreground/30">{todayCount > 1 ? t("sidebar.analyses_plural") : t("sidebar.analysis_singular")}</span>
            </div>
            <div className="h-2 bg-primary/10 rounded-full overflow-hidden w-full">
              <div className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(todayCount * 10, 100)}%` }} />
            </div>
          </div>

          <div className="pt-4 border-t border-border-card space-y-1">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-foreground/50 border border-border-card">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate capitalize">{userEmail !== "Utilisateur" ? userEmail.split('@')[0].replace('.', ' ') : "Utilisateur"}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isPro ? "text-warning" : "text-primary"}`}>
                  {isPro ? t("sidebar.proElite") : t("sidebar.free")}
                </p>
              </div>
            </div>
            
            <form action={logout}>
              <button type="submit" className="w-full flex items-center justify-between gap-3 px-4 py-2 mt-2 rounded-xl text-xs font-bold text-foreground/50 hover:bg-foreground/5 hover:text-foreground transition-all border border-transparent hover:border-border-card">
                <div className="flex items-center gap-3">
                  <LogOut className="w-4 h-4" />
                  <span>{t("sidebar.logout")}</span>
                </div>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
