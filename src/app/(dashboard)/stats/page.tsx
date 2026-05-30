import { BarChart3, Target } from "lucide-react";
import { topScorers, clubs, competitions } from "@/lib/data";

export default function StatsPage() {
  const leagues = [
    { id: "epl", label: "Premier League" },
    { id: "laliga", label: "La Liga" },
    { id: "seriea", label: "Serie A" },
    { id: "ligue1", label: "Ligue 1" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>
        <p className="text-foreground/50 text-sm mt-1">Meilleurs buteurs et passeurs • Saison 2025-26</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {leagues.map(league => {
          const comp = competitions.find(c => c.id === league.id);
          const scorers = topScorers[league.id] || [];
          return (
            <div key={league.id} className="bg-card border border-border-card rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-card flex items-center gap-3">
                {comp && <img src={comp.logo} alt={comp.shortName} className="w-5 h-5 object-contain" />}
                <h2 className="text-sm font-bold text-foreground">{league.label}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">Buteurs</span>
              </div>
              <div className="divide-y divide-border-card/50">
                {scorers.map((scorer: any, i: number) => {
                  const club = clubs[scorer.club];
                  return (
                    <div key={scorer.name} className="flex items-center gap-4 px-5 py-3 hover:bg-sidebar/30 transition-colors">
                      <span className={`text-xs font-black w-5 text-center ${i === 0 ? "text-warning" : i < 3 ? "text-primary" : "text-foreground/40"}`}>
                        {i + 1}
                      </span>
                      {club && <img src={club.logo} alt={club.shortName} className="w-6 h-6 rounded-full bg-card p-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{scorer.name}</p>
                        <p className="text-[10px] text-foreground/40">{club?.name || scorer.club}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <div className="text-sm font-black text-foreground">{scorer.goals}</div>
                          <div className="text-[8px] text-foreground/30">BUTS</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-foreground/60">{scorer.assists}</div>
                          <div className="text-[8px] text-foreground/30">PD</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
