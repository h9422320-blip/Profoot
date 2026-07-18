"use client";

import { motion } from "framer-motion";
import { Save, Lock, Mail, CreditCard, Shield, Globe } from "lucide-react";

export default function SettingsClient() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Paramètres</h1>
        <p className="text-sm text-white/50">Configuration globale de la plateforme ProFoot.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-1">
          {[
            { label: "Général", icon: Globe, active: true },
            { label: "Sécurité & API", icon: Shield, active: false },
            { label: "Paiements", icon: CreditCard, active: false },
            { label: "Emails", icon: Mail, active: false },
          ].map((tab, i) => (
            <button
              key={i}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab.active ? "bg-[#10b981]/10 text-[#10b981]" : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="md:col-span-2 space-y-6"
        >
          {/* Section: General */}
          <div className="bg-[#101b23] border border-[#1a2a36] rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Configuration Générale</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Nom de l'application</label>
                <input
                  type="text"
                  defaultValue="ProFoot AI"
                  className="w-full bg-[#0b1319] border border-[#1a2a36] rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Email de contact Support</label>
                <input
                  type="email"
                  defaultValue="support@profoot.ai"
                  className="w-full bg-[#0b1319] border border-[#1a2a36] rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all"
                />
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-[#1a2a36]">
                <div>
                  <p className="text-sm font-medium text-white">Mode Maintenance</p>
                  <p className="text-xs text-white/40">Désactiver l'accès public au site</p>
                </div>
                <button className="w-12 h-6 rounded-full bg-white/10 relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white/40 transition-all" />
                </button>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button className="flex items-center gap-2 px-6 py-2.5 bg-[#10b981] hover:bg-[#34d399] text-black font-bold rounded-xl text-sm transition-colors">
                <Save className="w-4 h-4" /> Enregistrer les modifications
              </button>
            </div>
          </div>

          {/* Section: Danger Zone */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <Lock className="w-5 h-5" /> Zone de danger
            </h3>
            <p className="text-sm text-red-400/60">
              Ces actions sont irréversibles et peuvent impacter l'ensemble de la plateforme.
            </p>
            <div className="pt-2">
              <button className="px-4 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-400 font-medium rounded-lg text-sm transition-colors">
                Purger le cache IA
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
