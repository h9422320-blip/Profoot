"use client";

import { aiPerformance } from "@/lib/admin-data";
import { BarChart3, Zap, Target, TrendingUp } from "lucide-react";

export default function AdminPerformancePage() {
  const weekLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Performance de l'IA</h1>
        <p className="text-sm text-foreground/50 mt-1">Tracking et métriques de précision du moteur ProFoot IA</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border-card rounded-2xl p-6 text-center">
          <Zap className="w-6 h-6 text-danger mx-auto mb-3" />
          <p className="text-4xl font-black text-danger" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{aiPerformance.overall}%</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-2">Précision globale (résultat)</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-6 text-center">
          <Target className="w-6 h-6 text-warning mx-auto mb-3" />
          <p className="text-4xl font-black text-warning" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{aiPerformance.exactScoreAccuracy}%</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-2">Précision score exact</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-6 text-center">
          <TrendingUp className="w-6 h-6 text-primary mx-auto mb-3" />
          <p className="text-4xl font-black text-primary" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{aiPerformance.byCompetition.reduce((s, c) => s + c.total, 0)}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-2">Analyses totales traitées</p>
        </div>
      </div>

      {/* Weekly Accuracy Chart */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Précision sur la semaine</h3>
        <div className="flex items-end gap-3 h-40">
          {aiPerformance.weeklyAccuracy.map((v, i) => {
            const h = ((v - 60) / 20) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-foreground/60">{v}%</span>
                <div className="w-full bg-danger/60 rounded-t-md hover:bg-danger transition-colors" style={{ height: `${Math.max(10, h)}%` }} />
                <span className="text-[10px] text-foreground/40">{weekLabels[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accuracy by Competition */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Précision par compétition</h3>
        <div className="space-y-4">
          {aiPerformance.byCompetition.map((comp, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-xs font-bold text-foreground/80 w-40 truncate">{comp.name}</span>
              <div className="flex-1 h-3 bg-sidebar rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${comp.accuracy >= 75 ? 'bg-primary' : comp.accuracy >= 70 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${comp.accuracy}%` }} />
              </div>
              <span className="text-xs font-bold w-12 text-right">{comp.accuracy}%</span>
              <span className="text-[10px] text-foreground/40 w-16 text-right">{comp.total} analyses</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Predicted Clubs */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Clubs les plus analysés</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {aiPerformance.topPredictedClubs.map((club, i) => (
            <div key={i} className="flex items-center justify-between bg-sidebar/30 border border-border-card rounded-xl px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-foreground/30 w-6" style={{fontFamily:"'Space Grotesk',sans-serif"}}>#{i + 1}</span>
                <span className="text-sm font-bold">{club.club}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-foreground/40">{club.analyses} analyses</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${club.accuracy >= 75 ? 'bg-primary/15 text-primary' : club.accuracy >= 70 ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'}`}>{club.accuracy}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
