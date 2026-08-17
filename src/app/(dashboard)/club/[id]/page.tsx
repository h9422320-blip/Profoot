import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Trophy, Activity, Brain } from "lucide-react";
import { lireClub, lireMatchsDuClub } from "@/lib/club-reel";

/**
 * La fiche publique d'un club.
 *
 * CE QU'ELLE ÉTAIT
 *
 * Une page lisant un référentiel écrit à la main : entraîneur « N/A », stade
 * « N/A », rang 0, effectif vide. Ouverte à Google telle quelle, elle aurait
 * produit huit cents pages sans contenu — ce qu'un moteur appelle une page
 * pauvre, et qui pénalise le site entier plutôt que de l'aider.
 *
 * CE QU'ELLE EST
 *
 * Nom, logo, pays, championnat, stade et classement du moment, tous réels, et
 * rendus par le SERVEUR pour que le moteur les lise dans la page envoyée.
 *
 * Chaque fiche est une porte d'entrée : quelqu'un qui cherche « classement
 * Real Madrid » peut arriver ici, puis découvrir l'analyse.
 */

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const club = await lireClub(id);
  if (!club) return { title: "Club introuvable" };

  // Le gabarit du site ajoute déjà « | ProFoot AI » : le répéter ici donnait
  // « … | ProFoot AI | ProFoot AI », que Google tronque.
  const titre = `${club.nom} — classement, forme et statistiques`;
  const description = club.classement
    ? `${club.nom} : ${club.classement.rang}ᵉ avec ${club.classement.points} points, ` +
      `${club.classement.victoires} victoires en ${club.classement.joues} matchs. ` +
      `Forme, buts marqués et encaissés — analysé par l'IA ProFoot.`
    : `${club.nom} : classement, forme et statistiques de la saison, analysés par l'intelligence artificielle ProFoot AI.`;

  return {
    title: titre,
    description,
    alternates: { canonical: `https://profootai.com/club/${club.id}` },
    openGraph: { title: titre, description, images: club.logo ? [club.logo] : undefined },
  };
}

