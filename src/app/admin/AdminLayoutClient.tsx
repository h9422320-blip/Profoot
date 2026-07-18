"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Activity,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  LogOut,
  TerminalSquare
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { name: "Vue d'ensemble", href: "/admin", icon: LayoutDashboard },
  { name: "Utilisateurs", href: "/admin/users", icon: Users },
  { name: "Finances", href: "/admin/finances", icon: CreditCard },
  { name: "Système & IA", href: "/admin/system", icon: Activity },
  { name: "Logs", href: "/admin/logs", icon: TerminalSquare },
  { name: "Paramètres", href: "/admin/settings", icon: Settings },
];

export default function AdminLayoutClient({ children, user }: { children: React.ReactNode, user: any }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#070e13] text-white flex overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0b1319] border-r border-[#1a2a36] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:flex-shrink-0`}
      >
        <div className="h-16 flex items-center px-6 border-b border-[#1a2a36] justify-between lg:justify-start">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <span className="font-bold text-black text-sm">PF</span>
            </div>
            <span className="font-bold text-lg tracking-tight">ProFoot Admin</span>
          </Link>
          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group ${
                  isActive ? "text-white bg-[#1a2a36]" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#10b981] rounded-r-full"
                  />
                )}
                <item.icon className={`w-5 h-5 ${isActive ? "text-[#10b981]" : ""}`} />
                <span className="font-medium text-sm">{item.name}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto text-white/30" />}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-[#1a2a36]">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold">{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Super Admin</p>
            </div>
            <Link href="/dashboard" className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors">
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Topbar */}
        <header
          className={`h-16 flex items-center justify-between px-4 sm:px-6 z-30 transition-all duration-200 sticky top-0 ${
            scrolled ? "bg-[#070e13]/80 backdrop-blur-md border-b border-[#1a2a36]" : "bg-transparent"
          }`}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-white/40">
              <span>Admin</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-white">
                {SIDEBAR_ITEMS.find((i) => i.href === pathname)?.name || "Dashboard"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-64 bg-[#101b23] border border-[#1a2a36] rounded-full py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all"
              />
            </div>
            <button className="relative p-2 text-white/60 hover:text-white rounded-full hover:bg-white/5 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#10b981] rounded-full border border-[#070e13]" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto space-y-8"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
