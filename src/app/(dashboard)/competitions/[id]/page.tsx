import type { Metadata } from "next";
import Link from "next/link";
import { competitions } from "@/lib/data";
import { getSeasonLabel } from "@/lib/api-football";
import { listerClubsDuChampionnat } from "@/lib/club-reel";
import CompetitionClient from "./CompetitionClient";

/**
 * La page d'une compétition.
 *
 * POURQUOI UNE ENVELOPPE SERVEUR
 *
 * L'écran de la compétition est un composant client de près de cinq cents
 * lignes — calendrier, tableau final, matchs en direct. Tout y est chargé par
 * le navigateur : un moteur de recherche recevait donc une page vide, et cette
 * page n'avait ni titre ni description propres.
 *
 * Plutôt que de tout réécrire, le serveur pose ici ce qui doit être lu : le
 * nom de la compétition, la saison, et la liste des clubs engagés. L'écran
 * interactif reste dessous, inchangé.
 *
 * LES LIENS COMPTENT AUTANT QUE LE TEXTE
 *
 * Chaque club listé renvoie vers sa fiche. Une compétition crée ainsi une
 * vingtaine de liens internes — c'est en les suivant qu'un moteur découvre les
 * huit cents fiches, plutôt qu'en se fiant au seul plan du site.
 */

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const comp = competitions.find((c) => c.id === id);
  if (!comp) return { title: "Compétition introuvable" };

  const saison = getSeasonLabel(id);
  const titre = `${comp.name} — classement, calendrier et résultats`;
  const description = `${comp.name} ${saison} : classement, calendrier des matchs, résultats et analyses par intelligence artificielle. Suivez la compétition sur ProFoot AI.`;

  return {
    title: titre,
    description,
    alternates: { canonical: `https://profootai.com/competitions/${id}` },
    openGraph: { title: titre, description, images: comp.logo ? [comp.logo] : undefined },
  };
}

export default async function PageCompetition({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const comp = competitions.find((c) => c.id === id);
  const clubs = await listerClubsDuChampionnat(id);
  const saison = getSeasonLabel(id);

  return (
    <>
      {/* Ce bloc est rendu par le SERVEUR : c'est lui que lit un moteur de
          recherche, et lui qui s'affiche en premier sur une connexion lente. */}
      {comp && (
        <section className="sr-only">
          <h1>
            {comp.name} — saison {saison}
          </h1>
          <p>
            Classement, calendrier des matchs, résultats et analyses par intelligence artificielle
            de {comp.name}
            {comp.country ? ` (${comp.country})` : ""}.
          </p>
          {clubs.length > 0 && (
            <>
              <h2>Les {clubs.length} clubs engagés</h2>
              <ul>
                {clubs.map((c) => (
                  <li key={c.id}>
                    <Link href={`/club/${c.id}`}>{c.nom}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <CompetitionClient />

      {/* Les mêmes liens, visibles cette fois : un lecteur qui descend jusqu'ici
          veut souvent la fiche d'une équipe précise. */}
      {clubs.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
            Les clubs de la compétition
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {clubs.map((c) => (
              <Link
                key={c.id}
                href={`/club/${c.id}`}
                className="flex items-center gap-2 rounded-[14px] border border-border-card bg-card/60 px-3 py-2.5 hover:border-primary/40 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.logo && <img src={c.logo} alt="" className="w-5 h-5 object-contain shrink-0" loading="lazy" />}
                <span className="text-[12px] font-bold text-white truncate">{c.nom}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
