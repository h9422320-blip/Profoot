import { Trophy } from "lucide-react";
import Link from "next/link";
import { clubs, competitions } from "@/lib/data";

const standingsData: Record<string, { id: string; pts: number; w: number; d: number; l: number; gf: number; ga: number }[]> = {
  epl: [
    { id: "arsenal", pts: 79, w: 24, d: 7, l: 5, gf: 72, ga: 26 },
    { id: "mancity", pts: 77, w: 23, d: 8, l: 5, gf: 80, ga: 28 },
    { id: "manutd", pts: 65, w: 19, d: 8, l: 9, gf: 58, ga: 38 },
    { id: "astonvilla", pts: 62, w: 18, d: 8, l: 10, gf: 55, ga: 40 },
    { id: "liverpool", pts: 59, w: 17, d: 8, l: 11, gf: 60, ga: 42 },
    { id: "bournemouth", pts: 55, w: 16, d: 7, l: 13, gf: 52, ga: 45 },
    { id: "brighton", pts: 53, w: 15, d: 8, l: 13, gf: 48, ga: 44 },
    { id: "brentford", pts: 51, w: 15, d: 6, l: 15, gf: 56, ga: 52 },
    { id: "chelsea", pts: 49, w: 14, d: 7, l: 15, gf: 50, ga: 48 },
    { id: "everton", pts: 49, w: 14, d: 7, l: 15, gf: 42, ga: 46 },
  ],
  laliga: [
    { id: "barcelona", pts: 91, w: 29, d: 4, l: 3, gf: 88, ga: 25 },
    { id: "realmadrid", pts: 80, w: 25, d: 5, l: 6, gf: 78, ga: 30 },
    { id: "villarreal", pts: 69, w: 21, d: 6, l: 9, gf: 62, ga: 38 },
    { id: "atletico", pts: 66, w: 19, d: 9, l: 8, gf: 55, ga: 32 },
  ],
  seriea: [
    { id: "inter", pts: 85, w: 27, d: 4, l: 5, gf: 75, ga: 22 },
    { id: "juventus", pts: 72, w: 21, d: 9, l: 6, gf: 55, ga: 28 },
    { id: "roma", pts: 64, w: 19, d: 7, l: 10, gf: 58, ga: 38 },
    { id: "napoli", pts: 60, w: 18, d: 6, l: 12, gf: 52, ga: 40 },
    { id: "milan", pts: 56, w: 16, d: 8, l: 12, gf: 50, ga: 42 },
  ],
  bundesliga: [
    { id: "bayern", pts: 86, w: 27, d: 5, l: 1, gf: 117, ga: 35 },
    { id: "dortmund", pts: 70, w: 21, d: 7, l: 5, gf: 68, ga: 34 },
    { id: "leipzig", pts: 65, w: 20, d: 5, l: 8, gf: 65, ga: 43 },
    { id: "leverkusen", pts: 58, w: 17, d: 7, l: 9, gf: 67, ga: 46 },
  ],
  ligue1: [
    { id: "psg", pts: 76, w: 24, d: 4, l: 5, gf: 73, ga: 27 },
    { id: "lens", pts: 67, w: 21, d: 4, l: 8, gf: 62, ga: 35 },
    { id: "lille", pts: 61, w: 18, d: 7, l: 8, gf: 52, ga: 35 },
    { id: "lyon", pts: 60, w: 18, d: 6, l: 9, gf: 53, ga: 36 },
    { id: "marseille", pts: 56, w: 17, d: 5, l: 11, gf: 60, ga: 44 },
    { id: "monaco", pts: 54, w: 16, d: 6, l: 11, gf: 56, ga: 49 },
  ],
};

const leagueOrder = ["epl", "laliga", "seriea", "bundesliga", "ligue1"];

export default function StandingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Classements</h1>
        <p className="text-foreground/50 text-sm mt-1">Classements actuels des 5 grands championnats européens • Saison 2025-26</p>
      </div>

      {leagueOrder.map(leagueId => {
        const comp = competitions.find(c => c.id === leagueId);
        const rows = standingsData[leagueId];
        if (!comp || !rows) return null;
        return (
          <div key={leagueId} className="bg-card border border-border-card rounded-xl overflow-hidden">
            <Link href={`/competitions/${leagueId}`} className="px-5 py-4 border-b border-border-card flex items-center gap-3 hover:bg-sidebar/50 transition-colors">
              <img src={comp.logo} alt={comp.shortName} className="w-6 h-6 object-contain" />
              <h2 className="text-sm font-bold text-foreground">{comp.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">{comp.status}</span>
            </Link>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] text-foreground/40 uppercase bg-sidebar/30 border-b border-border-card">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-8">#</th>
                    <th className="px-4 py-3 text-left font-medium">Club</th>
                    <th className="px-4 py-3 text-center font-medium">MJ</th>
                    <th className="px-4 py-3 text-center font-medium">V</th>
                    <th className="px-4 py-3 text-center font-medium">N</th>
                    <th className="px-4 py-3 text-center font-medium">D</th>
                    <th className="px-4 py-3 text-center font-medium">BP</th>
                    <th className="px-4 py-3 text-center font-medium">BC</th>
                    <th className="px-4 py-3 text-center font-medium">Diff</th>
                    <th className="px-4 py-3 text-center font-medium">Forme</th>
                    <th className="px-4 py-3 text-right font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-card/50">
                  {rows.map((row, i) => {
                    const club = clubs[row.id];
                    if (!club) return null;
                    const gd = row.gf - row.ga;
                    const isChampion = i === 0;
                    const isUCL = i < 4;
                    return (
                      <tr key={row.id} className={`hover:bg-sidebar/30 transition-colors ${isChampion ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${isUCL ? "text-primary" : "text-foreground/50"}`}>{i + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <img src={club.logo} alt={club.shortName} className="w-6 h-6 rounded-full bg-card" />
                            <span className="text-xs font-semibold text-foreground">{club.name}</span>
                            {isChampion && <Trophy className="w-3 h-3 text-warning" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.w + row.d + row.l}</td>
                        <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.w}</td>
                        <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.d}</td>
                        <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.l}</td>
                        <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.gf}</td>
                        <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.ga}</td>
                        <td className="px-4 py-3 text-center text-xs font-medium">
                          <span className={gd > 0 ? "text-primary" : gd < 0 ? "text-danger" : "text-foreground/50"}>
                            {gd > 0 ? "+" : ""}{gd}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-0.5 justify-center">
                            {club.form.map((f, j) => (
                              <span key={j} className={`w-4 h-4 rounded-full text-[7px] font-bold flex items-center justify-center ${f === "W" ? "bg-primary/20 text-primary" : f === "D" ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger"}`}>{f}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-black text-foreground">{row.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
