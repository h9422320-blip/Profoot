/**
 * LE PARTAGE DU MOIS — LA SOUSTRACTION, EN ENTIER, SOUS LES YEUX.
 *
 * ── POURQUOI CE BANDEAU EST UN COMPOSANT À PART ───────────────────────────
 *
 * Il porte les seuls chiffres que le propriétaire et son partenaire refont
 * vraiment tous les mois. Séparé de la page, il se regarde au navigateur avec
 * des montants d'exemple, sans ouvrir la session de personne — et c'est ainsi
 * qu'on vérifie qu'une colonne tient sur un téléphone avant de l'annoncer.
 *
 * Il ne calcule RIEN : tout arrive déjà tranché par `calculerEconomie`, qui
 * lui-même s'appuie sur `partage.ts`. Un second calcul ici finirait par
 * diverger du premier, et c'est exactement le défaut que ce bandeau existe
 * pour rendre impossible.
 */
import type { EconomiePartenaires } from "@/lib/partenaires";
import PoulsBoutique from "./PoulsBoutique";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

export default function PartageDuMois({
  eco,
  moisCourant,
  recettesMoisMaketou,
  ventesMoisMaketou,
  signaturePouls,
  heureDeLecture,
  chezMaketou,
}: {
  eco: EconomiePartenaires;
  /** « septembre 2026 », tel qu'il s'affiche. */
  moisCourant: string;
  /** Le chiffre de la boutique, et lui seul (décision du 10 septembre 2026). */
  recettesMoisMaketou: number;
  ventesMoisMaketou: number;
  /** L'empreinte du pouls, pour que la page se refasse à chaque vente. */
  signaturePouls: string;
  /** L'heure de lecture, passée par la page : un composant ne lit pas l'horloge. */
  heureDeLecture: string;
  /** Ce que la boutique retient encore, tous mois confondus. */
  chezMaketou: number;
}) {
  // Trois chiffres qui doivent s'additionner sous les yeux : ce qui rentre, ce
  // qui sort, ce qui reste. C'est la seule vérification qu'on refait vraiment
  // tous les mois.
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-[#8b5cf6]/30 bg-gradient-to-br from-[#8b5cf6]/12 via-[#16242e] to-[#111d25] p-6 sm:p-7">
        {/* Le témoin de direct est posé au même endroit que le titre du
            partage : c'est le chiffre du mois qu'on veut savoir vivant,
            pas la page en général. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a78bfa]">
            Partage de {moisCourant}
          </p>
          <PoulsBoutique signature={signaturePouls} />
        </div>

        {/* ── LE PARTAGE DOIT S'ADDITIONNER SOUS LES YEUX ────────────────
            Il ne montrait que trois nombres : encaissé, part du partenaire,
            reste. Les frais de boutique s'évaporaient entre les deux
            derniers — le projet semblait garder 765 167 FCFA en août quand
            il en garde 605 118. Les deux montants voisins étaient pourtant
            exacts chacun de son côté, et rien ne permettait de voir où
            passaient les 160 050 francs manquants.

            Un partage qui ne tombe pas juste fait douter des trois nombres
            à la fois. La commission a donc sa colonne.

            ── ET LES FRAIS DE FONCTIONNEMENT AUSSI, LE 27 SEPTEMBRE 2026 ──

            Ils étaient déjà retirés du calcul, mais écrits en petit sous la
            commission de la boutique. Le propriétaire a ouvert la page et
            ne les a pas vus : « fais en sorte que les 25 dollars soient
            déduits du chiffre d'affaires comme les frais de boutique ».
            Ils l'étaient — invisiblement, ce qui revient au même. Une
            déduction qu'on ne voit pas est une déduction qu'on refait à la
            main en fin de mois. */}
        <div className="mt-5 grid grid-cols-2 xl:grid-cols-5 gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              Recettes encaissées
            </p>
            {/* ── LE CHIFFRE DE LA BOUTIQUE, ET LUI SEUL ──────────────
                Cette place portait le PRIX DE VENTE — 812 500 le
                10 septembre 2026 — pendant que MakeTou affichait 771 630.
                Deux nombres justes, deux conventions, et un propriétaire
                qui doit expliquer l'écart à l'influenceur qu'il rémunère.

                Décision du propriétaire, le 10 septembre 2026 : la page
                parle la langue de la boutique. Le prix de vente ne
                disparaît pas — il reste sous la part du partenaire, là
                où il sert au calcul et nulle part ailleurs. */}
            <p className="text-[26px] sm:text-[32px] leading-none font-black text-white tabular-nums mt-2 tracking-tight">
              {fcfa(recettesMoisMaketou)}
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/35">
              {ventesMoisMaketou} ventes · le nombre lisible sur MakeTou
            </p>
          </div>
          {/* Un filet entre les colonnes sur grand écran : les quatre
              nombres se lisent alors comme une seule soustraction, de
              gauche à droite, au lieu de quatre chiffres posés côte à
              côte. Il disparaît sur petit écran, où la grille passe à deux
              colonnes et où un filet ne relierait plus rien. */}
          <div className="xl:border-l xl:border-white/[0.08] xl:pl-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              Frais de boutique
            </p>
            <p className="text-[26px] sm:text-[32px] leading-none font-black text-white/50 tabular-nums mt-2 tracking-tight">
              −{fcfa(eco.fraisBoutiqueMoisXof)}
            </p>
            {/* ── LE PRIX DE VENTE NE S'AFFICHE NULLE PART ────────────
                Décision du propriétaire, le 10 septembre 2026, répétée
                quatre fois : un seul chiffre d'affaires à l'écran, celui
                de la boutique. Deux nombres voisins appelés du même nom
                l'ont obligé à justifier un écart devant l'influenceur
                qu'il rémunère — et ce doute-là coûte plus cher que la
                vérifiabilité du calcul. */}
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/35">
              prélevés par MakeTou sur chaque vente
            </p>
          </div>

          {/* ── LES FRAIS DE FONCTIONNEMENT, À LEUR PLACE DANS LA SOUSTRACTION ──
              Ce que l'application paie pour tourner — Claude, OpenRouter,
              Supabase, Vercel, API-Football — se retire du chiffre
              d'affaires AVANT le partage, au même titre que la commission
              de la boutique. La colonne porte le total du mois, et le
              détail outil par outil vit dans le bloc du dessous.

              Elle s'affiche même à zéro : une colonne qui disparaît quand
              le mois n'a rien coûté ne se distingue pas d'une déduction
              oubliée. */}
          <div className="xl:border-l xl:border-white/[0.08] xl:pl-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              Frais de fonctionnement
            </p>
            <p className="text-[26px] sm:text-[32px] leading-none font-black text-white/50 tabular-nums mt-2 tracking-tight">
              −{fcfa(eco.depensesMoisXof)}
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/35">
              {fcfa(eco.netMoisXof)} nets
            </p>
          </div>
          <div className="xl:border-l xl:border-white/[0.08] xl:pl-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              Part des partenaires
            </p>
            <p className="text-[26px] sm:text-[32px] leading-none font-black text-[#a78bfa] tabular-nums mt-2 tracking-tight">
              −{fcfa(eco.partPartenairesMoisXof)}
            </p>
            {/* « 35 % du net » ne disait pas de quel net. Le propriétaire a
                inscrit 15 000 FCFA de frais et a cru qu'ils n'étaient pas
                retirés de cette part — ils l'étaient, mais rien ne le montrait.
                Le montant sur lequel porte le pourcentage est donc écrit. */}
            <p className="text-[11px] text-white/30 mt-0.5 tabular-nums">
              {eco.partTotalePct} % de {fcfa(eco.netMoisXof)} nets
            </p>
          </div>
          <div className="xl:border-l xl:border-[#10b981]/25 xl:pl-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              Reste au projet
            </p>
            <p className="text-[26px] sm:text-[32px] leading-none font-black text-[#10b981] tabular-nums mt-2 tracking-tight">
              {fcfa(eco.resteAuProjetMoisXof)}
            </p>
            {/* Ce qui reste ne se déduit pas d'un second pourcentage mais d'une
                SOUSTRACTION (voir `partage.ts`) : l'écrire évite qu'on cherche
                les 65 % et qu'on tombe à un franc près à côté. */}
            <p className="text-[11px] text-white/30 mt-0.5 tabular-nums">
              {fcfa(eco.netMoisXof)} &minus; {fcfa(eco.partPartenairesMoisXof)}
            </p>
          </div>
        </div>

        {/* ── QUI PAIE LES FRAIS, ET COMBIEN ────────────────────────────
            Demande du propriétaire, le 27 septembre 2026 : « dès que
            l'influenceur rentre là-bas, il voit ça automatiquement, il
            comprend ». Les frais sont retirés AVANT le partage, donc supportés
            par les deux — mais un partenaire qui lit « −15 000 » en haut et
            « 35 % » plus loin ne fait pas le lien tout seul, et se demande si
            la retenue ne tombe que sur lui.

            Les deux montants viennent du même calcul que les parts, par
            différence : ils totalisent exactement les frais, au franc près. */}
        {eco.fraisBoutiqueMoisXof + eco.depensesMoisXof > 0 && (
          <p className="text-[11.5px] text-white/45 mt-5 leading-relaxed">
            Les{" "}
            <strong className="font-black text-white/70 tabular-nums">
              {fcfa(eco.fraisBoutiqueMoisXof + eco.depensesMoisXof)}
            </strong>{" "}
            de frais du mois ({fcfa(eco.fraisBoutiqueMoisXof)} de boutique et{" "}
            {fcfa(eco.depensesMoisXof)} de fonctionnement) sont retirés avant le partage : ils
            sont donc supportés par les deux, chacun à hauteur de sa part —{" "}
            <span className="text-[#a78bfa] font-bold tabular-nums">
              {fcfa(eco.fraisPortesParPartenairesXof)}
            </span>{" "}
            pour {eco.nombrePartenaires > 1 ? "les partenaires" : "le partenaire"} et{" "}
            <span className="text-[#10b981] font-bold tabular-nums">
              {fcfa(eco.fraisPortesParLeProjetXof)}
            </span>{" "}
            pour le projet.
          </p>
        )}

        {/* L'heure de lecture est ici pour être confrontée au tableau de
            bord Chariow. Le 22 août 2026, cette page annonçait 325 000 FCFA
            et la boutique 336 000 : les deux étaient justes, lus à vingt
            minutes d'écart, et rien à l'écran ne permettait de s'en
            apercevoir. On a cherché une erreur de calcul là où il n'y avait
            qu'un écart d'horloge. */}
        <p className="text-[11px] text-white/35 mt-5 leading-relaxed">
          Mois en cours, arrêté à aujourd'hui — ces montants montent encore à chaque vente.
          Rendu à{" "}
          <span className="text-white/60 font-bold tabular-nums">{heureDeLecture}</span>, puis
          refait tout seul dès qu'une vente entre chez MakeTou : ce que vous lisez est l'instant
          présent, pas une photographie.
        </p>

        {/* ── CE PARTAGE PORTE SUR DE L'ARGENT PAS ENCORE REÇU ──────────
            Les quatre chiffres du dessus sont exacts, et pourtant aucun
            d'eux n'est en banque : MakeTou garde les recettes jusqu'au
            retrait. « Entrées en attente : 39 900, solde retirable : 0 »,
            au 28 août 2026.

            Ce n'est pas une erreur de calcul, c'est un risque de
            trésorerie — verser une part avant d'avoir encaissé se paie
            avec sa propre poche. Il doit se lire au même endroit que le
            montant dû, pas se découvrir le jour du virement. */}
        {chezMaketou > 0 && (
          <p className="text-[11.5px] text-amber-200/60 mt-2.5 leading-relaxed">
            <strong className="font-black text-amber-200/90">{fcfa(chezMaketou)}</strong> de
            ces recettes sont encore chez MakeTou et ne sont pas retirables à ce jour, tous
            mois confondus. Le détail est en bas de page.
          </p>
        )}
    </div>
  );
}
