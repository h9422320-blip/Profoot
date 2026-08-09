"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getClub } from "@/lib/data";
import { 
  Trophy, Users, MapPin, Activity, 
  ChevronRight, Brain, Target, Shield, 
  UserCircle, Info
} from "lucide-react";
import Link from "next/link";

export default function ClubPage() {
  const { id } = useParams();
  const club = getClub(id as string);

  // Rang, points et forme viennent du classement en cours, pas du référentiel
  // où ils sont figés depuis leur saisie. Tant que rien n'est chargé — ou tant
  // que la saison n'a pas démarré — on n'affiche ni rang ni points plutôt qu'un
  // « Rang #0 • 0 pts » qui ressemble à une donnée manquante.
  const [classement, setClassement] = useState<{
    rang: number;
    points: number;
    joues: number;
    victoires: number;
    nuls: number;
    defaites: number;
    butsMarques: number;
    butsEncaisses: number;
    forme: ("W" | "D" | "L")[];
  } | null>(null);
  const [saison, setSaison] = useState<string | null>(null);

  useEffect(() => {
    const nom = club?.name;
    const ligue = club?.league;
    if (!nom || nom === "Inconnu" || !ligue || ligue === "N/A") return;
    let annule = false;
    fetch(`/api/club/classement?nom=${encodeURIComponent(nom)}&ligue=${encodeURIComponent(ligue)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (annule || !d) return;
        setClassement(d.classement ?? null);
        setSaison(d.saison ?? null);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [club?.name, club?.league]);

  const saisonDemarree = !!classement && classement.joues > 0;

  if (!club || club.name === "Inconnu") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h1 className="text-2xl font-bold">Club non trouvé</h1>
        <Link href="/analyze" className="text-primary hover:underline">Retour à l'analyse</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-card border border-border-card p-8 md:p-12">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-[28px] bg-sidebar flex items-center justify-center p-6 shadow-xl border border-border-card">
            <img src={club.logo} alt={club.name} className="w-full h-full object-contain" />
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                <Trophy className="w-4 h-4" />{" "}
                {saisonDemarree
                  ? `Rang #${classement!.rang} • ${classement!.points} pts`
                  : saison
                    ? `Saison ${saison} à venir`
                    : "Chargement…"}
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground">{club.name}</h1>
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-foreground/50 text-sm font-medium">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> {club.stadium}
              </div>
              {/* L'entraîneur n'est plus affiché ici, et c'est délibéré.
                  Le référentiel donnait un nom écrit en dur, faux pour trois
                  clubs sur cinq testés. La base sportive n'est pas fiable non
                  plus sur ce champ : vérifié le 9 août 2026, elle donnait encore
                  Guardiola à Manchester City alors qu'il était parti depuis
                  juin. Aucune source bon marché n'étant sûre, mieux vaut ne rien
                  afficher. L'agent VIP, lui, croise la recherche web et répond
                  correctement à la question. */}
            </div>

            <div className="flex gap-2 justify-center md:justify-start">
              {/* La forme vient du classement en cours. Celle du référentiel
                  était figée à la saisie du fichier. */}
              {(classement?.forme ?? []).map((res, i) => (
                <span key={i} className={`w-8 h-8 rounded-[14px] flex items-center justify-center text-[10px] font-black border ${
                  res === "W" ? "bg-success/10 text-success border-success/20" : 
                  res === "D" ? "bg-warning/10 text-warning border-warning/20" : 
                  "bg-danger/10 text-danger border-danger/20"
                }`}>
                  {res}
                </span>
              ))}
            </div>
          </div>

          <Link href="/pricing" className="px-6 py-3 bg-warning text-black text-xs font-black rounded-[16px] uppercase tracking-tighter hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-warning/20">
            <Brain className="w-4 h-4 fill-black" /> Analyse Pro Elite
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Squad */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Overview */}
          {/* Ces quatre cartes affichaient un xG, une possession, des buts et des
              clean sheets tirés du référentiel figé — à zéro pour la plupart des
              clubs. Elles montrent maintenant ce que le classement en cours
              permet de constater. xG et possession ont disparu : le classement ne
              les fournit pas, et il n'y a aucune raison d'afficher un chiffre
              qu'on ne mesure pas. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Matchs joués" value={saisonDemarree ? String(classement!.joues) : "—"} icon={Activity} />
            <StatCard label="Victoires" value={saisonDemarree ? String(classement!.victoires) : "—"} icon={Target} />
            <StatCard label="Buts marqués" value={saisonDemarree ? String(classement!.butsMarques) : "—"} icon={TrendingUp} />
            <StatCard label="Buts encaissés" value={saisonDemarree ? String(classement!.butsEncaisses) : "—"} icon={Shield} />
          </div>

          {/* Squad Section */}
          <div className="bg-card border border-border-card rounded-[28px] overflow-hidden">
            <div className="px-8 py-6 border-b border-border-card flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Effectif Clé
              </h3>
              {/* Le libellé de saison était écrit en dur et affichait encore
                  2024-25. Il suit désormais la saison réellement en cours. */}
              {saison && <span className="text-xs text-foreground/40 font-medium">Saison {saison}</span>}
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
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
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
          <div className="bg-primary p-8 rounded-[28px] text-white space-y-6 shadow-xl shadow-primary/20 relative overflow-hidden group">
            <Brain className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-500" />
            <h3 className="text-xl font-bold flex items-center gap-2">
               Insight Tactique <Info className="w-4 h-4 opacity-50" />
            </h3>
            {/* Ce bloc affirmait un style de jeu, un pourcentage de possession et
                un xG tirés du référentiel statique — des valeurs à zéro pour la
                plupart des clubs, et attribuées à un entraîneur souvent parti.
                Une accroche ne doit rien affirmer qu'on n'a pas mesuré. */}
            <p className="text-sm leading-relaxed text-white/80">
              L'analyse complète de {club.name} — forme réelle, absents, confrontations
              directes et lecture tactique — est calculée à la demande sur les données
              du moment, match par match.
            </p>
            <Link href="/pricing" className="block w-full py-4 bg-white text-primary text-center font-black rounded-[20px] text-xs uppercase tracking-widest hover:bg-opacity-90 transition-opacity">
              Débloquer Analyse IA Avancée
            </Link>
          </div>

          <div className="bg-card border border-border-card p-8 rounded-[28px] space-y-6">
            {/* Ce bloc annonçait « Précision des prédictions : 82 % », valeur
                écrite directement dans le code, avec une barre de progression
                calée dessus. Aucune mesure derrière. La précision réelle est
                calculée à partir des pronostics confrontés aux résultats, et
                elle est présentée sur la page IA Center — elle est globale, pas
                propre à un club, donc elle n'a pas sa place ici. */}
            <h3 className="font-bold text-sm uppercase tracking-widest text-foreground/50">Performance IA</h3>
            <div className="space-y-3">
              <p className="text-sm text-foreground/60 leading-relaxed">
                Chaque pronostic est confronté au résultat réel du match une fois
                celui-ci joué.
              </p>
              <Link href="/ia-center" className="inline-block text-xs font-bold text-primary hover:underline">
                Voir la précision constatée
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-card border border-border-card p-6 rounded-[20px] space-y-3">
      <div className="w-8 h-8 rounded-[14px] bg-primary/10 flex items-center justify-center text-primary">
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
