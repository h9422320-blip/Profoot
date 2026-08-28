import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CalendarDays, Coins, Globe, Handshake, Mail, Percent, Wallet,
} from "lucide-react";
import { getPartenaire } from "@/lib/partenaires";
import { Panneau } from "../../_components/Panneaux";
import { Etiquette, Puce, dateCourte, ilYA, LienCompte } from "../../_components/Ui";
import { Indicateur } from "../../_components/Indicateur";
import ReglagePart from "../ReglagePart";
import PoulsBoutique from "../PoulsBoutique";
import { recettesParJour, totalMaketou } from "@/lib/recettes-boutique";

export const dynamic = "force-dynamic";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/**
 * Fiche d'un partenaire.
 *
 * Le partenaire est un associé : il touche un pourcentage des recettes du mois.
 * La fiche montre donc mois par mois ce que le projet a encaissé et ce qui lui
 * revient — aucun montant n'est saisi à la main, tout se déduit des abonnements
 * réellement encaissés.
 */
export default async function FichePartenaire({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getPartenaire(id);
  if (!p) notFound();

  const moisCourant = new Date().toISOString().slice(0, 7);

  // ── LA FICHE SUIT LA BOUTIQUE, ELLE AUSSI ───────────────────────────────
  //
  // C'est ici que le montant dû est le plus gros à l'écran, et il bouge à
  // chaque vente. L'empreinte se construit avec `totalMaketou`, exactement
  // comme sur la liste : une signature calculée autrement ne coïnciderait
  // jamais avec celle que l'action serveur recalcule, et la page se
  // reconstruirait en boucle.
  const mt = totalMaketou((await recettesParJour()) ?? {});
  const signaturePouls = `${mt.ventes}:${mt.xof}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/partenaires"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Tous les partenaires
        </Link>
        <PoulsBoutique signature={signaturePouls} />
      </div>

      {/* ── Identité ────────────────────────────────────────────────────── */}
      <div className="rounded-[26px] border border-[#8b5cf6]/30 bg-gradient-to-br from-[#8b5cf6]/12 via-[#16242e] to-[#111d25] p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* La même initiale que sur la liste : passer de l'une à l'autre ne
                doit pas donner l'impression de changer de page. */}
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] border border-[#8b5cf6]/30 bg-gradient-to-br from-[#8b5cf6]/35 to-[#8b5cf6]/5 text-[22px] font-black text-[#c4b5fd]">
              {p.name.trim().charAt(0).toUpperCase()}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">{p.name}</h1>
                <Puce texte={`${p.part_ca_pct} % du CA`} teinte="violet" />
                {p.accesOuvert && <Etiquette tier={p.accesOuvert} />}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-white/40">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {p.email}
                </span>
                {p.country && (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> {p.country}
                  </span>
                )}
                {p.handle && <span>{p.handle}</span>}
              </div>
              <p className="text-[11px] text-white/30 mt-2">
                {p.inscrit
                  ? `Inscrit le ${dateCourte(p.inscritLe!)}${p.derniereConnexion ? ` · vu ${ilYA(p.derniereConnexion)}` : ""}`
                  : "N'a pas encore créé son compte"}
                {p.userId && (
                  <>
                    {" · "}
                    <LienCompte userId={p.userId} email={p.email} />
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Dû ce mois-ci
            </p>
            <p className="text-3xl font-black text-[#a78bfa] tabular-nums">
              {fcfa(p.duMoisEnCoursXof)}
            </p>
            {/* ── LE MÊME DÉFAUT QUE SUR LA LISTE, AU MÊME ENDROIT ────────
                « 35 % de 1 117 000 FCFA » sous un montant qui est 35 % du NET.
                35 % du brut font 390 950 : les deux lignes ne pouvaient pas
                être vraies ensemble, et c'est la fiche que le partenaire
                consulte. */}
            <p className="text-[11px] text-white/30 mt-1 tabular-nums">
              {fcfa(p.recettesMoisEnCoursXof)} &minus; {fcfa(p.fraisMoisEnCoursXof)} de frais
            </p>
            <p className="text-[11px] text-white/45 tabular-nums">
              = {p.part_ca_pct} % de {fcfa(p.netMoisEnCoursXof)} nets
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Part convenue"
          valeur={`${p.part_ca_pct} %`}
          teinte="violet"
          icone={<Percent className="w-4 h-4" />}
          aide="du chiffre d'affaires mensuel"
        />
        <Indicateur
          libelle="Recettes du mois"
          valeur={fcfa(p.recettesMoisEnCoursXof)}
          teinte="cyan"
          icone={<Coins className="w-4 h-4" />}
          aide={`encaissées à ce jour · ${fcfa(p.netMoisEnCoursXof)} nets`}
        />
        <Indicateur
          libelle="Dû ce mois-ci"
          valeur={fcfa(p.duMoisEnCoursXof)}
          teinte="violet"
          icone={<Wallet className="w-4 h-4" />}
          aide="à verser en fin de mois"
        />
        <Indicateur
          libelle="Dû depuis le début"
          valeur={fcfa(p.duCumuleXof)}
          teinte="or"
          icone={<Handshake className="w-4 h-4" />}
          aide="tous mois confondus"
        />
      </div>

      {/* ── Réglage ─────────────────────────────────────────────────────── */}
      <Panneau
        titre="Rémunération"
        sousTitre="Le pourcentage et sa date d'entrée en vigueur"
        icone={<Percent className="w-4 h-4" />}
        teinte="violet"
      >
        <ReglagePart
          partnerId={p.id}
          partInitiale={p.part_ca_pct}
          depuisInitial={p.remuneration_depuis}
        />
      </Panneau>

      {/* ── Mois par mois ───────────────────────────────────────────────── */}
      <Panneau
        titre="Mois par mois"
        sousTitre="Ce que le projet a encaissé, et ce qui lui revient"
        icone={<CalendarDays className="w-4 h-4" />}
        teinte="cyan"
      >
        {p.mois.length === 0 ? (
          <p className="text-[13px] text-white/40 py-4">
            Aucune date de départ n'est réglée : rien ne lui est compté pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {p.mois.map((m) => (
              <div
                key={m.mois}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4 ${
                  m.clos
                    ? "border-[#2e4757] bg-[#1a2b36]"
                    : "border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.07]"
                }`}
              >
                <div>
                  <p className="text-[13px] font-black text-white capitalize">
                    {m.libelle}
                    {!m.clos && (
                      <span className="ml-2 text-[10px] font-bold text-[#a78bfa] uppercase tracking-wider">
                        en cours
                      </span>
                    )}
                  </p>
                  {/* Le chemin complet, comme sur la liste : sans la ligne des
                      frais, « 35 % du mois » posé à côté de recettes brutes
                      invite à une multiplication qui ne retombe pas sur le
                      montant affiché. */}
                  <p className="text-[11px] text-white/35 mt-0.5 tabular-nums">
                    {fcfa(m.recettesXof)} encaissés · {m.ventes} vente{m.ventes > 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] text-white/35 tabular-nums">
                    &minus; {fcfa(m.fraisBoutiqueXof)} de frais de boutique
                  </p>
                  <p className="text-[11px] font-bold text-white/55 tabular-nums">
                    = {fcfa(m.netXof)} nets
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[#a78bfa] tabular-nums">{fcfa(m.duXof)}</p>
                  <p className="text-[10px] text-white/30">{p.part_ca_pct} % du net</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Un mois à zéro n'est pas une anomalie : c'est tout l'intérêt du
            modèle. Sans recette, rien n'est dû. */}
        <p className="text-[11px] text-white/30 mt-4 leading-relaxed">
          Les montants sont calculés sur les abonnements réellement encaissés. Un mois sans recette
          ne doit rien — c'est ce qui distingue une part du chiffre d'affaires d'un forfait.
        </p>
      </Panneau>

      {p.notes && (
        <Panneau titre="Notes" teinte="or">
          <p className="text-[13px] text-white/60 whitespace-pre-wrap leading-relaxed">{p.notes}</p>
        </Panneau>
      )}
    </div>
  );
}
