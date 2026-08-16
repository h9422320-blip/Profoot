import Link from "next/link";
import { CheckCircle2, Crosshair, ShieldCheck } from "lucide-react";
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
      ? "text-[#FBBF24] bg-[#FBBF24]/10 border-[#FBBF24]/25"
      : "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border whitespace-nowrap ${styles}`}
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

  return (
    <div className="bg-[#1d2f3a]/60 backdrop-blur-md border border-[#10B981]/15 rounded-[20px] p-4 shadow-sm flex flex-col gap-3">
      {/* En-tête : compétition et date. La compétition passe à la ligne si elle
          est longue ; la date, elle, ne rétrécit jamais. */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35 leading-tight min-w-0">
          {libelleCompetition(p.competition) ?? "Match"}
        </span>
        {date && (
          <span className="text-[10px] font-semibold text-white/30 shrink-0">{date}</span>
        )}
      </div>

      {/* LES DEUX ÉQUIPES, L'UNE SOUS L'AUTRE.
          Les mettre côte à côte laissait moins de 110 pixels par nom sur un
          téléphone : « Borussia Monchengladbach » y était coupé. Empilées,
          chacune dispose de toute la largeur de la carte, et le nom passe à la
          ligne plutôt que d'être tronqué — un nom d'équipe amputé enlève
          justement ce qui rend la preuve vérifiable. */}
      <div className="flex flex-col gap-2">
        {[
          { nom: p.equipe1, logo: p.logo1 },
          { nom: p.equipe2, logo: p.logo2 },
        ].map((e, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {e.logo ? (
              <img src={e.logo} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" />
            ) : (
              <span className="w-6 h-6 shrink-0" />
            )}
            <span className="text-[13px] font-extrabold text-white/90 leading-tight min-w-0">
              {e.nom}
            </span>
          </div>
        ))}
      </div>

      {/* Le cœur de la preuve : ce qui était annoncé, ce qui s'est passé. */}
      <div className="rounded-[16px] bg-white/[0.04] divide-y divide-white/5">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0">
            Pronostic ProFoot
          </span>
          <span className="text-[13px] font-black text-white tabular-nums shrink-0">
            {p.pronoScore ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0">
            Résultat réel
          </span>
          <span className="text-[13px] font-black text-[#10B981] tabular-nums shrink-0">
            {p.scoreReel ?? "—"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge>
          <CheckCircle2 className="w-3 h-3" />
          Réussi
        </Badge>
        {p.scoreExact && (
          <Badge ton="or">
            <Crosshair className="w-3 h-3" />
            Score exact
          </Badge>
        )}
        <span className="text-[10px] text-white/30 leading-tight">
          {libelleIssue(p.pronoIssue, p.equipe1, p.equipe2)}
        </span>
      </div>
    </div>
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
    },
    { valeur: bilan.reussites, libelle: bilan.reussites > 1 ? "pronostics réussis" : "pronostic réussi" },
    bilan.competitions > 1 && { valeur: bilan.competitions, libelle: "compétitions" },
  ].filter(Boolean) as { valeur: number; libelle: string }[];

  return (
    <section className="space-y-3.5">
      {avecEntete && (
      <div className="flex items-center justify-between gap-3 px-1">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">
          Nos pronostics vérifiés
        </h4>
        {total > preuves.length && (
          <Link
            href="/preuves"
            // Quarante-quatre pixels de haut : c'est la taille d'un pouce sur
            // un écran tactile. Un lien plus petit se rate une fois sur trois.
            className="text-[10px] font-black uppercase tracking-wider text-[#10B981] hover:text-[#2DD4BF] transition-colors shrink-0 min-h-[44px] px-2 -mr-2 flex items-center"
          >
            Voir tout
          </Link>
        )}
      </div>
      )}

      {/* Bandeau. Les repères s'empilent proprement si l'écran est étroit. */}
      <div className="rounded-[20px] border border-[#10B981]/20 bg-[#10B981]/[0.06] p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="text-[12px] font-black text-white leading-tight">
            Annoncés avant le match, confirmés après
          </span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {reperes.map((r) => (
            <div key={r.libelle} className="min-w-0">
              <span className="block text-[22px] font-black text-[#10B981] leading-none tabular-nums">
                {r.valeur}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mt-1 whitespace-nowrap">
                {r.libelle}
              </span>
            </div>
          ))}
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
