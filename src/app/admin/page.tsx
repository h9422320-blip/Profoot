"use client";

import { adminStats, realtimeStats, analysisHistory, users, aiPerformance, systemLogs } from "@/lib/admin-data";
import { Users, Brain, Zap, TrendingUp, Activity, AlertTriangle, DollarSign, Clock, CheckCircle2, XCircle, Monitor, Smartphone, Tablet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Super Admin Dashboard</h1>
        <p className="text-sm text-foreground/50 mt-1">Vue d'ensemble en temps réel de ProFoot IA</p>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Utilisateurs totaux" value={adminStats.totalUsers.toLocaleString()} icon={Users} trend="+12.4%" positive={true} />
        <KPICard label="Analyses aujourd'hui" value={adminStats.analysesToday.toString()} icon={Brain} trend="+23%" positive={true} />
        <KPICard label="Connectés maintenant" value={realtimeStats.connectedNow.toString()} icon={Activity} trend="" positive={true} live={true} />
        <KPICard label="Revenu mensuel" value={`€${adminStats.revenue.toLocaleString()}`} icon={DollarSign} trend="+8.2%" positive={true} />
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Précision IA" value={`${aiPerformance.overall}%`} icon={Zap} trend="+2.1%" positive={true} />
        <KPICard label="Temps moyen réponse" value={`${adminStats.avgResponseTime}s`} icon={Clock} trend="-0.8s" positive={true} />
        <KPICard label="Taux d'erreur" value={`${adminStats.errorRate}%`} icon={AlertTriangle} trend="-0.1%" positive={true} />
        <KPICard label="Uptime" value={`${adminStats.uptime}%`} icon={CheckCircle2} trend="" positive={true} />
      </div>

      {/* Middle Row: Traffic + Device Split + Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic by Country */}
        <div className="lg:col-span-2 bg-card border border-border-card rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Trafic par pays</h3>
          <div className="space-y-3">
            {realtimeStats.trafficByCountry.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg w-8">{c.flag}</span>
                <span className="text-sm font-semibold text-foreground/80 w-24">{c.country}</span>
                <div className="flex-1 h-2.5 bg-sidebar rounded-full overflow-hidden">
                  <div className="h-full bg-danger/80 rounded-full transition-all duration-1000" style={{ width: `${c.pct}%` }} />
                </div>
                <span className="text-xs font-bold text-foreground/60 w-16 text-right">{c.users} ({c.pct}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Device Split + Quick Stats */}
        <div className="space-y-4">
          <div className="bg-card border border-border-card rounded-2xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-5">Appareils</h3>
            <div className="space-y-4">
              <DeviceRow icon={Monitor} label="Desktop" value={realtimeStats.deviceSplit.desktop} />
              <DeviceRow icon={Smartphone} label="Mobile" value={realtimeStats.deviceSplit.mobile} />
              <DeviceRow icon={Tablet} label="Tablet" value={realtimeStats.deviceSplit.tablet} />
            </div>
          </div>
          <div className="bg-card border border-border-card rounded-2xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-4">Activité live</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-foreground/60">Analyses en cours</span><span className="font-bold text-danger">{realtimeStats.analysesInProgress}</span></div>
              <div className="flex justify-between text-sm"><span className="text-foreground/60">Pic aujourd'hui</span><span className="font-bold">{realtimeStats.peakToday}</span></div>
              <div className="flex justify-between text-sm"><span className="text-foreground/60">Session moyenne</span><span className="font-bold">{realtimeStats.avgSessionDuration}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Chart (simplified bar chart) */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Activité sur 24h</h3>
        <div className="flex items-end gap-1 h-32">
          {realtimeStats.trafficHourly.map((v, i) => {
            const maxV = Math.max(...realtimeStats.trafficHourly);
            const h = (v / maxV) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-danger/60 rounded-t-sm hover:bg-danger transition-colors" style={{ height: `${h}%` }} />
                {i % 4 === 0 && <span className="text-[8px] text-foreground/30 mt-1">{i}h</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Recent Analyses + Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Analyses */}
        <div className="bg-card border border-border-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60">Dernières analyses</h3>
            <Link href="/admin/analyses" className="text-xs text-danger font-bold hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-3">
            {analysisHistory.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-sidebar/30 border border-border-card rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground/90 truncate">{a.team1} vs {a.team2}</p>
                  <p className="text-[10px] text-foreground/40">{a.user} • {a.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground/80">{a.score}</span>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-card border border-border-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60">Logs système</h3>
            <Link href="/admin/logs" className="text-xs text-danger font-bold hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-3">
            {systemLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-start gap-3 bg-sidebar/30 border border-border-card rounded-xl px-4 py-3">
                <LogIcon type={log.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground/80 truncate">{log.message}</p>
                  <p className="text-[10px] text-foreground/40">{log.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Users Online */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60">Utilisateurs en ligne</h3>
          <Link href="/admin/users" className="text-xs text-danger font-bold hover:underline">Tous les utilisateurs →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.filter(u => u.status === "online").slice(0, 6).map((u) => (
            <div key={u.id} className="flex items-center gap-3 bg-sidebar/30 border border-border-card rounded-xl px-4 py-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-danger/10 flex items-center justify-center text-danger text-xs font-bold">{u.name.split(" ").map(n=>n[0]).join("")}</div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground/90 truncate">{u.name}</p>
                <p className="text-[10px] text-foreground/40">{u.plan} • {u.lastActive}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon: Icon, trend, positive, live }: any) {
  return (
    <div className="bg-card border border-border-card rounded-2xl p-5 relative overflow-hidden group hover:border-danger/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-sidebar border border-border-card flex items-center justify-center text-foreground/60">
          <Icon className="w-4.5 h-4.5" />
        </div>
        {live && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /><span className="text-[10px] font-bold text-primary">LIVE</span></div>}
      </div>
      <p className="text-2xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold">{label}</p>
        {trend && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${positive ? 'text-primary' : 'text-danger'}`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function DeviceRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-foreground/50" />
      <span className="text-xs font-semibold text-foreground/70 w-16">{label}</span>
      <div className="flex-1 h-2 bg-sidebar rounded-full overflow-hidden">
        <div className="h-full bg-danger/70 rounded-full" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold w-10 text-right">{value}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    correct: "bg-primary/15 text-primary",
    incorrect: "bg-danger/15 text-danger",
    pending: "bg-warning/15 text-warning",
  };
  const labels: any = { correct: "✓ Correct", incorrect: "✗ Incorrect", pending: "⏳ En attente" };
  return (
    <span className={`text-[9px] font-bold px-2 py-1 rounded-md ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

function LogIcon({ type }: { type: string }) {
  if (type === "error") return <div className="w-6 h-6 rounded-md bg-danger/15 flex items-center justify-center mt-0.5"><XCircle className="w-3.5 h-3.5 text-danger" /></div>;
  if (type === "warning") return <div className="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center mt-0.5"><AlertTriangle className="w-3.5 h-3.5 text-warning" /></div>;
  if (type === "success") return <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center mt-0.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /></div>;
  return <div className="w-6 h-6 rounded-md bg-info/15 flex items-center justify-center mt-0.5"><Activity className="w-3.5 h-3.5 text-info" /></div>;
}
