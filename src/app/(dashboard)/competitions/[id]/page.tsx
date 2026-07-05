"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCompetition, clubs, cupParticipants } from "@/lib/data";
import { ArrowLeft, Calendar, MapPin, Search, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function CompetitionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [wcView, setWcView] = useState<"groups" | "bracket">("groups");
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  const competition = getCompetition(id as string);
  const leagueClubs = Object.values(clubs)
    .filter(c => c.league === id || (cupParticipants[id as string] && cupParticipants[id as string].includes(c.id)))
    .sort((a, b) => a.ranking - b.ranking);
  const isCup = leagueClubs.some(c => c.group) || id === "wc" || id === "ucl" || id === "can" || id === "euro" || id === "copa_america";

  const [activeClubs, setActiveClubs] = useState<any[]>(leagueClubs);
  const [liveBracket, setLiveBracket] = useState<any>(null);

  useEffect(() => {
    setActiveClubs(leagueClubs);
    fetch(`/api/competitions/live?id=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.groups && data.groups.length > 0) {
          const newClubs = data.groups.map((apiTeam: any) => {
            const local = leagueClubs.find(c => c.name.toLowerCase() === apiTeam.team.name.toLowerCase());
            return {
              id: local?.id || apiTeam.team.id.toString(),
              name: apiTeam.team.name,
              shortName: local?.shortName || apiTeam.team.name.substring(0,3).toUpperCase(),
              logo: apiTeam.team.logo,
              group: apiTeam.group?.replace('Group ', 'Groupe ') || null,
              points: apiTeam.points,
              ranking: apiTeam.rank,
              stats: {
                played: apiTeam.all.played,
                wins: apiTeam.all.win,
                draws: apiTeam.all.draw,
                losses: apiTeam.all.lose,
                goalsScored: apiTeam.all.goals.for,
                goalsConceded: apiTeam.all.goals.against
              }
            };
          });
          setActiveClubs(newClubs);
        }
        if (data && data.bracket) {
          setLiveBracket(data.bracket);
        }
      })
      .catch(err => console.error("Error fetching live competition data:", err));

    // For cup competitions: fetch REAL bracket from Gemini + Google Search intelligence
    const isCupComp = ["wc", "ucl", "euro", "can", "copa"].includes(id as string);
    if (isCupComp) {
      fetch(`/api/competitions/bracket?id=${id}`)
        .then(res => res.json())
        .then(bracketData => {
          if (bracketData && bracketData.r16 && bracketData.r16.length > 0) {
            // Only use AI bracket if it has real data (not all "À déterminer")
            const hasRealData = bracketData.r16.some((m: any) => m.t1 !== "À déterminer");
            if (hasRealData) {
              setLiveBracket(bracketData);
            }
          }
        })
        .catch(err => console.error("Error fetching AI bracket data:", err));
    }
  }, [id]);

  useEffect(() => {
    if (id !== "wc") return;
    const targetDate = new Date("2026-06-11T16:00:00Z").getTime();
    
    const calculateTime = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;
      if (distance < 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTime());
    const interval = setInterval(() => setTimeLeft(calculateTime()), 1000);
    return () => clearInterval(interval);
  }, [id]);

  if (!competition) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h1 className="text-2xl font-bold text-white">Compétition non trouvée</h1>
        <Link href="/competitions" className="text-[#10B981] hover:underline">Retour aux compétitions</Link>
      </div>
    );
  }

  const dateStr = id === "wc" ? "11 juin – 19 juillet 2026" : `Saison ${competition.currentSeason}`;
  const locationStr = id === "wc" ? "USA • Canada • Mexique" : competition.country;

  return (
    <div className="w-full max-w-4xl mx-auto pb-20 pt-6 px-4 font-sans text-white bg-[#0B121C] min-h-screen">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-[15px] font-medium">Retour aux compétitions</span>
      </button>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-[#1E2532] to-[#0F141C] border border-white/5 rounded-[24px] p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <div className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] bg-white/5 rounded-[16px] flex items-center justify-center border border-white/10 shadow-inner p-1">
            {competition.logo.startsWith('http') || competition.logo.startsWith('data:') ? (
              <img src={competition.logo} alt={competition.name} className="w-full h-full object-contain" />
            ) : (
              <svg width="32" height="36" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            )}
          </div>
          {id === "wc" && <span className="text-[#FDE047] text-[10px] md:text-[12px] font-bold uppercase tracking-widest mt-1">ÉDITION DÉDIÉE</span>}
        </div>
        
        <h1 className="text-[28px] md:text-[36px] font-bold text-white mb-3 tracking-tight">{competition.name}</h1>
        
        <div className="flex flex-wrap items-center gap-4 text-[13px] md:text-[15px] text-white/60 mb-6">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 md:w-5 md:h-5" />
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 md:w-5 md:h-5" />
            <span>{locationStr}</span>
          </div>
        </div>
        
        {id === "wc" ? (
          <div className="inline-flex items-center gap-2 bg-[#1A222D] rounded-xl px-4 py-2 border border-white/5">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">COUP D'ENVOI DANS</span>
            <span className="text-[#10B981] font-bold text-[15px] tabular-nums">
              {timeLeft.days}j {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-[#1A222D] rounded-xl px-4 py-2 border border-white/5">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">STATUT</span>
            <span className="text-[#10B981] font-bold text-[13px] uppercase">{competition.status}</span>
          </div>
        )}
      </div>

      {/* Tabs (Only if Cup) */}
      {isCup && (
        <div className="flex items-center gap-1 mb-6 bg-[#1B2333] p-1.5 rounded-[16px] w-max border border-white/5 overflow-x-auto max-w-full">
          <button onClick={() => setWcView("groups")} className={`px-5 py-2.5 rounded-[12px] text-[14px] font-medium transition-colors whitespace-nowrap ${wcView === 'groups' ? 'bg-[#064E3B]/80 text-[#10B981]' : 'text-white/40 hover:text-white/80'}`}>
            {id === 'ucl' ? 'Phase de Ligue' : 'Groupes'}
          </button>
          <button onClick={() => setWcView("bracket")} className={`px-5 py-2.5 rounded-[12px] text-[14px] font-medium transition-colors whitespace-nowrap ${wcView === 'bracket' ? 'bg-[#064E3B]/80 text-[#10B981]' : 'text-white/40 hover:text-white/80'}`}>
            Éliminatoire
          </button>
        </div>
      )}

      {(!isCup || wcView === "groups") ? (
        <div className="space-y-6">
           {isCup && activeClubs.some((c: any) => c.group) ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {Array.from(new Set(activeClubs.filter((c: any) => c.group).map((c: any) => c.group))).sort().map(groupName => (
                  <div key={groupName as string} className="bg-[#1B2333] border border-white/5 rounded-[20px] overflow-hidden">
                    <div className="px-4 py-3 bg-[#1A222D] border-b border-white/5"><h3 className="font-bold text-[14px]">{groupName as string}</h3></div>
                    <table className="w-full text-left text-[13px]">
                      <tbody className="divide-y divide-white/5">
                        {activeClubs.filter((c: any) => c.group === groupName).sort((a: any, b: any) => a.ranking - b.ranking).map((club: any, i: number) => (
                          <tr key={club.id} className="hover:bg-white/5">
                            <td className="py-3 px-3 flex items-center gap-2">
                              <span className="text-white/30 w-3">{i+1}</span>
                              <img src={club.logo} className="w-5 h-5 object-contain" alt="" />
                              <span className="font-semibold text-white">{club.name}</span>
                            </td>
                            <td className="py-3 px-3 text-center text-white/60">{club.points} pts</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               ))}
             </div>
           ) : (
             <div className="bg-[#1B2333] border border-white/5 rounded-[24px] overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead className="bg-[#1A222D] border-b border-white/5">
                      <tr className="text-white/40 uppercase tracking-wider text-[11px] font-bold">
                        <th className="py-4 px-4 text-center w-10">#</th>
                        <th className="py-4 px-4 min-w-[180px]">Équipe</th>
                        <th className="py-4 px-3 text-center">J</th>
                        <th className="py-4 px-3 text-center hidden sm:table-cell">V</th>
                        <th className="py-4 px-3 text-center hidden sm:table-cell">N</th>
                        <th className="py-4 px-3 text-center hidden sm:table-cell">D</th>
                        <th className="py-4 px-3 text-center">Diff</th>
                        <th className="py-4 px-5 text-center text-[#10B981]">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {activeClubs.sort((a: any, b: any) => a.ranking - b.ranking).map((club: any, index: number) => {
                        let rankColor = "text-white/40";
                        let borderLeft = "border-transparent";
                        if (index < 4) { rankColor = "text-[#10B981]"; borderLeft = "border-[#10B981]"; }
                        else if (index < 6) { rankColor = "text-[#FDE047]"; borderLeft = "border-[#FDE047]"; }
                        else if (index >= activeClubs.length - 3) { rankColor = "text-red-500"; borderLeft = "border-red-500"; }
                        
                        return (
                        <tr key={club.id} className="hover:bg-white/5 transition-colors group">
                          <td className={`py-3 px-4 text-center font-bold ${rankColor} border-l-2 ${borderLeft}`}>
                            {index + 1}
                          </td>
                          <td className="py-3 px-4">
                            <Link href={`/club/${club.id}`} className="flex items-center gap-3">
                              <img src={club.logo} className="w-6 h-6 object-contain" alt="" />
                              <span className="font-semibold text-white group-hover:text-[#10B981] transition-colors">{club.name}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-3 text-center text-white/60">{club.stats?.played || 0}</td>
                          <td className="py-3 px-3 text-center text-white/60 hidden sm:table-cell">{club.stats?.wins || 0}</td>
                          <td className="py-3 px-3 text-center text-white/60 hidden sm:table-cell">{club.stats?.draws || 0}</td>
                          <td className="py-3 px-3 text-center text-white/60 hidden sm:table-cell">{club.stats?.losses || 0}</td>
                          <td className="py-3 px-3 text-center text-white/60">{club.stats ? ((club.stats.goalsScored - club.stats.goalsConceded) > 0 ? `+${club.stats.goalsScored - club.stats.goalsConceded}` : (club.stats.goalsScored - club.stats.goalsConceded)) : 0}</td>
                          <td className="py-3 px-5 text-center font-bold text-white bg-white/5">{club.points}</td>
                        </tr>
                      )})}
                    </tbody>
                </table>
                </div>
              </div>
           )}
        </div>
      ) : (() => {
        const getBracketData = () => {
          if (liveBracket) return liveBracket;

          if (id === 'wc') {
            const m = (name: string) => ({ t1: name, t2: "À déterminer", s1: "-", s2: "-" });
            return {
              r32: [
                m("Winner M73"), m("Winner M74"), m("Winner M75"), m("Winner M76"),
                m("Winner M77"), m("Winner M78"), m("Winner M79"), m("Winner M80"),
                m("Winner M81"), m("Winner M82"), m("Winner M83"), m("Winner M84"),
                m("Winner M85"), m("Winner M86"), m("Winner M87"), m("Winner M88")
              ],
              r16: Array(8).fill({ t1: "Vainqueur Seizième", t2: "Vainqueur Seizième", s1: "-", s2: "-" }),
              qf: Array(4).fill({ t1: "Vainqueur Huitième", t2: "Vainqueur Huitième", s1: "-", s2: "-" }),
              sf: Array(2).fill({ t1: "Vainqueur Quart", t2: "Vainqueur Quart", s1: "-", s2: "-" }),
              third_place: { t1: "Perdant Demie 1", t2: "Perdant Demie 2", s1: "-", s2: "-" },
              final: { t1: "Vainqueur Demie 1", t2: "Vainqueur Demie 2", s1: "-", s2: "-" }
            };
          }

          const emptyMatch = { t1: "Chargement...", t2: "Chargement...", s1: "-", s2: "-" };
          return {
            r32: [],
            r16: Array(8).fill(emptyMatch),
            qf: Array(4).fill(emptyMatch),
            sf: Array(2).fill(emptyMatch),
            third_place: null,
            final: emptyMatch
          };
        };

        const bracket = getBracketData();

        const renderTeam = (teamName: string, score: string, isWinner: boolean) => {
          const cName = teamName.toLowerCase();
          const club = leagueClubs.find(c => c.name.toLowerCase() === cName);
          // Fake flags for generic UI matching Visifoot
          const getFlag = (n: string) => {
            const m: any = { "mexique":"mx","afrique du sud":"za","corée du sud":"kr","république tchèque":"cz","suisse":"ch","canada":"ca","bosnie-herzégovine":"ba","qatar":"qa","brésil":"br","maroc":"ma","écosse":"gb-sct","haïti":"ht","usa":"us","australie":"au","paraguay":"py","turquie":"tr","allemagne":"de","côte d'ivoire":"ci","équateur":"ec","curaçao":"cw","pays-bas":"nl","japon":"jp","suède":"se","tunisie":"tn","belgique":"be","egypte":"eg","iran":"ir","nouvelle-zélande":"nz","espagne":"es","iles du cap-vert":"cv","uruguay":"uy","arabie saoudite":"sa","france":"fr","norvège":"no","sénégal":"sn","irak":"iq","argentine":"ar","autriche":"at","algérie":"dz","jordanie":"jo","colombie":"co","portugal":"pt","rép. dém. du congo":"cd","ouzbékistan":"uz","angleterre":"gb-eng","croatie":"hr","ghana":"gh","panama":"pa" };
            return m[n.toLowerCase()] ? `https://flagcdn.com/w40/${m[n.toLowerCase()]}.png` : club?.logo;
          };
          const logo = getFlag(teamName);

          return (
            <div className={`px-3 py-1.5 border-b border-white/5 flex justify-between items-center ${isWinner ? 'text-[#10B981]' : 'text-white/60'}`}>
               <div className="flex items-center gap-2 overflow-hidden">
                 {logo ? (
                   <img src={logo} alt={teamName} className="w-4 h-4 object-contain" />
                 ) : (
                   <div className="w-4 h-4 rounded-full bg-white/10" />
                 )}
                 <span className={`truncate text-[12px] ${isWinner ? 'font-bold text-white' : 'text-white/60'}`}>{teamName}</span>
               </div>
               <span className="font-bold text-[13px]">{score}</span>
            </div>
          );
        };

        return (
          <div className="bg-[#111827] border border-white/5 rounded-[20px] p-6 overflow-x-auto">
            <h2 className="text-white text-xl font-bold mb-6">Tableau à élimination directe</h2>
            <div className="min-w-[1200px] flex justify-between gap-6 relative">
              {/* Seizièmes */}
              {bracket.r32 && bracket.r32.length > 0 && (
                <div className="flex-1 flex flex-col gap-3 relative z-10">
                  <h4 className="text-center text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Seizièmes de finale</h4>
                  {bracket.r32.map((match: any, i: number) => (
                    <div key={`r32-${i}`} className="bg-[#1F2937] border border-white/5 rounded-lg overflow-hidden flex flex-col justify-center shadow-lg relative">
                      {renderTeam(match.t1, match.s1, match.s1 > match.s2 || match.s1 === "V")}
                      {renderTeam(match.t2, match.s2, match.s2 > match.s1 || match.s2 === "V")}
                      {/* Connecting Line Right */}
                      <div className="absolute top-1/2 -right-3 w-3 border-t border-[#374151]"></div>
                      {i % 2 === 0 && <div className="absolute top-1/2 -right-3 w-px h-[calc(100%+0.75rem)] bg-[#374151]"></div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Huitièmes */}
              <div className="flex-1 flex flex-col gap-3 justify-around relative z-10">
                <h4 className="text-center text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Huitièmes de finale</h4>
                {bracket.r16.map((match: any, i: number) => (
                  <div key={`r16-${i}`} className="bg-[#1F2937] border border-white/5 rounded-lg overflow-hidden flex flex-col justify-center shadow-lg relative">
                    {/* Connecting Line Left */}
                    <div className="absolute top-1/2 -left-3 w-3 border-t border-[#374151]"></div>
                    {renderTeam(match.t1, match.s1, match.s1 > match.s2 || match.s1 === "V")}
                    {renderTeam(match.t2, match.s2, match.s2 > match.s1 || match.s2 === "V")}
                    {/* Connecting Line Right */}
                    <div className="absolute top-1/2 -right-3 w-3 border-t border-[#374151]"></div>
                    {i % 2 === 0 && <div className="absolute top-1/2 -right-3 w-px h-[calc(100%+0.75rem)] bg-[#374151] z-0"></div>}
                  </div>
                ))}
              </div>
              
              {/* Quarts */}
              <div className="flex-1 flex flex-col gap-3 justify-around relative z-10">
                <h4 className="text-center text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Quarts de finale</h4>
                {bracket.qf.map((match: any, i: number) => (
                  <div key={`qf-${i}`} className="bg-[#1F2937] border border-white/5 rounded-lg overflow-hidden flex flex-col justify-center shadow-lg relative">
                    <div className="absolute top-1/2 -left-3 w-3 border-t border-[#374151]"></div>
                    {renderTeam(match.t1, match.s1, match.s1 > match.s2 || match.s1 === "V")}
                    {renderTeam(match.t2, match.s2, match.s2 > match.s1 || match.s2 === "V")}
                    <div className="absolute top-1/2 -right-3 w-3 border-t border-[#374151]"></div>
                    {i % 2 === 0 && <div className="absolute top-1/2 -right-3 w-px h-[calc(100%+0.75rem)] bg-[#374151] z-0"></div>}
                  </div>
                ))}
              </div>
              
              {/* Demies */}
              <div className="flex-1 flex flex-col gap-3 justify-around relative z-10">
                <h4 className="text-center text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Demi-finales</h4>
                {bracket.sf.map((match: any, i: number) => (
                  <div key={`sf-${i}`} className="bg-[#1F2937] border border-[#10B981]/30 rounded-lg overflow-hidden flex flex-col justify-center shadow-lg relative">
                    <div className="absolute top-1/2 -left-3 w-3 border-t border-[#374151]"></div>
                    {renderTeam(match.t1, match.s1, match.s1 > match.s2 || match.s1 === "V")}
                    {renderTeam(match.t2, match.s2, match.s2 > match.s1 || match.s2 === "V")}
                    <div className="absolute top-1/2 -right-3 w-3 border-t border-[#374151]"></div>
                    {i % 2 === 0 && <div className="absolute top-1/2 -right-3 w-px h-[calc(100%+0.75rem)] bg-[#374151] z-0"></div>}
                  </div>
                ))}
              </div>

              {/* Finale & 3e Place */}
              <div className="flex-1 flex flex-col gap-10 justify-center relative z-10">
                <div>
                  <h4 className="text-center text-[10px] font-bold text-[#FDE047] uppercase tracking-widest mb-2">Finale</h4>
                  <div className="bg-[#1F2937] border border-[#FDE047]/30 rounded-lg overflow-hidden flex flex-col justify-center shadow-[0_0_15px_rgba(253,224,71,0.05)] relative">
                    <div className="absolute top-1/2 -left-3 w-3 border-t border-[#374151]"></div>
                    {renderTeam(bracket.final?.t1 || "Vainqueur Demie 1", bracket.final?.s1 || "-", bracket.final?.s1 > bracket.final?.s2)}
                    {renderTeam(bracket.final?.t2 || "Vainqueur Demie 2", bracket.final?.s2 || "-", bracket.final?.s2 > bracket.final?.s1)}
                  </div>
                </div>

                {bracket.third_place && (
                  <div className="mt-8">
                    <h4 className="text-center text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Match pour la 3e place</h4>
                    <div className="bg-[#1F2937] border border-white/5 rounded-lg overflow-hidden flex flex-col justify-center shadow-lg opacity-80">
                      {renderTeam(bracket.third_place.t1, bracket.third_place.s1, bracket.third_place.s1 > bracket.third_place.s2)}
                      {renderTeam(bracket.third_place.t2, bracket.third_place.s2, bracket.third_place.s2 > bracket.third_place.s1)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
