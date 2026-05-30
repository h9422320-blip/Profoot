import { ChevronLeft, Brain, Target, Activity, Users, Shield, Zap, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { getClub, getCompetition, matches, calculateIAPrecision } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = matches.find((m) => m.id === id);

  if (!match) return notFound();

  const home = getClub(match.homeTeam);
  const away = getClub(match.awayTeam);
  const comp = getCompetition(match.competition);
  const precision = calculateIAPrecision(match);

  return (
    <div className="space-y-8 pb-12">
      {/* Navigation */}
      <Link
        href="/matches"
        className="text-xs text-foreground/40 hover:text-primary transition-colors flex items-center gap-1"
      >
        <ChevronLeft className="w-3 h-3" /> Retour aux matchs
      </Link>

      {/* Main Scoreboard */}
      <div className="relative overflow-hidden bg-card border border-border-card rounded-2xl p-8 md:p-12">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -ml-32 -mb-32" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          {/* Home Team */}
          <Link href={`/club/${home.id}`} className="flex flex-col items-center gap-4 group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-sidebar flex items-center justify-center p-4 border border-border-card shadow-xl group-hover:border-primary/30 transition-all">
              <img src={home.logo} alt={home.name} className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-foreground group-hover:text-primary transition-colors">{home.name}</h2>
              <p className="text-xs text-foreground/40 uppercase tracking-widest">{home.country}</p>
            </div>
          </Link>

          {/* Score / Prediction Center */}
          <div className="flex flex-col items-center gap-6">
            <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
              {comp?.name} • {match.status === "finished" ? "Résultat Final" : "Analyse IA en cours"}
            </div>
            
            <div className="flex items-center gap-6 md:gap-12">
              <span className="text-5xl md:text-7xl font-black text-foreground tracking-tighter">
                {match.status === "finished" ? match.result?.home : match.prediction!.score.split("-")[0]}
              </span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl md:text-4xl font-light text-foreground/20">-</span>
                {match.status !== "finished" && (
                  <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded border border-primary/20">PREDICTED</span>
                )}
              </div>
              <span className="text-5xl md:text-7xl font-black text-foreground tracking-tighter">
                {match.status === "finished" ? match.result?.away : match.prediction!.score.split("-")[1]}
              </span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-foreground/50 text-sm">
                <span>{match.date}</span>
                <span>•</span>
                <span>{match.time}</span>
              </div>
              <p className="text-xs text-foreground/30">{match.venue}</p>
            </div>
          </div>

          {/* Away Team */}
          <Link href={`/club/${away.id}`} className="flex flex-col items-center gap-4 group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-sidebar flex items-center justify-center p-4 border border-border-card shadow-xl group-hover:border-primary/30 transition-all">
              <img src={away.logo} alt={away.name} className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-foreground group-hover:text-primary transition-colors">{away.name}</h2>
              <p className="text-xs text-foreground/40 uppercase tracking-widest">{away.country}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* IA Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Deep Insights */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border-card rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Analyse Tactique IA</h3>
                  <p className="text-xs text-foreground/40">Basé sur 128 variables temps réel</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-primary">{match.prediction!.confidence}%</div>
                <div className="text-[10px] text-foreground/40 uppercase font-bold tracking-widest">Confiance</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <InsightItem 
                  icon={Shield} 
                  title="Solidité Défensive" 
                  desc={`${home.name} a gardé sa cage inviolée lors de 4 de ses 5 derniers matchs. L'IA prévoit un bloc bas très compact.`} 
                />
                <InsightItem 
                  icon={Zap} 
                  title="Transition Offensive" 
                  desc={`${away.name} excelle en contre-attaque rapide avec une efficacité de conversion de 24% sur les phases de transition.`} 
                />
              </div>
              <div className="space-y-6">
                <InsightItem 
                  icon={TrendingUp} 
                  title="Dynamique de Forme" 
                  desc={`${home.name} est sur une série de 6 victoires consécutives à domicile. Avantage psychologique majeur.`} 
                />
                <InsightItem 
                  icon={Users} 
                  title="Impact Joueurs Clés" 
                  desc="L'absence possible du meneur de jeu adverse pourrait réduire les occasions créées de 30% selon nos modèles." 
                />
              </div>
            </div>

            <div className="mt-10 p-6 rounded-xl bg-sidebar/50 border border-border-card border-dashed">
              <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Résumé de la Prédiction
              </h4>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Notre modèle prédictif suggère une rencontre serrée avec une domination territoriale de <span className="text-primary font-bold">{home.name}</span>. 
                Le score le plus probable (<span className="text-foreground font-bold">{match.prediction!.score}</span>) est soutenu par l'efficacité offensive 
                récente des deux équipes. L'IA identifie une probabilité de 68% pour que les deux équipes marquent (BTTS).
              </p>
            </div>
          </div>

          {/* Verification section if finished */}
          {match.status === "finished" && (
            <div className={`bg-card border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 ${precision?.scoreCorrect ? "border-primary/30" : precision?.winnerCorrect ? "border-warning/30" : "border-danger/30"}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${precision?.scoreCorrect ? "bg-primary/10 text-primary" : precision?.winnerCorrect ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>
                  {precision?.winnerCorrect ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Vérification de l'IA</h3>
                  <p className="text-sm text-foreground/50">
                    {precision?.scoreCorrect 
                      ? "Incroyable ! L'IA a prédit le score exact." 
                      : precision?.winnerCorrect 
                      ? "Le vainqueur a été correctement identifié." 
                      : "L'IA n'a pas vu venir ce scénario de match."}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center px-4 py-2 bg-sidebar rounded-lg border border-border-card">
                  <div className="text-[10px] text-foreground/40 uppercase font-bold">Prédit</div>
                  <div className="text-lg font-black text-foreground">{match.prediction!.score}</div>
                </div>
                <div className="text-center px-4 py-2 bg-sidebar rounded-lg border border-border-card">
                  <div className="text-[10px] text-foreground/40 uppercase font-bold">Réel</div>
                  <div className="text-lg font-black text-primary">{match.result?.home} - {match.result?.away}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Odds and Win Probability */}
        <div className="space-y-6">
          <div className="bg-card border border-border-card rounded-2xl p-6">
            <h3 className="text-sm font-bold text-foreground mb-6 uppercase tracking-widest flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Probabilités de Victoire
            </h3>
            <div className="space-y-6">
              <ProbabilityBar label={home.name} value={52} color="bg-primary" />
              <ProbabilityBar label="Match Nul" value={22} color="bg-foreground/20" />
              <ProbabilityBar label={away.name} value={26} color="bg-primary/40" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Conseil de l'IA
            </h3>
            <p className="text-xs text-foreground/70 leading-relaxed mb-4">
              "Compte tenu de la solidité défensive de {home.name} à domicile et de l'enjeu du match, le marché 'Moins de 2.5 buts' présente une valeur statistique intéressante."
            </p>
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-xl border border-primary/10">
              <span className="text-[10px] font-bold text-foreground/50">VALEUR ESTIMÉE</span>
              <span className="text-sm font-black text-primary">+18.4%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightItem({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="mt-1">
        <Icon className="w-5 h-5 text-primary/60" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-foreground mb-1">{title}</h4>
        <p className="text-xs text-foreground/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ProbabilityBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-foreground/70">{label}</span>
        <span className="font-black text-foreground">{value}%</span>
      </div>
      <div className="h-2 w-full bg-sidebar rounded-full overflow-hidden border border-border-card">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
