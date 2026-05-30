"use client";

import { subscriptions, adminStats } from "@/lib/admin-data";
import { CreditCard, TrendingUp, Users, DollarSign, ArrowUpRight } from "lucide-react";

export default function AdminSubscriptionsPage() {
  const months = ["Sep", "Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai"];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Abonnements & Revenus</h1>
        <p className="text-sm text-foreground/50 mt-1">Gestion des plans et statistiques financières</p>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border-card rounded-2xl p-5">
          <DollarSign className="w-5 h-5 text-primary mb-3" />
          <p className="text-2xl font-black text-primary" style={{fontFamily:"'Space Grotesk',sans-serif"}}>€{subscriptions.mrr.toLocaleString()}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">MRR</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-5">
          <TrendingUp className="w-5 h-5 text-danger mb-3" />
          <p className="text-2xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>+{subscriptions.growth}%</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">Croissance</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-5">
          <Users className="w-5 h-5 text-warning mb-3" />
          <p className="text-2xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{subscriptions.churnRate}%</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">Taux churn</p>
        </div>
        <div className="bg-card border border-border-card rounded-2xl p-5">
          <CreditCard className="w-5 h-5 text-info mb-3" />
          <p className="text-2xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>€{subscriptions.ltv}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold mt-1">LTV moyen</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60">Évolution du revenu mensuel</h3>
          <div className="flex items-center gap-1.5 text-primary">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-xs font-bold">+{subscriptions.growth}%</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-48">
          {subscriptions.revenueHistory.map((v, i) => {
            const maxV = Math.max(...subscriptions.revenueHistory);
            const h = (v / maxV) * 100;
            const isLast = i === subscriptions.revenueHistory.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[9px] font-bold text-foreground/50">€{(v / 1000).toFixed(1)}k</span>
                <div className={`w-full rounded-t-md transition-colors ${isLast ? 'bg-primary' : 'bg-danger/50 hover:bg-danger/80'}`} style={{ height: `${h}%` }} />
                <span className="text-[9px] text-foreground/40">{months[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plans Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subscriptions.plans.map((plan, i) => (
          <div key={i} className={`bg-card border rounded-2xl p-6 ${plan.name === 'Premium' ? 'border-warning/30' : plan.name === 'Pro' ? 'border-primary/30' : 'border-border-card'}`}>
            <div className="flex items-center justify-between mb-6">
              <h4 className={`text-lg font-bold ${plan.name === 'Premium' ? 'text-warning' : plan.name === 'Pro' ? 'text-primary' : 'text-foreground/60'}`}>{plan.name}</h4>
              {plan.name !== "Gratuit" && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${plan.name === 'Premium' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>
                  {plan.name === 'Premium' ? '€67/mois' : '€10/mois'}
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{plan.users}</p>
                <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold">Utilisateurs</p>
              </div>
              <div>
                <p className="text-xl font-black text-primary" style={{fontFamily:"'Space Grotesk',sans-serif"}}>€{plan.revenue.toLocaleString()}</p>
                <p className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold">Revenu mensuel</p>
              </div>
              <div className="h-2 bg-sidebar rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${plan.name === 'Premium' ? 'bg-warning' : plan.name === 'Pro' ? 'bg-primary' : 'bg-foreground/20'}`} style={{ width: `${(plan.users / adminStats.totalUsers) * 100}%` }} />
              </div>
              <p className="text-[10px] text-foreground/40">{((plan.users / adminStats.totalUsers) * 100).toFixed(1)}% des utilisateurs</p>
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Funnel */}
      <div className="bg-card border border-border-card rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">Entonnoir de conversion</h3>
        <div className="space-y-4">
          {[
            { label: "Visiteurs uniques (30j)", value: 12400, pct: 100 },
            { label: "Inscriptions", value: 1247, pct: 10 },
            { label: "Première analyse", value: 892, pct: 7.2 },
            { label: "Conversion Pro", value: 312, pct: 2.5 },
            { label: "Conversion Premium", value: 87, pct: 0.7 },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-xs font-bold text-foreground/70 w-52 truncate">{step.label}</span>
              <div className="flex-1 h-3.5 bg-sidebar rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-danger/60 to-danger rounded-full transition-all duration-1000" style={{ width: `${step.pct}%` }} />
              </div>
              <span className="text-xs font-bold w-16 text-right">{step.value.toLocaleString()}</span>
              <span className="text-[10px] text-foreground/40 w-12 text-right">{step.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
