"use client";

import { users } from "@/lib/admin-data";
import { Search, Filter, Users as UsersIcon } from "lucide-react";
import { useState } from "react";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === "all" || u.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Utilisateurs</h1>
        <p className="text-sm text-foreground/50 mt-1">Gestion et suivi de tous les utilisateurs ProFoot</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border-card rounded-xl pl-11 pr-4 py-3 text-sm focus:border-danger outline-none"
          />
        </div>
        <div className="flex gap-2">
          {["all", "Gratuit", "Pro", "Premium"].map(plan => (
            <button key={plan} onClick={() => setFilterPlan(plan)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${filterPlan === plan ? 'bg-danger/15 border-danger/30 text-danger' : 'bg-card border-border-card text-foreground/60 hover:text-foreground'}`}>
              {plan === "all" ? "Tous" : plan}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{users.length}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Total</p>
        </div>
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black text-primary" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{users.filter(u=>u.status==="online").length}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">En ligne</p>
        </div>
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black text-danger" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{users.filter(u=>u.plan==="Pro").length}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Pro</p>
        </div>
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black text-warning" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{users.filter(u=>u.plan==="Premium").length}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Premium</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-card">
                <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Utilisateur</th>
                <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Pays</th>
                <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Appareil</th>
                <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Plan</th>
                <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Analyses</th>
                <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Dernière activité</th>
                <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border-card/50 hover:bg-sidebar/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center text-danger text-[10px] font-bold">{u.name.split(" ").map(n=>n[0]).join("")}</div>
                      <div>
                        <p className="text-xs font-bold">{u.name}</p>
                        <p className="text-[10px] text-foreground/40">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-foreground/70">{u.country}</td>
                  <td className="px-5 py-4 text-[10px] text-foreground/50">{u.device}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${u.plan === 'Premium' ? 'bg-warning/15 text-warning' : u.plan === 'Pro' ? 'bg-primary/15 text-primary' : 'bg-foreground/10 text-foreground/50'}`}>{u.plan}</span>
                  </td>
                  <td className="px-5 py-4 text-xs font-bold">{u.analyses}</td>
                  <td className="px-5 py-4 text-[10px] text-foreground/50">{u.lastActive}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${u.status === 'online' ? 'bg-primary' : 'bg-foreground/20'}`} />
                      <span className="text-[10px] font-semibold text-foreground/60">{u.status === 'online' ? 'En ligne' : 'Hors ligne'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
