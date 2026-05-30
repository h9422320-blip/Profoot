import { Search, CalendarDays, CheckCircle2, XCircle, Brain, ChevronRight } from "lucide-react";
import Link from "next/link";
import { matches, getClub, getCompetition, calculateIAPrecision } from "@/lib/data";
import type { Match } from "@/lib/data";

export default function MatchesPage() {
  const todayMatches = matches.filter(m => m.status === "today");
  const upcomingMatches = matches.filter(m => m.status === "upcoming");
  const finishedMatches = matches.filter(m => m.status === "finished");

  return (
    <div className="space-y-10 pb-20 pt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black text-white tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Matchs</h1>
          <p className="text-foreground/50 text-sm font-semibold">Matchs du jour, à venir et terminés • Analyses IA de pointe</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Rechercher une équipe..."
            className="w-full bg-[#111A24]/60 backdrop-blur-md border border-white/5 rounded-full pl-11 pr-5 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/40 transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* Matchs du jour */}
      {todayMatches.length > 0 && (
        <MatchSection title="Matchs du jour" subtitle={`${todayMatches.length} matchs`} icon="🟢">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {todayMatches.map(match => <MatchCard key={match.id} match={match} />)}
          </div>
        </MatchSection>
      )}

      {/* Prochains matchs */}
      {upcomingMatches.length > 0 && (
        <MatchSection title="Prochains matchs" subtitle={`${upcomingMatches.length} matchs`} icon="📅">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {upcomingMatches.map(match => <MatchCard key={match.id} match={match} />)}
          </div>
        </MatchSection>
      )}

      {/* Matchs terminés */}
      {finishedMatches.length > 0 && (
        <MatchSection title="Matchs terminés" subtitle="Vérification IA" icon="✅">
          <div className="space-y-4">
            {finishedMatches.map(match => <FinishedMatchRow key={match.id} match={match} />)}
          </div>
        </MatchSection>
      )}
    </div>
  );
}

function MatchSection({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111A24]/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.2)]">
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <h2 className="text-base font-black text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{title}</h2>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">{subtitle}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const home = getClub(match.homeTeam);
  const away = getClub(match.awayTeam);
  const comp = getCompetition(match.competition);

  const statusColors: Record<string, string> = {
    ready: "bg-primary/10 text-primary border-primary/20",
    processing: "bg-warning/10 text-warning border-warning/20",
    risk: "bg-danger/10 text-danger border-danger/20",
    soon: "bg-white/5 text-white/50 border-white/5",
  };
  const statusLabels: Record<string, string> = {
    ready: "Analyse Prête",
    processing: "En cours",
    risk: "À risque",
    soon: "Bientôt",
  };

  return (
    <Link href={`/match/${match.id}`} className="group block">
      <div className="p-5 md:p-6 rounded-[28px] bg-[#111A24]/80 backdrop-blur-md border border-white/5 hover:bg-white/5 transition-all shadow-lg space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-primary/80">{comp?.shortName}</span>
            <span className="text-white/10">•</span>
            <span className="text-[10px] font-semibold text-white/40 truncate max-w-[120px]">{match.venue}</span>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusColors[(match as any).iaStatus]}`}>
            {statusLabels[(match as any).iaStatus]}
          </span>
        </div>

        {/* Teams & Score Row — perfectly stable and balanced using CSS Grid */}
        <div className="grid grid-cols-[1fr_54px_1fr] items-center gap-3 w-full py-2">
          {/* Home Team */}
          <div className="flex items-center gap-3 justify-end min-w-0 pr-1">
            <span className="font-extrabold text-sm md:text-base text-white truncate text-right">{home.shortName}</span>
            <img src={home.logo} alt={home.shortName} className="w-8 h-8 rounded-full bg-black/30 p-1 border border-white/5 shrink-0 object-contain" />
          </div>

          {/* Score/VS Pill */}
          <div className="flex flex-col items-center justify-center">
            <div className="bg-black/50 px-3 py-1.5 rounded-full text-xs font-black text-white border border-white/5 text-center min-w-[50px] shadow-sm">
              {match.prediction!.score.replace("-", " - ")}
            </div>
            <span className="text-[8px] font-black text-primary uppercase tracking-widest mt-1">Score IA</span>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-3 justify-start min-w-0 pl-1">
            <img src={away.logo} alt={away.shortName} className="w-8 h-8 rounded-full bg-black/30 p-1 border border-white/5 shrink-0 object-contain" />
            <span className="font-extrabold text-sm md:text-base text-white truncate text-left">{away.shortName}</span>
          </div>
        </div>

        {/* Bottom info */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-3 text-[10px] font-semibold text-white/40">
            <span>📅 {match.date.length > 5 ? match.date.substring(0, 5) : match.date}</span>
            <span>🕐 {match.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="w-14 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-primary rounded-full" style={{ width: `${match.prediction!.confidence}%` }} />
            </div>
            <span className="text-[10px] font-black text-primary">{match.prediction!.confidence}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FinishedMatchRow({ match }: { match: Match }) {
  const home = getClub(match.homeTeam);
  const away = getClub(match.awayTeam);
  const precision = calculateIAPrecision(match);
  const displayDate = match.date.length > 5 ? match.date.substring(0, 5) : match.date;

  return (
    <Link href={`/match/${match.id}`} className="block p-4 md:p-5 rounded-[24px] bg-[#111A24]/60 backdrop-blur-md border border-white/5 hover:bg-white/5 transition-all shadow-md group">
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
            {match.score?.home ?? match.result?.home} - {match.score?.away ?? match.result?.away}
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

        {/* Precision & Chevron */}
        <div className="flex items-center gap-2 shrink-0 pl-1">
          {precision && (
            <div className={`px-2 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider ${
              precision.scoreCorrect ? "bg-success/20 text-success" : 
              precision.winnerCorrect ? "bg-primary/20 text-primary" : "bg-danger/20 text-danger"
            }`}>
              <span className="hidden sm:inline">{precision.label}</span>
              <span className="sm:hidden">{precision.scoreCorrect ? "Score" : precision.winnerCorrect ? "1N2" : "Faux"}</span>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors shrink-0" />
        </div>

      </div>
    </Link>
  );
}
