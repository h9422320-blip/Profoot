import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Coins, Eye, Megaphone, Target,
  TrendingDown, TrendingUp, Users, Video, Wallet,
} from "lucide-react";
import {
  TAUX_POUR_MILLE_USD, calculerEconomie, getPartenaires,
  montantPartenaire, totauxParDevise,
} from "@/lib/partenaires";
import { PLANS } from "@/lib/subscription";
import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import { Indicateur } from "../_components/Indicateur";
import { Panneau } from "../_components/Panneaux";
import { Etiquette, Vide, dateCourte, ilYA } from "../_components/Ui";

export const dynamic = "force-dynamic";

/**
 * Suivi des partenaires influenceurs.
 *
 * Aucun chiffre n'y est isolé : les vues relevées déterminent ce qui est dû,
 * qui s'ajoute aux forfaits pour former le coût de la campagne, lequel se
 * confronte aux recettes réelles des abonnements. C'est ce chaînage qui répond
 * à la seule question qui compte — est-ce que ça rapporte plus que ça ne coûte.
 */
export default async function PartenairesPage() {
  const [partenaires, metrics] = await Promise.all([
    getPartenaires(),
    getAdminMetrics(resoudrePeriode({ periode: "tout" })),
  ]);

  const totaux = totauxParDevise(partenaires);
  const eco = calculerEconomie(partenaires, metrics.revenus.totalCumule, PLANS.vip_yearly.amountXof);
  const actifs = partenaires.filter((p) => p.status === "actif").length;
  const rentable = eco.resultatXof >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Partenaires</h1>
        <p className="text-sm text-white/40 mt-1">
          Influenceurs, contrats et rentabilité — {TAUX_POUR_MILLE_USD} $ pour 1000 vues
        </p>
      </div>

      {partenaires.length === 0 ? (
        <Panneau titre="Aucun partenaire" sousTitre="La table est vide ou la migration n'a pas été appliquée">
          <Vide message="Appliquez la migration 20260809_partenaires.sql, puis ajoutez vos partenaires." />
        </Panneau>
      ) : (
        <>
          {/* ── Rentabilité ─────────────────────────────────────────────── */}
          <div
            className={`relative overflow-hidden rounded-[26px] border p-7 bg-gradient-to-br ${
              rentable
                ? "border-[#10b981]/30 from-[#10b981]/12 via-[#16242e] to-[#111d25]"
                : "border-amber-500/30 from-amber-500/10 via-[#16242e] to-[#111d25]"
            }`}
          >
            <div
              className={`pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full blur-3xl bg-gradient-to-br ${
                rentable ? "from-[#10b981]/25" : "from-amber-500/20"
              } to-transparent`}
            />

            <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  {rentable ? <TrendingUp className="w-4 h-4 text-[#10b981]" /> : <TrendingDown className="w-4 h-4 text-amber-400" />}
                  Résultat de la campagne
                </p>
                <p className={`text-5xl font-black tabular-nums mt-2 ${rentable ? "text-[#10b981]" : "text-amber-400"}`}>
                  {eco.resultatXof >= 0 ? "+" : ""}
                  {Math.round(eco.resultatXof).toLocaleString("fr-FR")}
                  <span className="text-xl text-white/30 ml-2">FCFA</span>
                </p>
                <p className="text-xs text-white/40 mt-2">
                  {rentable
                    ? "Les recettes dépassent le coût des partenaires."
                    : `Il manque ${Math.round(Math.abs(eco.resultatXof)).toLocaleString("fr-FR")} FCFA, soit ${eco.abonnementsPourRentabiliser} abonnement${eco.abonnementsPourRentabiliser > 1 ? "s" : ""} VIP, pour couvrir la campagne.`}
                </p>
              </div>

              <div className="lg:ml-auto grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Recettes</p>
                  <p className="text-xl font-black text-white tabular-nums mt-1">
                    {Math.round(eco.recettesXof).toLocaleString("fr-FR")}
                  </p>
                  <p className="text-[10px] text-white/30">FCFA encaissés</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Coût total</p>
                  <p className="text-xl font-black text-white tabular-nums mt-1">
                    {Math.round(eco.coutTotalXof).toLocaleString("fr-FR")}
                  </p>
                  <p className="text-[10px] text-white/30">forfaits + vues</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Retour</p>
                  <p className="text-xl font-black text-white tabular-nums mt-1">
                    {eco.retourSurInvestissement === null
                      ? "—"
                      : `${eco.retourSurInvestissement.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ×`}
                  </p>
                  <p className="text-[10px] text-white/30">recettes ÷ coût</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Indicateurs ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Indicateur
              libelle="Partenaires actifs"
              valeur={actifs}
              teinte="violet"
              icone={<Users className="w-4 h-4" />}
              aide={`${partenaires.length} au total • ${partenaires.filter((p) => p.inscrit).length} ont créé leur compte`}
              delai={0.05}
            />
            <Indicateur
              libelle="Vues cumulées"
              valeur={eco.vuesTotales}
              teinte="cyan"
              icone={<Eye className="w-4 h-4" />}
              aide={`${eco.publicationsTotales} publication${eco.publicationsTotales > 1 ? "s" : ""} comptabilisée${eco.publicationsTotales > 1 ? "s" : ""}`}
              delai={0.1}
            />
            <Indicateur
              libelle="Dû sur les vues"
              valeur={`${eco.duPourVuesUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $`}
              teinte="or"
              icone={<Coins className="w-4 h-4" />}
              aide={`${eco.vuesTotales.toLocaleString("fr-FR")} vues ÷ 1000 × ${TAUX_POUR_MILLE_USD} $`}
              delai={0.15}
            />
            <Indicateur
              libelle="Coût total campagne"
              valeur={`${Math.round(eco.coutTotalXof).toLocaleString("fr-FR")} FCFA`}
              teinte="vert"
              icone={<Wallet className="w-4 h-4" />}
              aide={`Reste ${Math.round(eco.resteAVerserXof).toLocaleString("fr-FR")} FCFA à verser sur les forfaits`}
              delai={0.2}
            />
          </div>

          {/* ── Budget par devise ───────────────────────────────────────── */}
          <Panneau
            titre="Budget des forfaits"
            sousTitre="Chaque devise est totalisée séparément puis rapportée au franc CFA"
          >
            <div className="space-y-3">
              {totaux.map((t) => (
                <div
                  key={t.devise}
                  className="flex flex-wrap items-center gap-4 p-4 rounded-[16px] bg-[#1d2f3a] border border-[#2e4757]"
                >
                  <span className="w-14 h-10 rounded-[12px] bg-[#111d25] border border-[#2e4757] flex items-center justify-center text-sm font-black text-white/70">
                    {t.devise}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">
                      {montantPartenaire(t.engage, t.devise)}
                      <span className="text-white/30 font-normal"> engagés</span>
                    </p>
                    <p className="text-[11px] text-white/35">
                      {t.nombre} partenaire{t.nombre > 1 ? "s" : ""} • {montantPartenaire(t.verse, t.devise)} déjà versés
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#10b981] tabular-nums">
                      = {Math.round(
                        t.devise === "XOF" ? t.engage : t.engage * (t.devise === "EUR" ? 655.957 : 600)
                      ).toLocaleString("fr-FR")}{" "}
                      FCFA
                    </p>
                    <p className="text-[10px] text-white/25">
                      {t.devise === "EUR" ? "1 € = 655,957 FCFA" : t.devise === "USD" ? "1 $ ≈ 600 FCFA" : "—"}
                    </p>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-4 p-4 rounded-[16px] bg-[#10b981]/10 border border-[#10b981]/25">
                <Target className="w-5 h-5 text-[#10b981] shrink-0" />
                <p className="flex-1 text-sm font-bold text-white">Total des forfaits</p>
                <p className="text-lg font-black text-[#10b981] tabular-nums">
                  {Math.round(eco.verseXof + eco.resteAVerserXof).toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>
          </Panneau>

          {/* ── Contrats ────────────────────────────────────────────────── */}
          <Panneau titre="Contrats en cours" sousTitre="Cliquez sur un partenaire pour voir sa fiche complète">
            <div className="space-y-3">
              {partenaires.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/partenaires/${p.id}`}
                  className="relative overflow-hidden flex flex-wrap items-center gap-4 p-4 rounded-[18px] bg-[#1d2f3a] border border-[#2e4757] hover:border-[#10b981]/45 hover:bg-[#1d2f3a]/70 transition-all group"
                >
                  <div className="absolute inset-y-0 left-0 w-[3px] bg-[#10b981] scale-y-0 group-hover:scale-y-100 origin-center transition-transform" />

                  <div
                    className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 ${
                      p.inscrit
                        ? "bg-gradient-to-br from-[#10b981] to-emerald-700"
                        : "bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30"
                    }`}
                  >
                    <span className={`text-lg font-black ${p.inscrit ? "text-black" : "text-amber-300"}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-white group-hover:text-[#10b981] transition-colors">
                        {p.name}
                      </p>
                      {p.handle && <span className="text-[11px] text-white/35">{p.handle}</span>}
                      {p.accesOuvert ? (
                        <Etiquette tier={p.accesOuvert} />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> accès non ouvert
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/35 truncate mt-0.5">
                      {p.country ? `${p.country} • ` : ""}
                      {p.inscrit ? `inscrit ${ilYA(p.inscritLe!)}` : "compte pas encore créé"}
                      {p.paid && p.paid_at ? ` • forfait versé ${dateCourte(p.paid_at)}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-black text-white tabular-nums flex items-center gap-1.5 justify-end">
                        <Eye className="w-3.5 h-3.5 text-white/30" />
                        {p.vuesCumulees.toLocaleString("fr-FR")}
                      </p>
                      <p className="text-[10px] text-white/30">vues</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-400 tabular-nums flex items-center gap-1.5 justify-end">
                        <Video className="w-3.5 h-3.5 text-white/30" />
                        {p.publications}
                      </p>
                      <p className="text-[10px] text-white/30">vidéos</p>
                    </div>
                    <div className="text-right min-w-[92px]">
                      <p className="text-sm font-black text-white tabular-nums">
                        {montantPartenaire(p.amount, p.currency)}
                      </p>
                      <p className="text-[11px] font-bold text-[#10b981] tabular-nums">
                        + {p.duPourVuesUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#10b981] group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </Panneau>
        </>
      )}

      <div className="flex items-start gap-2 text-[11px] text-white/25">
        <Megaphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Les forfaits sont totalisés par devise avant d&apos;être rapportés au franc CFA — additionner
          directement euros et dollars donnerait un total faux. L&apos;euro suit sa parité fixe de 655,957 ;
          le dollar est approché à 600, valeur indicative. L&apos;accès VIP reste ouvert par la liste du code,
          indépendamment de cette page.
        </p>
      </div>
    </div>
  );
}
