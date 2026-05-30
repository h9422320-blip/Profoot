"use client";

import { 
  getMatchesByStatus, 
  getClub, 
  calculateIAPrecision
} from "@/lib/data";
import { 
  Target, Brain, ChevronRight, Clock, Calendar
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const futureMatches = getMatchesByStatus("upcoming");
  const finishedMatches = getMatchesByStatus("finished");

  return (
    <div className="space-y-10 pb-20 pt-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Tableau de Bord</h1>
        <p className="text-foreground/50 text-sm font-semibold">Analyse IA Football Premium</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* PROCHAINS MATCHS */}
          <section className="space-y-5">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold text-xl text-white">Prochains Matchs</h3>
              <Link href="/matches" className="text-xs font-black uppercase tracking-widest text-primary hover:text-white transition-colors bg-primary/10 px-4 py-2 rounded-full">
                Voir tout
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <div className="min-w-[340px] space-y-3">
              {futureMatches.length > 0 ? (
                futureMatches.slice(0, 5).map(match => (
                  <UpcomingMatchCard key={match.id} match={match} />
                ))
              ) : (
                <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 border-dashed p-10 rounded-[32px] text-center">
                  <Clock className="w-10 h-10 text-white/20 mx-auto mb-4" />
                  <p className="text-white/40 text-sm font-bold">Aucun match programmé</p>
                </div>
              )}
              </div>
            </div>
          </section>

          {/* DERNIERS RÉSULTATS */}
          <section className="space-y-5">
            <h3 className="font-bold text-xl text-white px-2">Derniers Résultats</h3>
            <div className="overflow-x-auto pb-4 scrollbar-hide">
              <div className="bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden divide-y divide-white/5 min-w-[380px] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                {finishedMatches.map(match => (
                  <ResultRow key={match.id} match={match} />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-6">
           <div className="bg-gradient-to-br from-primary to-primary/80 p-8 rounded-[32px] text-[#0A1118] space-y-6 relative overflow-hidden group shadow-[0_20px_40px_rgba(34,197,94,0.3)]">
            <Brain className="absolute -right-6 -bottom-6 w-36 h-36 opacity-10 group-hover:scale-110 transition-transform duration-500" />
            <div className="space-y-3 relative z-10">
              <h3 className="text-3xl font-black" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Analyseur IA</h3>
              <p className="text-[#0A1118]/70 text-sm font-semibold leading-relaxed">
                Comparez n'importe quel club parmi les 5 grands championnats pour obtenir une analyse détaillée.
              </p>
            </div>
            <Link href="/analyze" className="relative z-10 flex items-center justify-center w-full py-4 bg-[#0A1118] text-white font-black rounded-full text-sm uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl">
              Démarrer l'Analyse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpcomingMatchCard({ match }: { match: any }) {
  const home = getClub(match.homeTeam);
  const away = getClub(match.awayTeam);
  const displayDate = match.date.length > 5 ? match.date.substring(0, 5) : match.date;

  return (
    <Link href={`/match/${match.id}`} className="bg-[#111A24]/80 backdrop-blur-md border border-white/5 p-4 rounded-[28px] hover:bg-white/5 transition-all block shadow-lg">
      <div className="grid grid-cols-[45px_1fr_24px_54px_24px_1fr] md:grid-cols-[60px_1fr_32px_70px_32px_1fr_auto] items-center gap-2 md:gap-4 w-full">
        
        {/* Date */}
        <span className="text-[10px] md:text-xs font-black uppercase text-white/40 text-center shrink-0">
          <span className="md:hidden">{displayDate}</span>
          <span className="hidden md:inline">{match.date}</span>
        </span>

        {/* Home Team */}
        <div className="text-right truncate pr-1">
          <span className="text-xs md:text-sm font-extrabold text-white tracking-tight">{home.shortName}</span>
        </div>

        {/* Home Logo */}
        <div className="flex justify-center items-center shrink-0">
          <img src={home.logo} alt="" className="w-5 h-5 md:w-7 md:h-7 object-contain" />
        </div>

        {/* Time Pill */}
        <div className="flex justify-center items-center">
          <div className="px-2 py-1 bg-black/40 rounded-full text-[10px] md:text-xs font-black text-white border border-white/5 text-center w-full min-w-[50px] shadow-sm">
            {match.time}
          </div>
        </div>

        {/* Away Logo */}
        <div className="flex justify-center items-center shrink-0">
          <img src={away.logo} alt="" className="w-5 h-5 md:w-7 md:h-7 object-contain" />
        </div>

        {/* Away Team */}
        <div className="text-left truncate pl-1">
          <span className="text-xs md:text-sm font-extrabold text-white tracking-tight">{away.shortName}</span>
        </div>

        {/* Prediction (Desktop Only) */}
        {match.prediction && (
          <div className="hidden md:flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20 shrink-0">
            <span className="text-[9px] font-black uppercase text-primary/70 tracking-wider">IA</span>
            <span className="text-xs font-black text-primary">{match.prediction.score}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function ResultRow({ match }: { match: any }) {
  const home = getClub(match.homeTeam);
  const away = getClub(match.awayTeam);
  const precision = calculateIAPrecision(match);
  const displayDate = match.date.length > 5 ? match.date.substring(0, 5) : match.date;

  return (
    <Link href={`/match/${match.id}`} className="block p-4 md:p-5 hover:bg-white/5 transition-all">
      <div className="grid grid-cols-[45px_1fr_24px_54px_24px_1fr_auto] md:grid-cols-[60px_1fr_32px_70px_32px_1fr_auto] items-center gap-2 md:gap-4 w-full">
        
        {/* Date */}
        <span className="text-[10px] md:text-xs font-black uppercase text-white/30 text-center shrink-0">
          <span className="md:hidden">{displayDate}</span>
          <span className="hidden md:inline">{match.date}</span>
        </span>

        {/* Home Team */}
        <div className="text-right truncate pr-1">
          <span className="text-xs md:text-sm font-extrabold text-white tracking-tight">{home.shortName}</span>
        </div>

        {/* Home Logo */}
        <div className="flex justify-center items-center shrink-0">
          <img src={home.logo} alt="" className="w-5 h-5 md:w-7 md:h-7 object-contain" />
        </div>

        {/* Score Pill */}
        <div className="flex justify-center items-center">
          <div className="px-2 py-1 bg-black/50 rounded-full text-[10px] md:text-xs font-black text-white border border-white/5 text-center w-full min-w-[50px] shadow-sm">
            {match.score?.home} - {match.score?.away}
          </div>
        </div>

        {/* Away Logo */}
        <div className="flex justify-center items-center shrink-0">
          <img src={away.logo} alt="" className="w-5 h-5 md:w-7 md:h-7 object-contain" />
        </div>

        {/* Away Team */}
        <div className="text-left truncate pl-1">
          <span className="text-xs md:text-sm font-extrabold text-white tracking-tight">{away.shortName}</span>
        </div>

        {/* Precision Indicator */}
        <div className="flex justify-end shrink-0 pl-1">
          {precision ? (
            <div className={`px-2 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider ${
              precision.scoreCorrect ? "bg-success/20 text-success" : 
              precision.winnerCorrect ? "bg-primary/20 text-primary" : "bg-danger/20 text-danger"
            }`}>
              <span className="hidden sm:inline">{precision.label}</span>
              <span className="sm:hidden">{precision.scoreCorrect ? "Score" : precision.winnerCorrect ? "1N2" : "Faux"}</span>
            </div>
          ) : (
            <div className="w-[30px] md:w-[60px]" />
          )}
        </div>

      </div>
    </Link>
  );
}

