"use client";

import { realtimeStats, adminStats } from "@/lib/admin-data";
import { Activity, Monitor, Smartphone, Tablet, Globe, Clock, Users, Zap } from "lucide-react";

export default function AdminAnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Analytics en temps réel</h1>
        <p className="text-sm text-foreground/50 mt-1">Surveillance live de l'activité ProFoot</p>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-primary/20 rounded-2xl p-5 relative">
          <div className="flex items-center gap-1.5 mb-3"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /><span className="text-[10px] font-bold text-primary">LIVE</span></div>
          <p className="text-3xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{realtimeStats.connectedNow}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">Connectés maintenant</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-5">
          <Zap className="w-5 h-5 text-danger mb-3" />
          <p className="text-3xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{realtimeStats.analysesInProgress}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">Analyses en cours</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-5">
          <Activity className="w-5 h-5 text-warning mb-3" />
          <p className="text-3xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{realtimeStats.peakToday}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">Pic aujourd'hui</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-5">
          <Clock className="w-5 h-5 text-info mb-3" />
          <p className="text-3xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{realtimeStats.avgSessionDuration}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">Session moyenne</p>
        </div>
      </div>

      {/* Hourly Activity */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Activité horaire (aujourd'hui)</h3>
        <div className="flex items-end gap-1 h-44">
          {realtimeStats.trafficHourly.map((v, i) => {
            const maxV = Math.max(...realtimeStats.trafficHourly);
            const h = (v / maxV) * 100;
            const isNow = new Date().getHours() === i;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[8px] font-bold text-foreground/40">{v}</span>
                <div className={`w-full rounded-t-sm transition-colors ${isNow ? 'bg-primary' : 'bg-danger/50 hover:bg-danger/80'}`} style={{ height: `${h}%` }} />
                <span className={`text-[8px] mt-1 ${isNow ? 'text-primary font-bold' : 'text-foreground/30'}`}>{i}h</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic by Country */}
        <div className="bg-card border border-border-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-foreground/60" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60">Trafic par pays</h3>
          </div>
          <div className="space-y-4">
            {realtimeStats.trafficByCountry.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xl w-8">{c.flag}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-foreground/80">{c.country}</span>
                    <span className="text-[10px] font-bold text-foreground/50">{c.users} utilisateurs</span>
                  </div>
                  <div className="h-2 bg-sidebar rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-danger/60 to-danger rounded-full transition-all duration-1000" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
                <span className="text-sm font-black w-12 text-right" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Device Distribution */}
        <div className="bg-card border border-border-card rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Répartition des appareils</h3>
          <div className="space-y-8">
            {[
              { icon: Monitor, label: "Desktop", value: realtimeStats.deviceSplit.desktop, color: "bg-danger" },
              { icon: Smartphone, label: "Mobile", value: realtimeStats.deviceSplit.mobile, color: "bg-warning" },
              { icon: Tablet, label: "Tablette", value: realtimeStats.deviceSplit.tablet, color: "bg-info" },
            ].map((d, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sidebar border border-border-card flex items-center justify-center">
                      <d.icon className="w-5 h-5 text-foreground/60" />
                    </div>
                    <span className="text-sm font-bold">{d.label}</span>
                  </div>
                  <span className="text-2xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{d.value}%</span>
                </div>
                <div className="h-3 bg-sidebar rounded-full overflow-hidden">
                  <div className={`h-full ${d.color} rounded-full transition-all duration-1000`} style={{ width: `${d.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Platform metrics */}
          <div className="mt-8 pt-6 border-t border-border-card grid grid-cols-2 gap-4">
            <div className="bg-sidebar/30 border border-border-card rounded-xl p-4 text-center">
              <p className="text-lg font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{adminStats.totalAnalyses.toLocaleString()}</p>
              <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Analyses totales</p>
            </div>
            <div className="bg-sidebar/30 border border-border-card rounded-xl p-4 text-center">
              <p className="text-lg font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{adminStats.activeToday}</p>
              <p className="text-[9px] text-foreground/50 uppercase tracking-widest font-bold">Actifs aujourd'hui</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
