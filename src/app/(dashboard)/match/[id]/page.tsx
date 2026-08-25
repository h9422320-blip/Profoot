import type { Metadata } from "next";
import { InstantLocal } from "@/components/HeureMatch";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Brain, Radio, CalendarDays } from "lucide-react";
import { lireFicheMatch } from "@/lib/match-reel-fiche";

/**
 * La fiche publique d'une rencontre.
 *
 * CE QU'ELLE ÉTAIT
 *
 * Elle lisait la liste écrite à la main : une vingtaine de matchs d'avril et
 * mai 2026, avec des scores et des pronostics inventés. Toute autre rencontre
 * renvoyait une page introuvable — y compris celles que la page publique des
 * matchs venait d'afficher, ce qui menait le visiteur dans un mur.
 *
 * CE QU'ELLE EST
 *
 * La rencontre réelle, lue chez le fournisseur : score, buteurs, stade,
 * arbitre, compétition. Rendue par le SERVEUR, avec un balisage d'événement
 * sportif.
 *
 * AUCUN PRONOSTIC ICI. La prédiction est le produit payant : elle vit dans
 * l'analyse, vers laquelle cette page renvoie.
 */

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const m = await lireFicheMatch(id);
  if (!m) return { title: "Rencontre introuvable" };

  const affiche = `${m.equipe1} — ${m.equipe2}`;
  const titre = m.termine
    ? `${affiche} : ${m.buts1}-${m.buts2}, résultat et buteurs`
    : `${affiche} : date, heure et informations`;

  const description = m.termine
    ? `${affiche} s'est terminé sur le score de ${m.buts1}-${m.buts2}${m.competition ? ` en ${m.competition}` : ""}. Buteurs, stade et détails de la rencontre.`
    : `${affiche}${m.competition ? ` en ${m.competition}` : ""}${m.stade ? `, au ${m.stade}` : ""}. Toutes les informations sur la rencontre, et l'analyse IA de ProFoot.`;

  return {
    title: titre,
    description,
    alternates: { canonical: `https://profootai.com/match/${m.id}` },
    openGraph: { title: titre, description },
  };
}

export default async function FicheRencontre({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await lireFicheMatch(id);
  if (!m) notFound();

  const joue = m.buts1 !== null && m.buts2 !== null;
  const quand = new Date(m.date);

  return (
    <div className="space-y-8 pb-20 pt-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `${m.equipe1} — ${m.equipe2}`,
            startDate: m.date,
            eventStatus: m.termine
              ? "https://schema.org/EventScheduled"
              : "https://schema.org/EventScheduled",
            sport: "Football",
            url: `https://profootai.com/match/${m.id}`,
            ...(m.stade
              ? { location: { "@type": "Place", name: m.stade, address: m.ville ?? undefined } }
              : {}),
            competitor: [
              { "@type": "SportsTeam", name: m.equipe1 },
              { "@type": "SportsTeam", name: m.equipe2 },
            ],
          }),
        }}
      />

      {/* Fil d'Ariane : Google l'affiche à la place de l'adresse dans ses
          résultats, et il se lit — contrairement à une URL. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: "https://profootai.com" },
              { "@type": "ListItem", position: 2, name: "Matchs", item: "https://profootai.com/matches" },
              {
                "@type": "ListItem",
                position: 3,
                name: `${m.equipe1} — ${m.equipe2}`,
                item: `https://profootai.com/match/${m.id}`,
              },
            ],
          }),
        }}
      />

      <header className="rounded-[24px] border border-border-card bg-card/60 p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary truncate">
            {m.competition ?? "Rencontre"}
          </span>
          <span className="text-[11px] font-bold text-white/40 shrink-0 inline-flex items-center gap-1.5">
            {m.enCours ? (
              <>
                <Radio className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary">{m.minute}&apos;</span>
              </>
            ) : (
              <>
                <CalendarDays className="w-3.5 h-3.5" />
                <InstantLocal iso={m.date} rendu="date-longue" repli={quand.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} />
              </>
            )}
          </span>
        </div>

        {/* Le score au centre, les deux équipes de part et d'autre : c'est la
            disposition qu'attend n'importe quel amateur de football, et elle
            tient sur une largeur de téléphone. */}
        <div className="flex items-center justify-between gap-3">
          <Camp nom={m.equipe1} logo={m.logo1} />
          <div className="shrink-0 text-center px-2">
            {joue ? (
              <p className="text-[34px] sm:text-[42px] leading-none font-black text-white tabular-nums">
                {m.buts1} <span className="text-white/30">-</span> {m.buts2}
              </p>
            ) : (
              <p className="text-[22px] font-black text-white/70 tabular-nums">
                <InstantLocal iso={m.date} rendu="heure" repli={quand.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} />
              </p>
            )}
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mt-1.5">
              {m.termine ? "Terminé" : m.enCours ? "En cours" : "À venir"}
            </p>
          </div>
          <Camp nom={m.equipe2 ?? ""} logo={m.logo2} />
        </div>

        {(m.stade || m.arbitre) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/40 pt-1">
            {m.stade && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {m.stade}
                {m.ville ? `, ${m.ville}` : ""}
              </span>
            )}
            {m.arbitre && <span>Arbitre : {m.arbitre}</span>}
          </div>
        )}
      </header>

      {m.buteurs.length > 0 && (
        <section className="rounded-[20px] border border-border-card bg-card/60 p-5 space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Buteurs</h2>
          <ul className="space-y-2">
            {m.buteurs.map((b, i) => (
              <li key={i} className="flex items-center gap-3 text-[13px]">
                <span className="w-10 shrink-0 font-black text-white/50 tabular-nums">
                  {b.minute !== null ? `${b.minute}'` : "—"}
                </span>
                <span className="font-bold text-white truncate">{b.joueur ?? "Buteur inconnu"}</span>
                <span className="text-white/35 truncate">{b.equipe}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/analyze"
        className="flex items-center justify-center gap-2 w-full sm:w-auto sm:self-start px-6 py-4 min-h-[52px] rounded-full font-black text-[14px] text-[#06231a] bg-primary hover:bg-primary/90 transition"
      >
        <Brain className="w-4 h-4" />
        {m.termine ? "Analyser un prochain match avec l'IA" : "Analyser cette rencontre avec l'IA"}
      </Link>
    </div>
  );
}

function Camp({ nom, logo }: { nom: string; logo: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img src={logo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />}
      <span className="text-[13px] sm:text-[15px] font-black text-white text-center leading-tight line-clamp-2">
        {nom}
      </span>
    </div>
  );
}
