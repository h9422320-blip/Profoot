"use client";

import { useParams } from "next/navigation";
import { getClub, iaStats } from "@/lib/data";
import { 
  Trophy, Users, MapPin, Activity, 
  ChevronRight, Brain, Target, Shield, 
  UserCircle, Info
} from "lucide-react";
import Link from "next/link";

export default function ClubPage() {
  const { id } = useParams();
  const club = getClub(id as string);

  if (!club || club.name === "Inconnu") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h1 className="text-2xl font-bold">Club non trouvé</h1>
        <Link href="/dashboard" className="text-primary hover:underline">Retour au dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-card border border-border-card p-8 md:p-12">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-sidebar flex items-center justify-center p-6 shadow-xl border border-border-card">
            <img src={club.logo} alt={club.name} className="w-full h-full object-contain" />
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                <Trophy className="w-4 h-4" /> Rang #{club.ranking} • {club.points} pts
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground">{club.name}</h1>
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-foreground/50 text-sm font-medium">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> {club.stadium}
              </div>
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-primary" /> Coach: <span className="text-foreground font-bold">{club.coach}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-center md:justify-start">
              {club.form.map((res, i) => (
                <span key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                  res === "W" ? "bg-success/10 text-success border-success/20" : 
                  res === "D" ? "bg-warning/10 text-warning border-warning/20" : 
                  "bg-danger/10 text-danger border-danger/20"
                }`}>
                  {res}
                </span>
              ))}
            </div>
          </div>

          <Link href="/pricing" className="px-6 py-3 bg-warning text-black text-xs font-black rounded-xl uppercase tracking-tighter hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-warning/20">
            <Brain className="w-4 h-4 fill-black" /> Analyse Pro Elite
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Squad */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="xG Moyen" value={club.stats.xG.toString()} icon={Target} />
            <StatCard label="Possession" value={`${club.stats.possession}%`} icon={Activity} />
            <StatCard label="Buts Marqués" value={club.stats.goalsScored.toString()} icon={TrendingUp} />
            <StatCard label="Clean Sheets" value={club.stats.cleanSheets.toString()} icon={Shield} />
          </div>

          {/* Squad Section */}
          <div className="bg-card border border-border-card rounded-3xl overflow-hidden">
            <div className="px-8 py-6 border-b border-border-card flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Effectif Clé
              </h3>
              <span className="text-xs text-foreground/40 font-medium">Saison 2024-25</span>
            </div>
            <div className="divide-y divide-border-card">
              {club.squad.map((player, i) => (
                <div key={i} className="px-8 py-4 flex items-center justify-between hover:bg-sidebar/30 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center text-foreground/20">
                      <UserCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-sm group-hover:text-primary transition-colors">{player.name}</p>
                      <p className="text-[10px] text-foreground/40 uppercase font-black tracking-widest">{player.position}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                      player.status === "starter" ? "bg-success/10 text-success" :
                      player.status === "injured" ? "bg-danger/10 text-danger" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {player.status === "injured" ? "Blessé" : player.status === "starter" ? "Titulaire" : "Remplaçant"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Insights */}
        <div className="space-y-8">
          <div className="bg-primary p-8 rounded-3xl text-white space-y-6 shadow-xl shadow-primary/20 relative overflow-hidden group">
            <Brain className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-500" />
            <h3 className="text-xl font-bold flex items-center gap-2">
               Insight Tactique <Info className="w-4 h-4 opacity-50" />
            </h3>
            <p className="text-sm leading-relaxed text-white/80">
              Le système de {club.coach} privilégie une possession de {club.stats.possession}% avec un focus particulier sur les phases de transition. Avec un xG de {club.stats.xG}, {club.name} surperforme actuellement ses attentes offensives.
            </p>
            <Link href="/pricing" className="block w-full py-4 bg-white text-primary text-center font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-opacity-90 transition-opacity">
              Débloquer Analyse IA Avancée
            </Link>
          </div>

          <div className="bg-card border border-border-card p-8 rounded-3xl space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-widest text-foreground/50">Performance IA</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-foreground/70">Précision des prédictions</span>
                <span className="text-2xl font-black text-primary">82%</span>
              </div>
              <div className="w-full h-2 bg-sidebar rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '82%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-card border border-border-card p-6 rounded-2xl space-y-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{label}</p>
        <p className="text-2xl font-black text-foreground">{value}</p>
      </div>
    </div>
  );
}

function TrendingUp(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}
