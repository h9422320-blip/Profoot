import Image from "next/image";
import { BadgeCheck, Quote } from "lucide-react";
import type { Ambassadeur } from "@/lib/ambassadeurs";

/**
 * Les ambassadeurs, sur la page d'accueil.
 *
 * PLACÉE SOUS LA PROMESSE, JAMAIS À SA PLACE
 *
 * Un visiteur qui arrive ne connaît ni le produit ni la personne. Il doit
 * d'abord comprendre ce qu'on lui propose ; le visage vient ensuite confirmer
 * que d'autres y croient. L'ordre inverse vendrait quelqu'un plutôt qu'un
 * outil.
 *
 * PENSÉE POUR UN TÉLÉPHONE D'ABORD
 *
 * Presque tous les visiteurs sont sur mobile. Le portrait occupe donc toute la
 * largeur, la citation passe dessous, et rien n'est mis côte à côte avant les
 * grands écrans — deux colonnes sur 360 pixels donnent deux colonnes
 * illisibles.
 */
export default function SectionAmbassadeurs({
  ambassadeurs,
}: {
  ambassadeurs: Ambassadeur[];
}) {
  // Aucun ambassadeur : la section n'existe pas. Pas de cadre vide sur la page
  // la plus vue du site.
  if (ambassadeurs.length === 0) return null;

  const seul = ambassadeurs.length === 1;

  return (
    <section className="relative px-4 sm:px-6 py-14 sm:py-20 overflow-hidden">
      {/* Halo discret : il détache la section du fond sans introduire une
          nouvelle couleur. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[520px] max-w-full rounded-full bg-[#10B981]/[0.07] blur-[110px]"
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] text-[#10B981]">
            Ils portent ProFoot
          </p>
          <h2 className="mt-2.5 text-[26px] leading-[1.15] sm:text-4xl font-black text-white tracking-tight">
            Nos ambassadeurs
          </h2>
        </div>

        <div
          className={`grid gap-6 sm:gap-7 ${
            seul ? "max-w-md mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {ambassadeurs.map((a) => (
            <figure
              key={a.id}
              className="rounded-[26px] border border-white/10 bg-white/[0.03] overflow-hidden backdrop-blur-sm"
            >
              {/* Rapport fixe 4/5 : le cadre garde la même hauteur quelle que
                  soit la photo envoyée, et la page ne sursaute pas au
                  chargement. `object-cover` recadre sans jamais déformer un
                  visage. */}
              <div className="relative w-full aspect-[4/5] bg-[#0d1720]">
                <Image
                  src={a.photoUrl!}
                  alt={`${a.nom}, ${a.role}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover object-top"
                  priority={false}
                />
                {/* Dégradé vers le bas : le nom posé sur la photo reste lisible
                    quelle que soit l'image. */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a141b] via-[#0a141b]/70 to-transparent" />

                <figcaption className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[19px] sm:text-xl font-black text-white tracking-tight">
                      {a.nom}
                    </span>
                    <BadgeCheck className="w-[18px] h-[18px] text-[#10B981] shrink-0" />
                  </div>
                  <span className="mt-1 inline-flex items-center rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#10B981]">
                    {a.role}
                  </span>
                </figcaption>
              </div>

              <blockquote className="p-4 sm:p-5">
                <Quote className="w-5 h-5 text-[#10B981]/50 mb-2" aria-hidden />
                {/* `break-words` : un mot très long collé sans espace est le
                    seul texte capable de déborder d'un écran de 360 pixels. */}
                <p className="text-[15px] sm:text-base leading-relaxed text-white/80 break-words">
                  {a.citation}
                </p>
              </blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
