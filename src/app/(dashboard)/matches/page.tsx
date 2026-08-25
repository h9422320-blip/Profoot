import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Radio, CheckCircle2, CalendarX } from "lucide-react";
import { lireMatchsReels, type MatchReel } from "@/lib/matchs-reels";
import { HeureMatch } from "@/components/HeureMatch";

/**
 * Le calendrier des matchs, en données réelles.
 *
 * CETTE PAGE ÉTAIT ÉCRITE À LA MAIN
 *
 * Elle affichait des rencontres datées d'avril et mai 2026, avec des scores et
 * des « pronostics » inventés — confiance comprise. C'est resté sans
 * conséquence tant que la page était fermée ; la publier telle quelle aurait
 * mis ces chiffres dans Google sous le nom du site.
 *
 * RENDUE PAR LE SERVEUR, ET C'EST LE POINT
 *
 * Le contenu doit se trouver dans la page envoyée, pas être chargé ensuite par
 * le navigateur : c'est la condition pour qu'un moteur de recherche le lise.
 * C'est aussi ce qui la rend lisible tout de suite sur une connexion lente.
 *
 * AUCUN PRONOSTIC ICI
 *
 * Cette page montre le calendrier et les résultats. Les prédictions vivent
 * dans l'analyse — le produit payant — et sur le mur de preuves, qui ne montre
 * que du vérifié.
 */

export const metadata: Metadata = {
  title: "Matchs du jour et résultats",
  description:
    "Le calendrier des matchs de football : rencontres du jour, à venir et résultats des grands championnats européens. Mis à jour en continu par ProFoot AI.",
  alternates: { canonical: "https://profootai.com/matches" },
};

// Régénérée toutes les dix minutes : les scores bougent, mais chaque visiteur
// ne doit pas déclencher un appel au fournisseur.
export const revalidate = 600;

export default async function MatchesPage() {
  const matchs = await lireMatchsReels();

  const duJour = matchs.filter((m) => m.statut === "aujourdhui");
  const aVenir = matchs.filter((m) => m.statut === "a_venir");
  // Reportées et annulées : elles tombaient dans « à venir » et s'affichaient
  // avec la date d'hier, ce qui se lit comme un bug plutôt que comme un report.
  const reportes = matchs.filter((m) => m.statut === "reporte");
  // Les résultats sont plafonnés : deux cents cartes de plus n'apportent rien à
  // un lecteur et alourdissent une page consultée presque uniquement au
  // téléphone.
  const termines = matchs
    .filter((m) => m.statut === "termine")
    .reverse()
    .slice(0, 45);

  return (
    <div className="space-y-10 pb-20 pt-4">
      <header className="space-y-2">
        <h1
          className="text-3xl sm:text-4xl font-black text-white tracking-tight"
          style={{ fontFamily: "var(--police-titre), sans-serif" }}
        >
          Matchs de football
        </h1>
        <p className="text-foreground/50 text-sm font-semibold">
          Rencontres du jour, à venir et résultats — {matchs.length} matchs suivis dans les grands
          championnats
        </p>
      </header>

      {matchs.length === 0 && (
        // Une section vide se dit franchement plutôt que d'inventer un
        // calendrier : c'est précisément ce que faisait l'ancienne version.
        <p className="text-sm text-white/40 py-10 text-center">
          Aucune rencontre à afficher pour le moment. Revenez d&apos;ici quelques heures.
        </p>
      )}

      <Section titre="En cours et aujourd'hui" icone={<Radio className="w-4 h-4" />} matchs={duJour} />
      <Section titre="À venir" icone={<CalendarDays className="w-4 h-4" />} matchs={aVenir} />
      <Section titre="Résultats" icone={<CheckCircle2 className="w-4 h-4" />} matchs={termines} />
      <Section
        titre="Reportés ou annulés"
        icone={<CalendarX className="w-4 h-4" />}
        matchs={reportes}
      />
    </div>
  );
}

function Section({
  titre,
  icone,
  matchs,
}: {
  titre: string;
  icone: React.ReactNode;
  matchs: MatchReel[];
}) {
  if (matchs.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary">
        {icone}
        {titre}
        <span className="text-white/25 font-bold">{matchs.length}</span>
      </h2>

      {/* Une colonne sur téléphone : deux cartes côte à côte sur 360 pixels
          rendent les noms de club illisibles. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {matchs.map((m) => (
          <Carte key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
}

function Carte({ m }: { m: MatchReel }) {
  const heure = new Date(m.date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const jour = new Date(m.date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
  const joue = m.buts1 !== null && m.buts2 !== null;

  return (
    // Chaque carte mène à sa fiche : c'est ce qui relie les pages entre elles
    // et permet à un moteur de découvrir les rencontres depuis cette liste.
    <Link
      href={`/match/${m.id}`}
      className="block rounded-[20px] border border-border-card bg-card/60 p-4 space-y-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 truncate">
          {m.competition}
        </span>
        <span className="text-[10px] font-bold text-white/40 shrink-0">
          {m.minute !== null ? (
            <span className="text-primary">{m.minute}&apos;</span>
          ) : m.statut === "reporte" ? (
            // La date prévue n'a plus de valeur : l'annoncer sèchement laisserait
            // croire que la rencontre se joue encore ce jour-là.
            <span className="text-amber-400/80">Reporté</span>
          ) : (
            // Le serveur ne peut pas connaître le fuseau du lecteur : cette
            // page est mise en cache et servie identique au monde entier.
            // Le navigateur corrige l'heure dès son arrivée.
            <HeureMatch iso={m.date} repliJour={jour} repliHeure={heure} />
          )}
        </span>
      </div>

      <div className="space-y-2">
        <Equipe nom={m.equipe1} logo={m.logo1} buts={joue ? m.buts1 : null} />
        <Equipe nom={m.equipe2} logo={m.logo2} buts={joue ? m.buts2 : null} />
      </div>

      {m.stade && <p className="text-[10px] text-white/25 truncate">{m.stade}</p>}
    </Link>
  );
}

function Equipe({
  nom,
  logo,
  buts,
}: {
  nom: string;
  logo: string | null;
  buts: number | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Balise <img> et non next/image : ces logos viennent de dizaines de
          domaines et changent à chaque journée de championnat. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img src={logo} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" />}
      <span className="text-[14px] font-bold text-white truncate flex-1">{nom}</span>
      {buts !== null && (
        <span className="text-[15px] font-black text-white tabular-nums shrink-0">{buts}</span>
      )}
    </div>
  );
}
