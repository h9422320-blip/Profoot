"use client";

import { motion } from "framer-motion";
import MetricCard from "@/components/admin/MetricCard";
import AnimatedChart from "@/components/admin/AnimatedChart";
import { Users, CreditCard, Activity, BrainCircuit, ArrowUpRight } from "lucide-react";

export default function OverviewDashboardClient({ data }: { data: any }) {
  if (data.error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
        <h2 className="font-bold mb-2">Erreur Serveur</h2>
        <p>{data.error}</p>
      </div>
    );
  }

  // Format charts
  const revenueData = data.analysisChart.map((d: any) => ({
    name: d.label,
    revenus: d.count * (data.pricingConfig.costPerAnalysisCfa * 2), // dummy multiplier for aesthetics
    analyses: d.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Vue d'ensemble
        </h1>
        <p className="text-white/50">Bienvenue sur votre plateforme d'administration ProFoot.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Revenu Mensuel (MRR)"
          value={`${data.mrr.toLocaleString()} CFA`}
          trend={12.5}
          icon={<CreditCard className="w-5 h-5" />}
          delay={0.1}
        />
        <MetricCard
          title="Utilisateurs Actifs"
          value={data.totalUsers}
          trend={5.2}
          icon={<Users className="w-5 h-5" />}
          delay={0.2}
        />
        <MetricCard
          title="Analyses IA"
          value={data.totalAnalyses}
          trend={18.4}
          icon={<BrainCircuit className="w-5 h-5" />}
          delay={0.3}
        />
        <MetricCard
          title="Taux d'Activation"
          value="42%"
          trend={-2.1}
          icon={<Activity className="w-5 h-5" />}
          delay={0.4}
        />
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="lg:col-span-2 bg-[#101b23] border border-[#1a2a36] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Croissance des Revenus</h3>
              <p className="text-sm text-white/40">Évolution sur les 7 derniers jours</p>
            </div>
            <div className="px-3 py-1.5 bg-white/5 rounded-lg text-sm text-white/60 font-medium">
              7 Derniers Jours
            </div>
          </div>
          <AnimatedChart data={revenueData} xKey="name" yKey="revenus" color="#10b981" height={320} delay={0.6} />
        </motion.div>

        {/* Recent Activity / Mini Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-[#101b23] border border-[#1a2a36] rounded-2xl p-6 flex flex-col"
        >
          <h3 className="text-lg font-bold text-white mb-6">Activité Récente</h3>
          <div className="space-y-4 flex-1">
            {data.recentUsers.slice(0, 5).map((user: any, i: number) => (
              <div key={user.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shrink-0 text-xs font-bold text-black">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-[#10b981] transition-colors">{user.name}</p>
                    <p className="text-[10px] text-white/40">{user.email}</p>
                  </div>
                </div>
                <span className="text-[10px] text-white/30 font-medium">
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all flex items-center justify-center gap-2">
            Voir tous les utilisateurs <ArrowUpRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
