import Link from "next/link";
import {
  ArrowRight, CalendarDays, Coins, Handshake, Percent, Users, Wallet,
} from "lucide-react";
import { calculerEconomie, getPartenaires } from "@/lib/partenaires";
import {
  heureDeLecture,
  recettesParJour,
  retireDeMaketouXof,
  surcoutAcheteurMaketou,
  tauxMaketou,
  totalMaketou,
  TAUX_MAKETOU_ACHETEUR,
} from "@/lib/recettes-boutique";
import { DERNIER_JOUR_CHARIOW, TAUX_CHARIOW } from "@/lib/recettes-histoire";
import Reconciliation from "./Reconciliation";
import PoulsBoutique from "./PoulsBoutique";
import { Indicateur } from "../_components/Indicateur";
import { Panneau } from "../_components/Panneaux";
import { EnTete } from "../_components/EnTete";
import { Etiquette, Puce, Vide, dateCourte, ilYA } from "../_components/Ui";

export const dynamic = "force-dynamic";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/**
 * Suivi des partenaires ambassadeurs.
 *
 * Un partenaire n'est plus payé aux vues mais à la part du chiffre d'affaires :
 * il est associé au projet. La page répond donc à une question simple — ce mois
 * ci, combien le projet a-t-il encaissé, et combien lui revient-il.
 *
 * Aucun montant n'est saisi à la main. Tout se déduit des abonnements
 * réellement encaissés : un chiffre recopié finit toujours par diverger de la
 * réalité, et c'est sur celui-là qu'on paie quelqu'un.
 */
