"use client";

import { analysisHistory } from "@/lib/admin-data";
import { Search, Brain, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";

export default function AdminAnalysesPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = analysisHistory.filter(a => {
    const matchSearch = a.team1.toLowerCase().includes(search.toLowerCase()) || a.team2.toLowerCase().includes(search.toLowerCase()) || a.user.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const correct = analysisHistory.filter(a => a.status === "correct").length;
  const incorrect = analysisHistory.filter(a => a.status === "incorrect").length;
  const pending = analysisHistory.filter(a => a.status === "pending").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Historique des Analyses IA</h1>
        <p className="text-sm text-foreground/50 mt-1">Toutes les analyses générées par le moteur ProFoot IA</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{analysisHistory.length}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Total</p>
        </div>
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black text-primary" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{correct}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Correctes</p>
        </div>
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black text-danger" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{incorrect}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Incorrectes</p>
        </div>
        <div className="bg-card border border-border-card rounded-xl p-4 text-center">
          <p className="text-xl font-black text-warning" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{pending}</p>
          <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">En attente</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input type="text" placeholder="Rechercher un match, utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border-card rounded-xl pl-11 pr-4 py-3 text-sm focus:border-danger outline-none" />
        </div>
        <div className="flex gap-2">
          {["all", "correct", "incorrect", "pending"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${filterStatus === s ? 'bg-danger/15 border-danger/30 text-danger' : 'bg-card border-border-card text-foreground/60 hover:text-foreground'}`}>
              {s === "all" ? "Tous" : s === "correct" ? "✓ Correct" : s === "incorrect" ? "✗ Incorrect" : "⏳ Attente"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-card">
              <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Match</th>
              <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Utilisateur</th>
              <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Score</th>
              <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Confiance</th>
              <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Durée</th>
              <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Date</th>
              <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground/40">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-border-card/50 hover:bg-sidebar/30 transition-colors">
                <td className="px-5 py-4"><span className="text-xs font-bold">{a.team1} vs {a.team2}</span></td>
                <td className="px-5 py-4 text-xs text-foreground/70">{a.user}</td>
                <td className="px-5 py-4 text-sm font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{a.score}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-sidebar rounded-full overflow-hidden"><div className="h-full bg-danger" style={{width:`${a.confidence}%`}} /></div>
                    <span className="text-[10px] font-bold">{a.confidence}%</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-[10px] text-foreground/50">{a.duration}</td>
                <td className="px-5 py-4 text-[10px] text-foreground/50">{a.date}</td>
                <td className="px-5 py-4">
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-md ${a.status === 'correct' ? 'bg-primary/15 text-primary' : a.status === 'incorrect' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
                    {a.status === 'correct' ? '✓ Correct' : a.status === 'incorrect' ? '✗ Incorrect' : '⏳ Attente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
