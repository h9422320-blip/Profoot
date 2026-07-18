"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, MoreVertical, Shield, ShieldAlert, CheckCircle2, Clock, Mail } from "lucide-react";

export default function UsersClient({ users }: { users: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "premium" | "free">("all");

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" ? true : filter === "premium" ? u.isPro : !u.isPro;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Utilisateurs</h1>
          <p className="text-sm text-white/50">Gérez vos utilisateurs, abonnements et permissions.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Rechercher par nom, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#101b23] border border-[#1a2a36] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all"
          />
        </div>
        <div className="flex bg-[#101b23] border border-[#1a2a36] rounded-xl p-1 shrink-0">
          {(["all", "premium", "free"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === f ? "bg-[#1a2a36] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {f === "all" ? "Tous" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#101b23] border border-[#1a2a36] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#0b1319]/50 border-b border-[#1a2a36] text-white/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Utilisateur</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
                <th className="px-6 py-4 font-semibold">Pays</th>
                <th className="px-6 py-4 font-semibold">Inscription</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredUsers.map((user, idx) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.5) }}
                    className="border-b border-[#1a2a36] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{user.name}</div>
                          <div className="text-xs text-white/40 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isPro ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                          <Shield className="w-3 h-3" /> Premium
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 text-white/50 border border-white/10">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {user.country}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-white/30" />
                        {new Date(user.createdAt).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center text-white/40">
              Aucun utilisateur trouvé.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
