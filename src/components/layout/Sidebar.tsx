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

// Admin role check — set to true to show the admin button
const IS_ADMIN = true;

const mainNav = [
  { href: "/analyze", label: "Analyse Tactique", icon: Brain },
  { href: "/competitions", label: "Compétitions", icon: Trophy },
  { href: "/competitions/wc", label: "Coupe du monde", icon: Globe, special: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("Utilisateur");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        // Obtenir le nom avant le @ de l'email
        setUserEmail(user.email.split('@')[0]);
      }
    });
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
      <div className="lg:hidden fixed top-0 left-0 w-full h-20 bg-gradient-to-b from-[#0A1118] to-transparent z-40 flex items-start pt-6 px-6 pointer-events-none">
        <Link href="/dashboard" className="flex items-center gap-2 pointer-events-auto">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 text-[#0A1118] flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="w-4 h-4" />
          </div>
          <span className="font-black text-xl tracking-tight text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>ProFoot</span>
        </Link>
      </div>

      {/* Bottom Nav Mobile */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="bg-[#111A24]/90 backdrop-blur-2xl border border-white/5 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center justify-between px-2 py-2">
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
          <Link href="/history" className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-full transition-all duration-300 ${isActive("/history") ? "bg-primary/10 text-primary" : "text-foreground/50 hover:text-foreground"}`}>
            <User className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* =========================================
          💻 DESKTOP EXPERIENCE (SIDEBAR)
          ========================================= */}
      <aside className="hidden lg:flex w-[260px] h-screen bg-[#0A1118] flex-col border-r border-border-card fixed left-0 top-0 z-50">
        <div className="p-8 pb-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 text-primary border border-primary/40 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.15)]">
              <Brain className="w-5 h-5" />
            </div>
            <span className="font-black text-2xl tracking-tight text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>ProFoot</span>
          </Link>
        </div>

        <nav className="px-6 flex-1 space-y-8 mt-6 overflow-y-auto">
          <div>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-2 mb-4">Analyse</p>
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
              <span>Historique</span>
            </Link>
            <Link href="/pricing" className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all text-[14px] font-bold text-foreground/70 border border-border-card hover:bg-card/80`}>
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5" />
                <span>Pricing</span>
              </div>
              <span className="bg-warning/20 text-warning text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-wider">Pro</span>
            </Link>
          </div>
        </nav>

        <div className="p-6 border-t border-border-card space-y-6 bg-gradient-to-t from-black/20 to-transparent">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-foreground/60">
              <BarChart2 className="w-4 h-4" />
              <span className="text-xs font-semibold">Analyses du jour</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-danger tracking-tight">0</span>
              <span className="text-sm font-bold text-danger/50">/ 0</span>
            </div>
            <div className="h-2 bg-danger/10 rounded-full overflow-hidden w-full">
              <div className="h-full bg-gradient-to-r from-danger/50 to-danger w-full rounded-full" />
            </div>
          </div>

          {IS_ADMIN && (
            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-danger/70 hover:bg-danger/10 hover:text-danger transition-all border border-danger/10">
              <Shield className="w-4 h-4" />
              <span>Super Admin</span>
            </Link>
          )}

          <div className="pt-4 border-t border-white/5 space-y-1">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-sidebar flex items-center justify-center text-foreground/50 border border-border-card">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{userEmail}</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Gratuit</p>
              </div>
            </div>
            
            <form action={logout}>
              <button type="submit" className="w-full flex items-center justify-between gap-3 px-4 py-2 mt-2 rounded-xl text-xs font-bold text-foreground/50 hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/5">
                <div className="flex items-center gap-3">
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter</span>
                </div>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
