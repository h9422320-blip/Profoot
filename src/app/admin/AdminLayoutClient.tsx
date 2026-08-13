"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, CreditCard, Brain, Settings, Bell, Search,
  Menu, X, ChevronRight, LogOut, ExternalLink, Wrench, AlertTriangle,
  Info, CheckCircle2, ArrowRight, Megaphone, Gauge, MessageSquare, CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import type { Alerte } from "@/lib/admin-metrics";

const SIDEBAR_ITEMS = [
  { name: "Vue d'ensemble", href: "/admin", icon: LayoutDashboard },
  { name: "Utilisateurs", href: "/admin/users", icon: Users },
  { name: "Partenaires", href: "/admin/partenaires", icon: Megaphone },
  { name: "Finances", href: "/admin/finances", icon: CreditCard },
  { name: "Analyses IA", href: "/admin/system", icon: Brain },
  { name: "Agent VIP", href: "/admin/agent-vip", icon: MessageSquare },
  { name: "La journée", href: "/admin/journee", icon: CalendarDays },
  { name: "Diagnostic", href: "/admin/diagnostic", icon: Gauge },
  { name: "Preuves", href: "/admin/preuves", icon: ShieldCheck },
  { name: "Paiements", href: "/admin/logs", icon: ExternalLink },
  { name: "Paramètres", href: "/admin/settings", icon: Settings },
];

const ICONE_NIVEAU = { urgent: AlertTriangle, attention: Info, info: CheckCircle2 };
const COULEUR_NIVEAU = {
  urgent: "text-red-400 bg-red-500/10 border-red-500/25",
  attention: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  info: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25",
};

export default function AdminLayoutClient({
  children, user, alertes, appName, maintenance,
}: {
  children: React.ReactNode;
  user: any;
  alertes: Alerte[];
  appName: string;
  maintenance: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [alertesOuvertes, setAlertesOuvertes] = useState(false);
  const zoneAlertes = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fermeture du panneau d'alertes au clic à l'extérieur : sans cela il reste
  // ouvert et masque le contenu de la page.
  useEffect(() => {
    function auClic(e: MouseEvent) {
      if (zoneAlertes.current && !zoneAlertes.current.contains(e.target as Node)) {
        setAlertesOuvertes(false);
      }
    }
    document.addEventListener("mousedown", auClic);
    return () => document.removeEventListener("mousedown", auClic);
  }, []);

  useEffect(() => setIsMobileOpen(false), [pathname]);

  /** La recherche mène à la liste des comptes, seul endroit où elle a du sens. */
  function lancerRecherche(e: React.FormEvent) {
    e.preventDefault();
    const terme = recherche.trim();
    router.push(terme ? `/admin/users?q=${encodeURIComponent(terme)}` : "/admin/users");
  }

  const urgentes = alertes.filter((a) => a.niveau === "urgent").length;

  return (
    <div className="min-h-screen bg-[#101c24] text-white flex overflow-hidden font-sans">
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Barre latérale ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#16242e] border-r border-[#2e4757] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:flex-shrink-0`}
      >
        <div className="h-16 flex items-center px-5 border-b border-[#2e4757] justify-between lg:justify-start">
          <Link href="/admin" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.08, rotate: -6 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_14px_rgba(16,185,129,0.45)]"
            >
              <Image src="/logo.png" alt={appName} width={36} height={36} className="w-full h-full object-cover scale-[1.35]" priority />
            </motion.div>
            <div className="leading-tight">
              <span className="font-black text-base tracking-tight block">{appName}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#10b981]">Administration</span>
            </div>
          </Link>
          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          {SIDEBAR_ITEMS.map((item, i) => {
            const isActive = item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] transition-all relative group ${
                    isActive ? "text-white bg-[#2e4757]" : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#10b981] rounded-r-full"
                    />
                  )}
                  <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? "text-[#10b981]" : ""}`} />
                  <span className="font-medium text-sm">{item.name}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-white/30" />}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="p-3 space-y-2 border-t border-[#2e4757]">
          {maintenance && (
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 px-3 py-2 rounded-[14px] bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/15 transition-colors"
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-bold leading-tight">Site en maintenance</span>
            </Link>
          )}

          <div className="flex items-center gap-3 p-3 rounded-[14px] bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#10b981] to-[#2dd4bf] flex items-center justify-center shrink-0">
              <span className="text-xs font-black text-black">{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.email}</p>
              <p className="text-[9px] text-[#10b981] uppercase tracking-widest font-black">Administrateur</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/analyze"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[14px] border border-[#2e4757] text-white/60 hover:text-white hover:border-[#10b981]/40 transition-colors text-[11px] font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" /> L'application
            </Link>
            <form action={logout}>
              <button
                type="submit"
                title="Se déconnecter"
                className="px-3 py-2 rounded-[14px] border border-[#2e4757] text-white/50 hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header
          className={`h-16 flex items-center justify-between px-4 sm:px-6 z-30 transition-all duration-200 sticky top-0 ${
            scrolled ? "bg-[#101c24]/85 backdrop-blur-md border-b border-[#2e4757]" : "bg-transparent"
          }`}
        >
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-white/60 hover:text-white rounded-[14px] hover:bg-white/5"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-white/40">
              <span>Admin</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-white">
                {SIDEBAR_ITEMS.find((i) =>
                  i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)
                )?.name ?? "Vue d'ensemble"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <form onSubmit={lancerRecherche} className="relative hidden md:block">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                type="text"
                placeholder="Rechercher un compte..."
                className="w-56 lg:w-64 bg-[#1d2f3a] border border-[#2e4757] rounded-full py-1.5 pl-9 pr-9 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#10b981]/50 focus:w-72 transition-all"
              />
              {recherche && (
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#10b981] hover:scale-110 transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </form>

            <div className="relative" ref={zoneAlertes}>
              <button
                onClick={() => setAlertesOuvertes(!alertesOuvertes)}
                className="relative p-2 text-white/60 hover:text-white rounded-full hover:bg-white/5 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {alertes.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className={`absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center border border-[#101c24] ${
                      urgentes > 0 ? "bg-red-500 text-white" : "bg-[#10b981] text-black"
                    }`}
                  >
                    {alertes.length}
                  </motion.span>
                )}
              </button>

              <AnimatePresence>
                {alertesOuvertes && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-[320px] bg-[#16242e] border border-[#2e4757] rounded-[18px] shadow-2xl overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-[#2e4757]">
                      <p className="text-xs font-black text-white uppercase tracking-widest">
                        {alertes.length > 0 ? `${alertes.length} point${alertes.length > 1 ? "s" : ""} d'attention` : "Tout va bien"}
                      </p>
                    </div>

                    {alertes.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <CheckCircle2 className="w-7 h-7 text-[#10b981] mx-auto mb-2" />
                        <p className="text-sm text-white/40">Rien à signaler pour le moment.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#2e4757]/50 max-h-[340px] overflow-y-auto">
                        {alertes.map((a, i) => {
                          const Icone = ICONE_NIVEAU[a.niveau];
                          return (
                            <motion.div
                              key={a.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                            >
                              <Link
                                href={a.lien ?? "#"}
                                onClick={() => setAlertesOuvertes(false)}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                              >
                                <span className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${COULEUR_NIVEAU[a.niveau]}`}>
                                  <Icone className="w-3.5 h-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm text-white leading-tight">{a.titre}</p>
                                  <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{a.detail}</p>
                                </div>
                              </Link>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-7xl mx-auto space-y-8"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
