"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Target,
  Zap,
  Shield,
  PlayCircle,
  CheckCircle2,
  Star,
  ChevronDown,
  TrendingUp,
  Activity,
  Globe,
  Trophy,
  Users,
  Cpu,
  Eye,
  Database,
} from "lucide-react";

// ============================================================================
// PROFOOT — LANDING PAGE PREMIUM v3.0
// Inspired by Visifoot — Dark + Emerald + Stadium aesthetic
// ============================================================================

// Animated counter hook
function useCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor
<truncated 29061 bytes>
e</span>
                  <span>Attaque</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-xs font-bold">Moteur Mathématique</span>
                  <Target className="w-3 h-3 text-[#10b981]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded p-2 text-center">
                    <span className="block text-[#10b981] text-sm font-bold">12k+</span>
                    <span className="text-[8px] text-white/40 uppercase">Variables</span>
                  </div>
                  <div className="bg-white/5 rounded p-2 text-center">
                    <span className="block text-[#10b981] text-sm font-bold">99%</span>
                    <span className="text-[8px] text-white/40 uppercase">Précision Data</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-white text-[10px] font-bold mb-1">Connexion API Football</span>
                    <span className="block text-white/60 text-[9px] leading-tight">Données synchronisées en temps réel. Mises à jour chaque minute.</span>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

The above content shows the entire, complete file contents of the requested file.
