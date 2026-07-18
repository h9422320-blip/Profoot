"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number; // percentage (-10 to +10, etc.)
  trendLabel?: string; // e.g., "vs mois dernier"
  icon?: ReactNode;
  delay?: number;
  loading?: boolean;
}

export default function MetricCard({
  title,
  value,
  trend,
  trendLabel = "vs last month",
  icon,
  delay = 0,
  loading = false,
}: MetricCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const isNeutral = trend !== undefined && trend === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      className="relative bg-[#101b23] border border-[#1a2a36] rounded-2xl p-6 overflow-hidden group hover:border-[#10b981]/30 transition-colors"
    >
      {/* Subtle Glow on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/0 to-[#10b981]/0 group-hover:from-[#10b981]/5 transition-all duration-500 pointer-events-none" />

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-white/10 rounded w-1/3"></div>
            <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
          </div>
          <div className="h-8 bg-white/10 rounded w-1/2"></div>
          <div className="h-3 bg-white/10 rounded w-1/4"></div>
        </div>
      ) : (
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/60 tracking-wide">{title}</h3>
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
                {icon}
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {value}
            </h2>
            
            {trend !== undefined && (
              <div
                className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${
                  isPositive
                    ? "text-[#10b981] bg-[#10b981]/10"
                    : isNegative
                    ? "text-red-400 bg-red-400/10"
                    : "text-white/40 bg-white/5"
                }`}
              >
                {isPositive && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                {isNegative && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {isNeutral && <Minus className="w-3 h-3 mr-0.5" />}
                {Math.abs(trend)}%
              </div>
            )}
          </div>

          {trend !== undefined && trendLabel && (
            <p className="text-xs text-white/40 mt-2 font-medium">{trendLabel}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}