export default async function FicheClub({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const club = await lireClub(id);
  if (!club) notFound();

  const c = club.classement;
  const rencontres = await lireMatchsDuClub(club.apiId);

  return (
    <div className="space-y-8 pb-20 pt-4">
      {/* Balisage de l'équipe : il aide le moteur à comprendre que cette page
          parle d'un club de football précis, et non d'un mot-clé. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsTeam",
            name: club.nom,
            sport: "Football",
            url: `https://profootai.com/club/${club.id}`,
            ...(club.logo ? { logo: club.logo } : {}),
            ...(club.pays ? { location: { "@type": "Place", name: club.pays } } : {}),
            ...(club.stade
              ? { homeLocation: { "@type": "StadiumOrArena", name: club.stade } }
              : {}),
          }),
        }}
      />

      {/* Fil d'Ariane.
          Il dit au moteur où cette page se situe dans le site, et Google
          l'affiche à la place de l'adresse dans ses résultats — « profootai.com
          › Clubs › Real Madrid » se lit, une URL non. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: "https://profootai.com" },
              {
                "@type": "ListItem",
                position: 2,
                name: "Classements",
                item: "https://profootai.com/standings",
              },
              {
                "@type": "ListItem",
                position: 3,
                name: club.nom,
                item: `https://profootai.com/club/${club.id}`,
              },
            ],
          }),
        }}
      />

      <header className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {club.logo && (
          <img src={club.logo} alt={club.nom} className="w-16 h-16 object-contain shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
            {club.nom}
          </h1>
          <p className="text-[13px] text-white/45 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {club.pays && <span>{club.pays}</span>}
            {club.stade && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {club.stade}
              </span>
            )}
            {club.saison && <span>Saison {club.saison}</span>}
          </p>
        </div>
      </header>

      {c ? (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Chiffre libelle="Classement" valeur={`${c.rang}ᵉ`} accent />
            <Chiffre libelle="Points" valeur={String(c.points)} />
            <Chiffre libelle="Matchs joués" valeur={String(c.joues)} />
            <Chiffre
              libelle="Différence de buts"
              valeur={`${c.butsMarques - c.butsEncaisses > 0 ? "+" : ""}${c.butsMarques - c.butsEncaisses}`}
            />
          </section>

          <section className="rounded-[20px] border border-border-card bg-card/60 p-5 space-y-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Bilan de la saison
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Bilan libelle="Victoires" valeur={c.victoires} teinte="text-[#10B981]" />
              <Bilan libelle="Nuls" valeur={c.nuls} teinte="text-white/70" />
              <Bilan libelle="Défaites" valeur={c.defaites} teinte="text-rose-400" />
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed">
              {club.nom} a marqué <strong className="text-white">{c.butsMarques}</strong> buts et en a
              encaissé <strong className="text-white">{c.butsEncaisses}</strong> en {c.joues} rencontres
              {club.championnat ? "" : ""}.
            </p>

            {c.forme.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Forme récente
                </span>
                <div className="flex gap-1">
                  {c.forme.map((f, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded-md text-[11px] font-black flex items-center justify-center ${
                        f === "W"
                          ? "bg-[#10B981]/20 text-[#10B981]"
                          : f === "D"
                            ? "bg-white/10 text-white/60"
                            : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {f === "W" ? "V" : f === "D" ? "N" : "D"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        // Aucun classement disponible — début de saison, ou compétition sans
        // classement. On le dit, plutôt que d'afficher des zéros qui ressemblent
        // à une donnée manquante.
        <p className="text-[13px] text-white/40 rounded-[20px] border border-border-card bg-card/60 p-5 flex items-center gap-2">
          <Activity className="w-4 h-4 shrink-0" />
          Le classement de {club.nom} n&apos;est pas encore disponible pour cette saison.
        </p>
      )}

      {rencontres.length > 0 && (
        // Les fiches de club ne renvoyaient vers AUCUN match : un visiteur venu
        // pour « classement Real Madrid » n'avait nulle part où aller ensuite,
        // et un moteur n'avait aucun lien à suivre vers les rencontres. Les deux
        // manques n'en font qu'un.
        <section className="space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
            Derniers matchs de {club.nom}
          </h2>
          <div className="space-y-2">
            {rencontres.map((r) => (
              <Link
                key={r.id}
                href={`/match/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-[16px] border border-border-card bg-card/60 px-4 py-3 hover:border-primary/40 transition-colors"
              >
                <span className="text-[13px] font-bold text-white truncate">
                  {r.equipe1} — {r.equipe2}
                </span>
                <span className="text-[14px] font-black text-white tabular-nums shrink-0">
                  {r.buts1 !== null && r.buts2 !== null
                    ? `${r.buts1} - ${r.buts2}`
                    : new Date(r.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Le seul appel à l'action de la page : c'est là que le visiteur venu de
          Google découvre le produit. */}
      <Link
        href="/analyze"
        className="flex items-center justify-center gap-2 w-full sm:w-auto sm:self-start px-6 py-4 min-h-[52px] rounded-full font-black text-[14px] text-[#06231a] bg-primary hover:bg-primary/90 transition"
      >
        <Brain className="w-4 h-4" />
        Analyser un match de {club.nom} avec l&apos;IA
      </Link>
    </div>
  );
}

function Chiffre({
  libelle,
  valeur,
  accent = false,
}: {
  libelle: string;
  valeur: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-border-card bg-card/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{libelle}</p>
      <p
        className={`text-[26px] leading-none font-black tabular-nums mt-1.5 ${
          accent ? "text-primary" : "text-white"
        }`}
      >
        {valeur}
      </p>
    </div>
  );
}

function Bilan({ libelle, valeur, teinte }: { libelle: string; valeur: number; teinte: string }) {
  return (
    <div>
      <p className={`text-[24px] font-black tabular-nums ${teinte}`}>{valeur}</p>
      <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider">{libelle}</p>
    </div>
  );
}