export default async function PartenairesPage() {
  const partenaires = await getPartenaires();
  const eco = calculerEconomie(partenaires);
  const moisCourant = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // ── LE DÉTAIL JOUR PAR JOUR, DEPUIS LE DÉBUT DU CONTRAT ─────────────────
  //
  // Un total mensuel ne se vérifie pas. Deux personnes se partagent cet
  // argent, et chacune doit pouvoir suivre le calcul jusqu'à la journée —
  // sinon la seule façon de contrôler est de faire confiance.
  //
  // Le 28 août 2026, un écart de 2 000 francs sur la journée du 27 a été
  // repéré ainsi, à l'œil, en comparant une ligne avec l'écran de la
  // boutique : une vente créée le 26 au soir et réglée le 27 au matin était
  // comptée du mauvais côté de minuit.
  const departContrat =
    partenaires.map((p) => p.remuneration_depuis).filter(Boolean).sort()[0] ?? null;
  const parJour = await recettesParJour();
  const jours = Object.entries(parJour ?? {})
    .filter(([j]) => !departContrat || j >= String(departContrat).slice(0, 10))
    .sort(([a], [b]) => b.localeCompare(a)); // le plus récent en haut
  const cumul = jours.reduce(
    (t, [, p]) => ({
      xof: t.xof + p.xof,
      frais: t.frais + (p.fraisXof ?? 0),
      ventes: t.ventes + p.ventes,
    }),
    { xof: 0, frais: 0, ventes: 0 }
  );
  const partPct = partenaires[0]?.part_ca_pct ?? 0;
  const net = Math.max(0, cumul.xof - cumul.frais);

  // ── LE RAPPROCHEMENT AVEC L'ÉCRAN DE MAKETOU ────────────────────────────
  //
  // Cette page comptera toujours moins que le tableau de bord de la boutique,
  // et c'est normal : MakeTou affiche ce que l'ACHETEUR a payé, nous comptons
  // le prix de vente. Le 28 août 2026, 42 840 là-bas contre 42 000 ici, pour
  // les mêmes 21 ventes — les 840 francs sont un supplément versé en plus du
  // prix, qui n'est jamais entré chez nous.
  //
  // Le calcul est fait sur TOUTE l'ère MakeTou et non sur la période du
  // contrat : c'est ainsi que la boutique le présente, et un rapprochement qui
  // ne porte pas sur la même période ne rapproche rien.
  const mt = totalMaketou(parJour ?? {});
  const netMaketou = Math.max(0, mt.xof - mt.fraisXof);
  const surcoutMaketou = surcoutAcheteurMaketou(mt.xof);
  const afficheMaketou = mt.xof + surcoutMaketou;

  // ── ACQUIS N'EST PAS ENCAISSÉ ───────────────────────────────────────────
  //
  // « Entrées en attente : 39 900. Solde retirable : 0. » Tout ce que la page
  // appelle recette dort encore chez la boutique tant qu'un retrait n'a pas
  // été fait. Un partenaire payé sur cet argent-là est payé sur une promesse,
  // et le risque est pour le projet, pas pour lui.
  const retireMaketou = retireDeMaketouXof();
  const chezMaketou = Math.max(0, netMaketou - retireMaketou);

  // ── L'EMPREINTE DE L'INSTANT ────────────────────────────────────────────
  //
  // Deux nombres suffisent à savoir si quelque chose a bougé : le nombre de
  // ventes et leur total. Le battement côté navigateur les redemande au
  // serveur ; tant qu'ils sont identiques, rien n'est reconstruit.
  //
  // Elle se calcule ici, à partir de ce que la page AFFICHE, et pas à partir
  // d'une seconde lecture : une empreinte prise ailleurs que sur ce qui est à
  // l'écran finirait par diverger de lui.
  const signaturePouls = `${mt.ventes}:${mt.xof}`;

  return (
    <div className="space-y-6">
      <EnTete
        titre="Partenaires"
        sousTitre="Ambassadeurs rémunérés au pourcentage du chiffre d'affaires mensuel"
        icone={<Handshake className="w-6 h-6" />}
        teinte="violet"
        reperes={[
          { libelle: "Partenaires", valeur: String(eco.nombrePartenaires) },
          { libelle: "Part reversée", valeur: `${eco.partTotalePct} %`, accent: true },
          { libelle: `Recettes ${moisCourant}`, valeur: fcfa(eco.recettesMoisXof) },
        ]}
      />

      {/* ── LE CONTRÔLE DES CHIFFRES, AVANT LES CHIFFRES ────────────────────
          Le 23 août 2026, le propriétaire a signalé trois fois en une journée
          que cette page « ne collait pas ». Les trois fois, le calcul était
          juste : deux périodes différentes, des ventes tombées entre la capture
          d'écran et la vérification, un autre écran.

          Le défaut n'était pas dans le calcul — il était dans l'impossibilité
          de le vérifier sans ouvrir un terminal. Ce panneau confronte le total
          de la page à la caisse, dit sur quelle période, et explique l'écart
          normal avec la vue d'ensemble. */}
      <Reconciliation partenaire={partenaires[0]} />

      {partenaires.length === 0 ? (
        <Panneau titre="Aucun partenaire" sousTitre="La table est vide">
          <Vide message="Ajoutez un partenaire dans la table partners, puis réglez sa part depuis sa fiche." />
        </Panneau>
      ) : (
        <>
          {/* ── Le partage du mois ──────────────────────────────────────────
              Trois chiffres qui doivent s'additionner sous les yeux : ce qui
              rentre, ce qui sort, ce qui reste. C'est la seule vérification
              qu'on refait vraiment tous les mois. */}
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
                à la fois. La commission a donc sa colonne. */}
            <div className="mt-5 grid grid-cols-2 xl:grid-cols-4 gap-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Recettes encaissées
                </p>
                <p className="text-[26px] sm:text-[32px] leading-none font-black text-white tabular-nums mt-2 tracking-tight">
                  {fcfa(eco.recettesMoisXof)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Frais de boutique
                </p>
                <p className="text-[26px] sm:text-[32px] leading-none font-black text-white/50 tabular-nums mt-2 tracking-tight">
                  −{fcfa(eco.fraisBoutiqueMoisXof)}
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {fcfa(eco.netMoisXof)} nets
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Part des partenaires
                </p>
                <p className="text-[26px] sm:text-[32px] leading-none font-black text-[#a78bfa] tabular-nums mt-2 tracking-tight">
                  −{fcfa(eco.partPartenairesMoisXof)}
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {eco.partTotalePct} % du net
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Reste au projet
                </p>
                <p className="text-[26px] sm:text-[32px] leading-none font-black text-[#10b981] tabular-nums mt-2 tracking-tight">
                  {fcfa(eco.resteAuProjetMoisXof)}
                </p>
              </div>
            </div>

            {/* L'heure de lecture est ici pour être confrontée au tableau de
                bord Chariow. Le 22 août 2026, cette page annonçait 325 000 FCFA
                et la boutique 336 000 : les deux étaient justes, lus à vingt
                minutes d'écart, et rien à l'écran ne permettait de s'en
                apercevoir. On a cherché une erreur de calcul là où il n'y avait
                qu'un écart d'horloge. */}
            <p className="text-[11px] text-white/35 mt-5 leading-relaxed">
              Mois en cours, arrêté à aujourd'hui — ces montants montent encore à chaque vente.
              Rendu à{" "}
              <span className="text-white/60 font-bold tabular-nums">{heureDeLecture()}</span>, puis
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Indicateur
              libelle="Partenaires"
              valeur={eco.nombrePartenaires}
              teinte="violet"
              icone={<Users className="w-4 h-4" />}
            />
            <Indicateur
              libelle="Part du chiffre d'affaires"
              valeur={`${eco.partTotalePct} %`}
              teinte="or"
              icone={<Percent className="w-4 h-4" />}
              aide="Total reversé chaque mois"
            />
            <Indicateur
              libelle="Dû ce mois-ci"
              valeur={fcfa(eco.partPartenairesMoisXof)}
              teinte="violet"
              icone={<Coins className="w-4 h-4" />}
              aide="À verser en fin de mois"
            />
            <Indicateur
              libelle="Dû depuis le début"
              valeur={fcfa(eco.duCumuleXof)}
              teinte="cyan"
              icone={<Wallet className="w-4 h-4" />}
              aide="Tous mois confondus"
            />
          </div>

          {/* Les forfaits d'avant le nouveau modèle ont réellement été versés.
              Les faire disparaître de l'écran ferait paraître le partenariat
              moins cher qu'il ne l'a été. */}
          {eco.verseXof > 0 && (
            <p className="text-[12px] text-white/40 px-1">
              S'ajoute <strong className="text-white/70">{fcfa(eco.verseXof)}</strong> de forfaits
              déjà versés sous l'ancien contrat, avant le passage au pourcentage.
            </p>
          )}

          {/* ── Chaque partenaire, et l'historique, côte à côte ───────────
              Deux colonnes sur grand écran : la liste seule laissait la moitié
              droite vide, sur une page faite justement pour comparer des
              chiffres. */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <div className="xl:col-span-3">
          <Panneau
            titre="Les partenaires"
            sousTitre="Part réglable individuellement depuis chaque fiche"
            icone={<Handshake className="w-4 h-4" />}
            teinte="violet"
          >
            <div className="space-y-3">
              {partenaires.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/partenaires/${p.id}`}
                  className="block rounded-[20px] border border-[#2e4757] bg-[#1a2b36] p-5 hover:border-[#8b5cf6]/50 hover:bg-[#1d2f3a] transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-white text-[17px] tracking-tight">
                          {p.name}
                        </span>
                        <Puce texte={`${p.part_ca_pct} % du CA`} teinte="violet" />
                        {p.accesOuvert && <Etiquette tier={p.accesOuvert} />}
                        {!p.inscrit && <Puce texte="Pas encore inscrit" teinte="neutre" />}
                      </div>
                      <p className="text-[13px] text-white/45 mt-1.5 truncate">{p.email}</p>
                      <p className="text-[12px] text-white/35 mt-1">
                        {p.remuneration_depuis
                          ? `Rémunéré depuis le ${dateCourte(p.remuneration_depuis)}`
                          : "Aucune date de départ — rien ne lui est compté"}
                        {p.derniereConnexion && ` · vu ${ilYA(p.derniereConnexion)}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                        Dû ce mois-ci
                      </p>
                      <p className="text-[26px] leading-none font-black text-[#a78bfa] tabular-nums mt-1">
                        {fcfa(p.duMoisEnCoursXof)}
                      </p>
                      {/* ── LA MULTIPLICATION DOIT RETOMBER SUR SES PIEDS ───
                          Cette ligne annonçait « 35 % de 1 117 000 FCFA » sous
                          un montant de 334 478, qui est 35 % du NET. Les deux
                          ne pouvaient pas être vraies ensemble : 35 % du brut
                          font 390 950.

                          C'est la carte de la personne qu'on paie. Un écart de
                          56 472 francs entre le montant affiché et celui qu'on
                          obtient en refaisant le calcul soi-même ne s'explique
                          pas — il se soupçonne. */}
                      <p className="text-[12px] text-white/35 mt-1.5 tabular-nums">
                        {fcfa(p.recettesMoisEnCoursXof)} &minus;{" "}
                        {fcfa(p.fraisMoisEnCoursXof)} de frais de boutique
                      </p>
                      <p className="text-[12px] text-white/55 tabular-nums">
                        = {p.part_ca_pct} % de {fcfa(p.netMoisEnCoursXof)} nets
                      </p>
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#8b5cf6] mt-2">
                        Ouvrir <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Panneau>
            </div>

            {/* Historique mois par mois du partenaire principal : il occupe la
                colonne de droite et répond à la question qu'on se pose juste
                après « combien ce mois-ci » — combien les mois d'avant. */}
            <div className="xl:col-span-2">
              <Panneau
                titre="Mois par mois"
                sousTitre={partenaires[0]?.name ?? ""}
                icone={<CalendarDays className="w-4 h-4" />}
                teinte="cyan"
              >
                {(partenaires[0]?.mois ?? []).length === 0 ? (
                  <p className="text-[13px] text-white/40 py-3">
                    Aucune date de départ réglée : rien n'est encore compté.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {partenaires[0].mois.map((m) => (
                      <div
                        key={m.mois}
                        className={`flex items-center justify-between gap-3 rounded-[16px] border px-4 py-3.5 ${
                          m.clos
                            ? "border-[#2e4757] bg-[#1a2b36]"
                            : "border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.07]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-black text-white capitalize tracking-tight">
                            {m.libelle}
                          </p>
                          {/* ── LE CHEMIN DU CHIFFRE, ÉCRIT EN ENTIER ──────────
                              La part porte sur ce qui RESTE après la boutique,
                              jamais sur ce qui entre. Afficher seulement le
                              chiffre d'affaires et le montant dû laisserait
                              deux personnes recalculer chacune de leur côté —
                              et l'écart entre les deux lectures dépassait
                              cinquante mille francs sur le seul mois d'août. */}
                          <p className="text-[12px] text-white/35 mt-0.5 tabular-nums">
                            {fcfa(m.recettesXof)} encaissés · {m.ventes} vente
                            {m.ventes > 1 ? "s" : ""}
                          </p>
                          <p className="text-[12px] text-white/35 tabular-nums">
                            &minus; {fcfa(m.fraisBoutiqueXof)} de frais de boutique
                          </p>
                          <p className="text-[12px] font-bold text-white/60 tabular-nums">
                            = {fcfa(m.netXof)} nets, dont {partenaires[0].part_ca_pct} %
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[18px] leading-none font-black text-[#a78bfa] tabular-nums">
                            {fcfa(m.duXof)}
                          </p>
                          {!m.clos && (
                            <p className="text-[10px] font-bold text-[#a78bfa]/70 uppercase tracking-wider mt-1">
                              en cours
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panneau>

              {/* ── LE DÉTAIL QUI PERMET DE VÉRIFIER ────────────────────────
                  Chaque journée porte le taux de la boutique qui l'a
                  encaissée : 15 % chez Chariow jusqu'au 27 août, puis MakeTou.
                  Un taux moyen appliqué au total donnerait un prélèvement que
                  personne n'a jamais opéré. */}
              <div className="mt-6">
                <Panneau
                  titre="Jour par jour"
                  sousTitre={`Depuis le début du contrat · frais retenus au taux de chaque boutique`}
                  icone={<CalendarDays className="w-4 h-4" />}
                  teinte="cyan"
                >
                  {jours.length === 0 ? (
                    <Vide message="Aucune recette sur la période." />
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12.5px] tabular-nums">
                          <thead>
                            <tr className="text-white/35 text-left">
                              <th className="py-2 pr-3 font-bold">Date</th>
                              <th className="py-2 pr-3 font-bold text-right">Ventes</th>
                              <th className="py-2 pr-3 font-bold text-right">Encaissé</th>
                              <th className="py-2 pr-3 font-bold text-right">Frais</th>
                              <th className="py-2 font-bold text-right">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jours.map(([jour, p]) => (
                              <tr key={jour} className="border-t border-[#2e4757]">
                                <td className="py-2 pr-3 text-white/70">
                                  {dateCourte(jour)}
                                  <span className="text-white/25 ml-1.5 text-[11px]">
                                    {jour <= DERNIER_JOUR_CHARIOW ? "Chariow" : "MakeTou"}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-right text-white/50">{p.ventes}</td>
                                <td className="py-2 pr-3 text-right text-white/80">
                                  {Math.round(p.xof).toLocaleString("fr-FR")}
                                </td>
                                <td className="py-2 pr-3 text-right text-white/40">
                                  &minus;{Math.round(p.fraisXof ?? 0).toLocaleString("fr-FR")}
                                </td>
                                <td className="py-2 text-right font-bold text-white">
                                  {Math.round(p.xof - (p.fraisXof ?? 0)).toLocaleString("fr-FR")}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-[#8b5cf6]/40">
                              <td className="py-2.5 pr-3 font-black text-white">Total</td>
                              <td className="py-2.5 pr-3 text-right font-bold text-white/60">
                                {cumul.ventes}
                              </td>
                              <td className="py-2.5 pr-3 text-right font-black text-white">
                                {cumul.xof.toLocaleString("fr-FR")}
                              </td>
                              <td className="py-2.5 pr-3 text-right font-bold text-white/50">
                                &minus;{cumul.frais.toLocaleString("fr-FR")}
                              </td>
                              <td className="py-2.5 text-right font-black text-[#a78bfa]">
                                {net.toLocaleString("fr-FR")}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 rounded-[16px] border border-[#2e4757] bg-[#1a2b36] px-4 py-3.5 space-y-1.5">
                        <p className="text-[12.5px] text-white/50">
                          Net de la période :{" "}
                          <span className="font-bold text-white">{fcfa(net)}</span>
                        </p>
                        <p className="text-[12.5px] text-white/50">
                          Part du partenaire ({partPct} %) :{" "}
                          <span className="font-black text-[#a78bfa]">
                            {fcfa(Math.round((net * partPct) / 100))}
                          </span>
                        </p>
                        <p className="text-[12.5px] text-white/50">
                          Reste pour ProFoot ({100 - partPct} %) :{" "}
                          <span className="font-black text-emerald-300">
                            {fcfa(Math.round((net * (100 - partPct)) / 100))}
                          </span>
                        </p>
                      </div>

                      {/* ── RAPPROCHEMENT AVEC L'ÉCRAN DE LA BOUTIQUE ──────
                          Deux écrans qui parlent du même argent et n'affichent
                          pas le même nombre font douter des deux. Le 22 août
                          2026, vingt minutes d'écart d'horloge avec Chariow ont
                          fait chercher pendant une heure une erreur de calcul
                          qui n'existait pas.

                          Ici l'écart est permanent et parfaitement normal :
                          MakeTou affiche ce que l'ACHETEUR a payé, cette page
                          compte le prix de vente. Il est donc écrit ligne à
                          ligne, pour se vérifier à l'œil contre le tableau de
                          bord sans avoir à refaire un calcul. */}
                      {mt.ventes > 0 && (
                        <div className="mt-4 rounded-[16px] border border-[#2e4757] bg-[#1a2b36] px-4 py-3.5">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/40">
                            Rapprochement avec MakeTou
                          </p>
                          <div className="mt-2.5 space-y-1 text-[12.5px] tabular-nums">
                            <p className="text-white/50">
                              « Revenus totaux » chez MakeTou :{" "}
                              <span className="font-bold text-white">{fcfa(afficheMaketou)}</span>
                            </p>
                            <p className="text-white/50">
                              &minus; {fcfa(surcoutMaketou)} ajoutés aux acheteurs par la boutique
                              — cet argent ne vous a jamais appartenu
                            </p>
                            <p className="text-white/50">
                              = {fcfa(mt.xof)} de prix de vente sur {mt.ventes} vente
                              {mt.ventes > 1 ? "s" : ""}, &minus; {fcfa(mt.fraisXof)} de commission
                            </p>
                            <p className="text-white/75 font-bold pt-0.5">
                              = {fcfa(netMaketou)} qui vous reviennent — le « solde en attente » de
                              la boutique, au franc près
                            </p>
                          </div>

                          {/* ── ACQUIS N'EST PAS ENCAISSÉ ──────────────────
                              La boutique garde l'argent jusqu'au retrait. Rien
                              dans l'application ne peut le savoir : ce montant
                              est déclaré, et il est écrit qu'il l'est. Un
                              chiffre présenté comme mesuré alors qu'il est
                              saisi finit par ne plus être mis à jour, et
                              personne ne s'en aperçoit. */}
                          <div className="mt-3 rounded-[14px] border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3">
                            <p className="text-[12.5px] text-amber-100/75 leading-relaxed">
                              <strong className="font-black text-amber-200">
                                {fcfa(chezMaketou)}
                              </strong>{" "}
                              sont acquis mais pas encore retirables : MakeTou les conserve jusqu'au
                              retrait. Une part versée sur cet argent sort de votre poche avant
                              d'être entrée en caisse.
                            </p>
                            <p className="text-[11px] text-amber-100/40 mt-1.5">
                              {retireMaketou > 0
                                ? `${fcfa(retireMaketou)} déjà retirés, montant déclaré`
                                : "Aucun retrait déclaré à ce jour"} — se règle par la variable
                              MAKETOU_RETIRE_XOF, à mettre à jour après chaque retrait.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Le taux MakeTou est AFFICHÉ, pas caché dans le code :
                          c'est avec lui qu'on paie quelqu'un. Un chiffre faux
                          qu'on voit se corrige ; un chiffre faux qu'on ne voit
                          pas se paie. */}
                      <p className="mt-3 text-[11.5px] text-white/30 leading-relaxed">
                        Frais retenus : {Math.round(TAUX_CHARIOW * 100)} % jusqu'au{" "}
                        {dateCourte(DERNIER_JOUR_CHARIOW)} (Chariow), puis{" "}
                        {(tauxMaketou() * 100).toFixed(tauxMaketou() * 100 % 1 ? 1 : 0)} % (MakeTou),
                        retenus sur le vendeur. Taux confirmé le 28 août 2026 sur le relevé des
                        transactions, au franc près sur 21 ventes — il se règle par la variable
                        MAKETOU_COMMISSION_PCT et tous les mois se recalculent. Les{" "}
                        {Math.round(TAUX_MAKETOU_ACHETEUR * 100)} % ajoutés à l'acheteur n'entrent
                        dans aucun de ces calculs : ils ne transitent pas par vous.
                      </p>
                    </>
                  )}
                </Panneau>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
