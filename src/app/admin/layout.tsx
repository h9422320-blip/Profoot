"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, History, BarChart3, AlertTriangle,
  CreditCard, Search, Shield, Settings, LogOut, Menu, X,
  Activity, Brain, ChevronRight, Zap
} from "lucide-react";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/analyses", label: "Historique IA", icon: Brain },
  { href: "/admin/performance", label: "Performance IA", icon: BarChart3 },
  { href: "/admin/analytics", label: "Analytics Live", icon: Activity },
  { href: "/admin/logs", label: "Logs & Surveillance", icon: AlertTriangle },
  { href: "/admin/subscriptions", label: "Abonnements", icon: CreditCard },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile toggle */}
      <button onClick={() => setMobileOpen(true)} className="fixed top-4 left-4 z-50 lg:hidden bg-card border border-border-card p-2 rounded-lg">
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`w-[260px] h-screen bg-[#0A1118] flex flex-col border-r border-border-card fixed left-0 top-0 z-50 transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 pb-4">
          <Link href="/admin" className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-danger/30 to-danger/5 text-danger border border-danger/40 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-2xl text-danger" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Admin</span>
          </Link>
          <p className="text-[11px] text-foreground/50 font-medium ml-11">ProFoot Super Admin</p>
        </div>

        <nav className="px-4 flex-1 space-y-1.5 mt-4 overflow-y-auto">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[14px] font-semibold ${
                isActive(item.href)
                  ? "bg-danger/15 text-danger border border-danger/20"
                  : "text-foreground/60 hover:bg-card/80 hover:text-foreground"
              }`}
            >
              <item.icon className="w-4.5 h-4.5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-5 border-t border-border-card space-y-4">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-primary/80 hover:bg-primary/5 transition-all border border-primary/20">
            <ChevronRight className="w-4 h-4" />
            <span>Retour au SaaS</span>
          </Link>
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-danger" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Super Admin</p>
              <p className="text-[10px] text-foreground/40">Accès complet</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-0 lg:ml-[260px] p-6 md:p-8 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
