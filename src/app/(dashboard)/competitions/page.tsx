import { Search, Trophy, Globe, ChevronRight } from "lucide-react";
import Link from "next/link";
import { competitions } from "@/lib/data";

export default function CompetitionsPage() {
  const coupes = competitions.filter(c => c.id === "ucl" || c.id === "caf" || c.id === "can");
  const championnats = competitions.filter(c => !["wc", "ucl", "caf", "can"].includes(c.id));

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 pt-8 px-4 font-sans bg-[#0B121C] min-h-screen">
      {/* Header */}
      <div className="text-center flex flex-col gap-2 mb-8">
        <h1 className="text-[28px] font-bold text-white tracking-tight">Compétitions</h1>
        <p className="text-white/70 text-[15px]">Découvre les compétitions en cours</p>
        <p className="text-[#10B981] text-[13px] px-4 leading-relaxed mt-1 font-medium">
          Notre IA analyse les compétitions et te donne des insights sur les équipes, les classements et les matchs à venir.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-white/30" />
        </div>
        <input 
          type="text"
          placeholder="Rechercher une compétition..."
          className="w-full bg-[#1B2333] border border-transparent rounded-[16px] py-4 pl-14 pr-4 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:border-[#10B981]/50 transition-colors"
        />
      </div>

      {/* Special World Cup Card */}
      <Link href="/competitions/wc" className="block mb-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2A2617] to-[#1A2222] border border-[#FDE047]/10 rounded-[24px] p-6 flex items-center gap-5 hover:brightness-110 transition-all active:scale-[0.98]">
          <div className="w-[64px] h-[64px] shrink-0 bg-white/5 rounded-[18px] flex items-center justify-center border border-white/10 p-1">
            <img src={competitions.find(c => c.id === 'wc')?.logo || ""} alt="World Cup" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#FDE047] text-[10px] font-bold uppercase tracking-widest">ÉDITION DÉDIÉE</span>
            </div>
            <h3 className="text-white font-bold text-[20px] mb-1.5 leading-tight truncate">FIFA World Cup 2026</h3>
            <p className="text-white/60 text-[13px] leading-snug pr-4">
              Top 3 favoris, scénarios de parcours, buteurs probables, forces et faiblesses par équipe
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#FDE047] shrink-0" />
        </div>
      </Link>

      {/* Coupes Section */}
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-center gap-3 px-1 mb-1">
          <Trophy className="w-5 h-5 text-[#FDE047]" />
          <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-widest">COUPES</h2>
        </div>
        
        <div className="flex flex-col gap-3">
          {coupes.map(c => (
            <CompetitionListItem key={c.id} comp={c} />
          ))}
        </div>
      </div>

      {/* Championnats Section */}
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-center gap-3 px-1 mb-1">
          <Globe className="w-5 h-5 text-[#10B981]" />
          <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-widest">CHAMPIONNATS</h2>
        </div>
        
        <div className="flex flex-col gap-3">
          {championnats.map(c => (
            <CompetitionListItem key={c.id} comp={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CompetitionListItem({ comp }: { comp: any }) {
  return (
    <Link href={`/competitions/${comp.id}`} className="block group">
      <div className="bg-[#1B2333] hover:bg-[#232D40] border border-transparent rounded-[20px] p-5 flex items-center gap-5 transition-colors">
        <div className="w-[48px] h-[48px] shrink-0 bg-[#121824] rounded-[14px] flex items-center justify-center p-2.5">
          {comp.logo.startsWith('data:') || comp.logo.startsWith('http') ? (
            <img src={comp.logo} alt={comp.name} className="w-full h-full object-contain" />
          ) : null}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h3 className="text-white font-bold text-[16px] truncate">{comp.name}</h3>
          <p className="text-white/50 text-[13px] truncate">{comp.country} • {comp.currentSeason}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 shrink-0" />
      </div>
    </Link>
  );
}
