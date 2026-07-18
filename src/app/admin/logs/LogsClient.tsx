"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TerminalSquare, AlertCircle, Info, CheckCircle2, ShieldAlert } from "lucide-react";

const FAKE_LOGS = [
  { id: 1, type: "error", message: "OpenAI API timeout on analyze match", time: "Il y a 2 min", source: "AI Agent" },
  { id: 2, type: "info", message: "New user registration: thomas.r@example.com", time: "Il y a 15 min", source: "Auth" },
  { id: 3, type: "success", message: "Payment successful for sub_1Px4...", time: "Il y a 42 min", source: "Stripe" },
  { id: 4, type: "warning", message: "High latency detected on DB query", time: "Il y a 1h", source: "Supabase" },
  { id: 5, type: "info", message: "Cron job 'daily_stats_rollup' executed", time: "Il y a 3h", source: "System" },
];

export default function LogsClient() {
  const [filter, setFilter] = useState<"all" | "error" | "info" | "warning" | "success">("all");

  const filteredLogs = FAKE_LOGS.filter((l) => filter === "all" || l.type === filter);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Logs Système</h1>
          <p className="text-sm text-white/50">Flux d'événements, paiements, et erreurs d'infrastructure.</p>
        </div>
      </div>

      <div className="flex bg-[#101b23] border border-[#1a2a36] rounded-xl p-1 shrink-0 w-fit">
        {(["all", "error", "warning", "info", "success"] as const).map((f) => (
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

      <div className="bg-[#101b23] border border-[#1a2a36] rounded-2xl overflow-hidden shadow-2xl font-mono text-sm">
        <div className="p-4 bg-[#0b1319] border-b border-[#1a2a36] flex items-center gap-2 text-white/50">
          <TerminalSquare className="w-4 h-4" /> root@profoot-production ~
        </div>
        <div className="p-4 space-y-3">
          <AnimatePresence>
            {filteredLogs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="flex items-start gap-4 p-2 hover:bg-white/[0.02] rounded-lg transition-colors"
              >
                <div className="shrink-0 pt-0.5">
                  {log.type === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                  {log.type === "warning" && <ShieldAlert className="w-4 h-4 text-amber-400" />}
                  {log.type === "info" && <Info className="w-4 h-4 text-blue-400" />}
                  {log.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#10b981]" />}
                </div>
                <div className="flex-1">
                  <span className="text-white/40 mr-3">[{log.time}]</span>
                  <span className="text-white/30 mr-3">[{log.source}]</span>
                  <span className={`${log.type === "error" ? "text-red-400" : log.type === "warning" ? "text-amber-400" : "text-white/80"}`}>
                    {log.message}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredLogs.length === 0 && (
            <div className="text-white/30 py-8 text-center italic">Aucun log trouvé pour ce filtre.</div>
          )}
        </div>
      </div>
    </div>
  );
}
