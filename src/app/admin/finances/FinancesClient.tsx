"use client";

import { motion } from "framer-motion";
import MetricCard from "@/components/admin/MetricCard";
import AnimatedChart from "@/components/admin/AnimatedChart";
import { CreditCard, TrendingUp, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function FinancesClient({ data }: { data: any }) {
  // Generate a fake 30-day MRR chart data for the demo based on current MRR
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    
    // Simulate growth towards the current MRR
    const growthFactor = (i / 30);
    const simulatedMrr = data.mrr * 0.7 + (data.mrr * 0.3 * growthFactor) + (Math.random() * 50000 - 25000);
    
    return {
      date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      mrr: Math.max(0, Math.round(simulatedMrr)),
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Finances & Revenus</h1>
        <p className="text-sm text-white/50">Suivez la performance financière de ProFoot en temps réel.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="MRR (Revenu Mensuel)"
          value={`${data.mrr.toLocaleString()} CFA`}
          trend={12.5}
          icon={<CreditCard className="w-5 h-5" />}
          delay={0.1}
        />
        <MetricCard
          title="ARR (Revenu Annuel)"
          value={`${(data.mrr * 12).toLocaleString()} CFA`}
          trend={15.2}
          icon={<TrendingUp className="w-5 h-5" />}
          delay={0.2}
        />
        <MetricCard
          title="Abonnés Actifs"
          value={data.premiumUsers}
          trend={8.4}
          icon={<Users className="w-5 h-5" />}
          delay={0.3}
        />
        <MetricCard
          title="ARPU (Revenu moyen/user)"
          value={`${Math.round(data.arpu).toLocaleString()} CFA`}
          trend={-1.2}
          icon={<CreditCard className="w-5 h-5" />}
          delay={0.4}
        />
      </div>

      {/* Main Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="bg-[#101b23] border border-[#1a2a36] rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Croissance du MRR</h3>
            <p className="text-sm text-white/40">Évolution sur les 30 derniers jours</p>
          </div>
          <div className="px-3 py-1.5 bg-white/5 rounded-lg text-sm text-white/60 font-medium">
            30 Derniers Jours
          </div>
        </div>
        <AnimatedChart data={chartData} xKey="date" yKey="mrr" color="#3b82f6" height={350} delay={0.6} />
      </motion.div>

      {/* Recent Transactions (Simulated for UI showcase) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="bg-[#101b23] border border-[#1a2a36] rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-[#1a2a36]">
          <h3 className="text-lg font-bold text-white">Transactions Récentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#0b1319]/50 border-b border-[#1a2a36] text-white/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Plan</th>
                <th className="px-6 py-4 font-semibold">Montant</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {/* Fake transaction data for display */}
              {[1, 2, 3, 4, 5].map((_, idx) => (
                <tr key={idx} className="border-b border-[#1a2a36] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-white font-medium">user{idx + 1}@example.com</td>
                  <td className="px-6 py-4 text-white/70">Pro Mensuel</td>
                  <td className="px-6 py-4 text-white font-bold">20 000 CFA</td>
                  <td className="px-6 py-4 text-white/50">Il y a {idx * 2 + 1} heures</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#10b981]/10 text-[#10b981]">
                      Succès
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
