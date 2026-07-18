"use client";

import { motion } from "framer-motion";
import MetricCard from "@/components/admin/MetricCard";
import AnimatedChart from "@/components/admin/AnimatedChart";
import { Server, Activity, BrainCircuit, AlertTriangle, Cpu, HardDrive } from "lucide-react";

export default function SystemClient() {
  // Fake telemetry data for the SaaS admin dashboard demo
  const apiUsageData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    requests: Math.floor(Math.random() * 500) + 100,
    errors: Math.floor(Math.random() * 5),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Système & IA</h1>
        <p className="text-sm text-white/50">Surveillez les performances des serveurs et l'utilisation de l'API OpenAI.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Uptime Serveur (Vercel)"
          value="99.98%"
          trend={0.01}
          icon={<Server className="w-5 h-5" />}
          delay={0.1}
        />
        <MetricCard
          title="Latence Moyenne"
          value="142ms"
          trend={-12.4}
          icon={<Activity className="w-5 h-5" />}
          delay={0.2}
        />
        <MetricCard
          title="Requêtes IA / jour"
          value="1,204"
          trend={5.4}
          icon={<BrainCircuit className="w-5 h-5" />}
          delay={0.3}
        />
        <MetricCard
          title="Taux d'erreur API"
          value="0.12%"
          trend={-0.05}
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="lg:col-span-2 bg-[#101b23] border border-[#1a2a36] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white mb-1">Trafic API OpenAI (Dernières 24h)</h3>
          </div>
          <AnimatedChart data={apiUsageData} xKey="time" yKey="requests" color="#a855f7" height={300} delay={0.6} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-[#101b23] border border-[#1a2a36] rounded-2xl p-6 flex flex-col"
        >
          <h3 className="text-lg font-bold text-white mb-6">Santé Système</h3>
          <div className="space-y-6 flex-1">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60 flex items-center gap-2"><Cpu className="w-4 h-4" /> CPU Vercel</span>
                <span className="text-white font-bold">42%</span>
              </div>
              <div className="w-full bg-[#1a2a36] rounded-full h-2">
                <div className="bg-[#10b981] h-2 rounded-full" style={{ width: "42%" }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60 flex items-center gap-2"><HardDrive className="w-4 h-4" /> RAM Utilisée</span>
                <span className="text-white font-bold">68%</span>
              </div>
              <div className="w-full bg-[#1a2a36] rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: "68%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60 flex items-center gap-2"><Database className="w-4 h-4" /> DB Supabase</span>
                <span className="text-white font-bold">12%</span>
              </div>
              <div className="w-full bg-[#1a2a36] rounded-full h-2">
                <div className="bg-[#3b82f6] h-2 rounded-full" style={{ width: "12%" }}></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Custom Database icon since we imported Database but forgot to import it from lucide-react initially.
import { Database } from "lucide-react";
