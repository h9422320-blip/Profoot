import Link from "next/link";
import { Check, Crosshair, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import {
  getPreuvesPubliques,
  libelleCompetition,
  libelleIssue,
  type BilanPreuves,
  type Preuve,
} from "@/lib/preuves";

/**
 * Nos pronostics vérifiés.
 *
 * POURQUOI CETTE SECTION EXISTE
 *
 * Sept inscrits sur dix lancent une analyse ; moins de deux sur cent
 * s'abonnent. Ce n'est pas le prix qui bloque : rien ne prouve au visiteur que
 * l'IA tombe juste. Il voit une analyse floutée à 85 % et doit payer pour
 * savoir si elle vaut quelque chose. Personne ne fait ça.
 *
 * Ici, on montre gratuitement, avant tout paywall, des pronostics émis AVANT
 * le match et confrontés au résultat réel.
 *
 * CE QUI A ÉTÉ REPRIS LE 17 AOÛT 2026 — L'APPARENCE, ET ELLE SEULE
 *
 * La preuve était là, mais elle avait l'allure d'une note de bas de page :
 * un titre gris de dix pixels, trois nombres alignés sans hiérarchie, et le
 * pronostic empilé sous le résultat — deux lignes qu'il fallait LIRE pour
 * comprendre qu'elles disaient la même chose. Or c'est cette coïncidence qui
 * vend. Elle doit se voir, pas se déchiffrer.
 *
 * Rien n'a changé de ce qui est affiché : mêmes preuves, mêmes décomptes,
 * même règle de publication. Seule la mise en forme a été refaite.
 *
 * CONÇUE POUR UN TÉLÉPHONE
 *
 * Quasiment tous les visiteurs arrivent depuis un mobile. Une carte par ligne,
 * jamais de tableau, jamais de largeur fixe. Aucun texte n'est tronqué : les
 * noms passent à la ligne. Un nom d'équipe amputé enlève justement ce qui rend
 * la preuve vérifiable. Les scores utilisent des chiffres à chasse fixe pour ne
 * pas danser d'une carte à l'autre.
 */

function Badge({
  children,
  ton = "vert",
}: {
  children: React.ReactNode;
  ton?: "vert" | "or";
}) {
  const styles =
    ton === "or"
      ? "text-[#FDE047] bg-[#FBBF24]/12 border-[#FBBF24]/35 shadow-[0_0_18px_-6px_rgba(251,191,36,0.7)]"
      : "text-[#34D399] bg-[#10B981]/12 border-[#10B981]/30";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.1em] px-2.5 py-1.5 rounded-full border whitespace-nowrap ${styles}`}
    >
      {children}
    </span>
  );
}

function CartePreuve({ p }: { p: Preuve }) {
  const date = p.dateMatch
    ? new Date(p.dateMatch).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      })
    : null;

  // Un score exact est rare : la carte le porte d'elle-même, en or, avant même
  // qu'on lise le badge.
  const or = p.scoreExact;

  return (
    <article
      className={`relative overflow-hidden rounded-[22px] border p-4 flex flex-col gap-3.5 ${
        or
          ? "border-[#FBBF24]/30 bg-gradient-to-br from-[#FBBF24]/[0.08] via-[#1d2f3a]/70 to-[#1d2f3a]/70"
          : "border-[#10B981]/20 bg-gradient-to-br from-[#10B981]/[0.06] via-[#1d2f3a]/70 to-[#1d2f3a]/70"
      }`}
    >
      {/* Halo d'angle : il donne du relief à la carte sans rien recouvrir. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-14 -right-10 w-32 h-32 rounded-full blur-3xl ${
          or ? "bg-[#FBBF24]/15" : "bg-[#10B981]/12"
        }`}
      />

      <div className="relative flex flex-col gap-3.5">
        {/* En-tête : compétition et date. La compétition passe à la ligne si elle
            est longue ; la date, elle, ne rétrécit jamais. */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <span className="text-[9.5px] font-black uppercase tracking-[0.14em] text-white/40 leading-tight min-w-0">
            {libelleCompetition(p.competition) ?? "Match"}
          </span>
          {date && (
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/30 shrink-0">
              {date}
            </span>
          )}
        </div>

        {/* LES DEUX ÉQUIPES, L'UNE SOUS L'AUTRE.
            Les mettre côte à côte laissait moins de 110 pixels par nom sur un
            téléphone : « Borussia Monchengladbach » y était coupé. Empilées,
            chacune dispose de toute la largeur de la carte, et le nom passe à la
            ligne plutôt que d'être tronqué — un nom d'équipe amputé enlève
            justement ce qui rend la preuve vérifiable. */}
        <div className="flex flex-col gap-2.5">
          {[
            { nom: p.equipe1, logo: p.logo1 },
            { nom: p.equipe2, logo: p.logo2 },
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-3">
              {e.logo ? (
                <span className="w-8 h-8 shrink-0 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                </span>
              ) : (
                <span className="w-8 h-8 shrink-0" />
              )}
              <span className="text-[14.5px] font-black text-white leading-tight min-w-0">
                {e.nom}
              </span>
            </div>
          ))}
        </div>

        {/* LE CŒUR DE LA PREUVE.
            Avant : « pronostic » puis « résultat », deux lignes empilées qu'il
            fallait lire l'une après l'autre pour constater qu'elles disaient la
            même chose. Face à face, la coïncidence se voit d'un seul coup d'œil.

            Le signe du milieu est une COCHE, jamais un signe égal : un pronostic
            réussi sans être exact (2-1 annoncé, 3-1 joué) reste une réussite,
            et écrire « = » entre deux scores différents serait faux. */}
        <div className="rounded-[18px] border border-white/[0.07] bg-black/25 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 text-center">
              <span className="block text-[8.5px] font-black uppercase tracking-[0.12em] text-white/35 leading-tight">
                Annoncé avant
              </span>
              <span className="block mt-1.5 text-[20px] font-black text-white tabular-nums leading-none">
                {p.pronoScore ?? "—"}
              </span>
            </div>

            <span
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border ${
                or
                  ? "bg-[#FBBF24]/15 border-[#FBBF24]/40 text-[#FDE047]"
                  : "bg-[#10B981]/15 border-[#10B981]/40 text-[#34D399]"
              }`}
            >
              {or ? <Crosshair className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </span>

            <div className="flex-1 min-w-0 text-center">
              <span className="block text-[8.5px] font-black uppercase tracking-[0.12em] text-[#34D399]/70 leading-tight">
                Résultat réel
              </span>
              <span className="block mt-1.5 text-[20px] font-black text-[#34D399] tabular-nums leading-none">
                {p.scoreReel ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge>
            <Check className="w-3 h-3" strokeWidth={3} />
            Réussi
          </Badge>
          {p.scoreExact && (
            <Badge ton="or">
              <Crosshair className="w-3 h-3" />
              Score exact
            </Badge>
          )}
          <span className="text-[10px] font-semibold text-white/35 leading-tight">
            {libelleIssue(p.pronoIssue, p.equipe1, p.equipe2)}
          </span>
        </div>
      </div>
    </article>
  );
}

export default async function SectionPreuves({
  // Huit cartes coupaient des réussites du jour : la victoire du Barça et
  // celle du Real, toutes deux justes, tombaient hors du mur. Un visiteur ne
  // fait pas défiler indéfiniment, mais rien de correct ne doit disparaître
  // faute de place.
  limite = 16,
  avecEntete = true,
}: {
  limite?: number;
  /** Faux sur la page dediee, qui porte deja son propre titre. */
  avecEntete?: boolean;
}) {
  const { preuves, bilan, total } = await getPreuvesPubliques(limite);
  return <MurPreuves preuves={preuves} bilan={bilan} total={total} avecEntete={avecEntete} />;
}

/**
 * L affichage seul, sans lecture en base.
 *
 * Separe du composant qui interroge la base pour pouvoir etre rendu avec des
 * donnees fournies — c est ainsi que la mise en page est verifiee sur un ecran
 * de telephone avant livraison.
 */
export function MurPreuves({
  preuves,
  bilan,
  total,
  avecEntete = true,
}: {
  preuves: Preuve[];
  bilan: BilanPreuves;
  total: number;
  avecEntete?: boolean;
}) {

  // Aucune preuve encore vérifiée : la section ne s'affiche pas du tout. Un
  // bloc vide qui annonce « bientôt des preuves » ne rassure personne — il
  // souligne l'absence.
  if (!preuves.length) return null;

  // Chaque chiffre du bandeau est un décompte de réussites réelles, jamais un
  // taux : un pourcentage calculé sur des preuves choisies serait faux.
  const reperes = [
    bilan.scoresExacts > 0 && {
      valeur: bilan.scoresExacts,
      libelle: bilan.scoresExacts > 1 ? "scores exacts" : "score exact",
      ton: "or" as const,
    },
    {
      valeur: bilan.reussites,
      libelle: bilan.reussites > 1 ? "pronostics réussis" : "pronostic réussi",
      ton: "vert" as const,
    },
    bilan.competitions > 1 && {
      valeur: bilan.competitions,
      libelle: "compétitions",
      ton: "blanc" as const,
    },
  ].filter(Boolean) as { valeur: number; libelle: string; ton: "or" | "vert" | "blanc" }[];

  const colonnes =
    reperes.length >= 3 ? "grid-cols-3" : reperes.length === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <section className="space-y-4">
      {avecEntete && (
        <header className="px-1 flex flex-col gap-3">
          <span className="inline-flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-[#34D399]">
            <Sparkles className="w-3 h-3" />
            Preuves publiques
          </span>

          {/* LE TITRE. Il était en dix pixels, gris, en capitales : une étiquette
              administrative posée sur ce que le site a de plus convaincant. */}
          <h2 className="text-[23px] sm:text-[30px] font-black text-white leading-[1.08] tracking-tight">
            L&apos;IA l&apos;avait dit{" "}
            <span className="bg-gradient-to-r from-[#10B981] to-[#2DD4BF] bg-clip-text text-transparent">
              avant tout le monde
            </span>
          </h2>

          <p className="text-[12.5px] text-white/50 leading-relaxed max-w-prose">
            Des millions de données analysées.{" "}
            <span className="text-white/75 font-semibold">
              Voici les résultats, vérifiés un par un.
            </span>
          </p>

          {total > preuves.length && (
            <Link
              href="/preuves"
              // Quarante-quatre pixels de haut : c'est la taille d'un pouce sur
              // un écran tactile. Un lien plus petit se rate une fois sur trois.
              className="self-start inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 text-[11px] font-black uppercase tracking-wider text-[#34D399] hover:bg-[#10B981]/20 hover:border-[#10B981]/50 transition-colors"
            >
              Voir les {total} preuves
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </header>
      )}

      {/* LE BANDEAU DE CHIFFRES.
          Trois nombres de vingt-deux pixels posés côte à côte se lisaient comme
          une note technique. Ce sont pourtant les seuls chiffres du site qu'on
          peut vérifier un par un : ils méritent la place. */}
      <div className="relative overflow-hidden rounded-[24px] border border-[#10B981]/25 bg-gradient-to-br from-[#10B981]/[0.13] via-[#12303a]/60 to-[#1d2f3a]/40 p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-12 w-52 h-52 rounded-full bg-[#10B981]/20 blur-3xl"
        />

        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#34D399] shrink-0" />
            <span className="text-[12px] font-black text-white leading-tight">
              Annoncés avant le match, confirmés après
            </span>
          </div>

          <div className={`grid ${colonnes} divide-x divide-white/10`}>
            {reperes.map((r) => (
              <div key={r.libelle} className="px-3 first:pl-0 last:pr-0 min-w-0">
                <span
                  className={`block text-[32px] sm:text-[36px] font-black leading-none tabular-nums ${
                    r.ton === "or"
                      ? "text-[#FDE047] drop-shadow-[0_0_14px_rgba(251,191,36,0.35)]"
                      : r.ton === "vert"
                        ? "text-[#34D399] drop-shadow-[0_0_14px_rgba(16,185,129,0.35)]"
                        : "text-white/90"
                  }`}
                >
                  {r.valeur}
                </span>
                {/* Neuf pixels, mais à 55 % de blanc : à 45 % le libellé se
                    perdait sous le chiffre. Il tient sur deux lignes dans un
                    tiers d'écran de téléphone — mesuré, pas supposé. */}
                <span className="block mt-2 text-[9px] font-black uppercase tracking-[0.1em] text-white/55 leading-[1.3]">
                  {r.libelle}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Une colonne au pouce, deux puis trois quand la place le permet. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {preuves.map((p) => (
          <CartePreuve key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
