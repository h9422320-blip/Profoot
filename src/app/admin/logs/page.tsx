"use client";

import { systemLogs } from "@/lib/admin-data";
import { AlertTriangle, CheckCircle2, XCircle, Activity, Search, Filter } from "lucide-react";
import { useState } from "react";

export default function AdminLogsPage() {
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = systemLogs.filter(l => {
    const matchType = filterType === "all" || l.type === filterType;
    const matchSearch = l.message.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const errors = systemLogs.filter(l => l.type === "error").length;
  const warnings = systemLogs.filter(l => l.type === "warning").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Logs & Surveillance</h1>
        <p className="text-sm text-foreground/50 mt-1">Monitoring système et détection d'erreurs en temps réel</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{systemLogs.length}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Total logs</p>
        </div>
        <div className="bg-card border border-danger/20 rounded-xl p-4 text-center">
          <p className="text-xl font-black text-danger" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{errors}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Erreurs</p>
        </div>
        <div className="bg-card border border-warning/20 rounded-xl p-4 text-center">
          <p className="text-xl font-black text-warning" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{warnings}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Warnings</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-xl p-4 text-center">
          <p className="text-xl font-black text-primary" style={{fontFamily:"'Space Grotesk',sans-serif"}}>99.97%</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Uptime</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input type="text" placeholder="Rechercher dans les logs..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border-card rounded-xl pl-11 pr-4 py-3 text-sm focus:border-danger outline-none" />
        </div>
        <div className="flex gap-2">
          {["all", "error", "warning", "success", "info"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${filterType === t ? 'bg-danger/15 border-danger/30 text-danger' : 'bg-card border-border-card text-foreground/60 hover:text-foreground'}`}>
              {t === "all" ? "Tous" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((log) => (
          <div key={log.id} className={`flex items-start gap-4 bg-card border rounded-xl px-5 py-4 transition-colors ${log.type === 'error' ? 'border-danger/20 hover:border-danger/40' : log.type === 'warning' ? 'border-warning/20 hover:border-warning/40' : 'border-border-card hover:border-border-card'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 shrink-0 ${log.type === 'error' ? 'bg-danger/15' : log.type === 'warning' ? 'bg-warning/15' : log.type === 'success' ? 'bg-primary/15' : 'bg-info/15'}`}>
              {log.type === "error" && <XCircle className="w-4 h-4 text-danger" />}
              {log.type === "warning" && <AlertTriangle className="w-4 h-4 text-warning" />}
              {log.type === "success" && <CheckCircle2 className="w-4 h-4 text-primary" />}
              {log.type === "info" && <Activity className="w-4 h-4 text-info" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground/90">{log.message}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] text-foreground/40">{log.timestamp}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${log.severity === 'high' ? 'bg-danger/10 text-danger' : log.severity === 'medium' ? 'bg-warning/10 text-warning' : 'bg-foreground/5 text-foreground/40'}`}>
                  {log.severity === 'high' ? '⚠ CRITIQUE' : log.severity === 'medium' ? '⚡ MOYEN' : 'ℹ INFO'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
