import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, CalendarDays, Coins, Eye,
  FileText, Globe, Mail, TrendingUp, Users as UsersIcon, Video, Wallet,
} from "lucide-react";
import {
  TAUX_POUR_MILLE_USD, getPartenaire, montantPartenaire, versXof,
} from "@/lib/partenaires";
import { Panneau } from "../../_components/Panneaux";
import { Etiquette, dateCourte, ilYA } from "../../_components/Ui";
import { Indicateur } from "../../_components/Indicateur";
import ListeReleves from "../ListeReleves";

export const dynamic = "force-dynamic";

/**
 * Fiche d'un partenaire : ce qui a été convenu, ce qu'il a rapporté, ce qu'il
 * reste à lui verser. Tous les chiffres découlent les uns des autres — les vues
 * relevées déterminent le montant dû, qui alimente le coût de la campagne.
 */
export default async function FichePartenaire({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getPartenaire(id);
  if (!p) notFound();

  const releves = [...p.releves].sort(
    (a, b) => +new Date(b.period_start) - +new Date(a.period_start)
  );

  // Semaine écoulée, pré-remplie : le relevé convenu est hebdomadaire et se
  // fait le lundi, pour les sept jours précédents.
  const aujourdhui = new Date();
  const lundiDernier = new Date(aujourdhui);
  lundiDernier.setDate(aujourdhui.getDate() - ((aujourdhui.getDay() + 6) % 7) - 7);
  const dimancheDernier = new Date(lundiDernier);
  dimancheDernier.setDate(lundiDernier.getDate() + 6);

  const totalUsd = versXof(p.duPourVuesUsd, "USD");
  const forfaitXof = versXof(Number(p.amount ?? 0), p.currency);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/partenaires"
        className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-[#10b981] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tous les partenaires
      </Link>

      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[26px] border border-[#2e4757] bg-gradient-to-br from-[#1d2f3a] via-[#16242e] to-[#111d25] p-7">
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-gradient-to-br from-[#10b981]/25 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-gradient-to-tr from-violet-500/15 to-transparent blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[#10b981] to-emerald-700 flex items-center justify-center shadow-lg shadow-[#10b981]/25">
              <span className="text-3xl font-black text-black">{p.name.charAt(0).toUpperCase()}</span>
            </div>
            {p.accesOuvert && (
              <span className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#16242e] border-2 border-[#10b981] flex items-center justify-center">
                <BadgeCheck className="w-4 h-4 text-[#10b981]" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black text-white tracking-tight">{p.name}</h1>
              {p.handle && <span className="text-sm font-bold text-white/40">{p.handle}</span>}
              {p.accesOuvert ? (
                <Etiquette tier={p.accesOuvert} />
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider text-amber-400">
                  <AlertTriangle className="w-3 h-3" /> accès non ouvert
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-[12px] text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {p.email}
              </span>
              {p.country && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> {p.country}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {p.starts_on
                  ? `Du ${dateCourte(p.starts_on)}${p.ends_on ? ` au ${dateCourte(p.ends_on)}` : " — en cours"}`
                  : "Période non définie"}
              </span>
            </div>
          </div>

          {/* Le forfait et le dû sur les vues sont deux choses distinctes : les
              séparer évite de croire que l'un remplace l'autre. */}
          <div className="shrink-0 flex gap-6 lg:border-l lg:border-[#2e4757] lg:pl-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Forfait</p>
              <p className="text-2xl font-black text-white tabular-nums mt-1">
                {montantPartenaire(p.amount, p.currency)}
              </p>
              <p className={`text-[11px] font-bold ${p.paid ? "text-[#10b981]" : "text-amber-400"}`}>
                {p.paid ? `versé ${p.paid_at ? dateCourte(p.paid_at) : ""}` : "à verser"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Dû sur les vues</p>
              <p className="text-2xl font-black text-[#10b981] tabular-nums mt-1">
                {p.duPourVuesUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $
              </p>
              <p className="text-[11px] text-white/35">
                {p.vuesCumulees.toLocaleString("fr-FR")} vues
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Indicateurs ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Vues cumulées"
          valeur={p.vuesCumulees}
          teinte="cyan"
          icone={<Eye className="w-4 h-4" />}
          aide={`${releves.length} relevé${releves.length > 1 ? "s" : ""} enregistré${releves.length > 1 ? "s" : ""}`}
          delai={0.05}
        />
        <Indicateur
          libelle="Publications"
          valeur={p.publications}
          teinte="violet"
          icone={<Video className="w-4 h-4" />}
          aide="Vidéos comptabilisées"
          delai={0.1}
        />
        <Indicateur
          libelle="Tarif pour 1000 vues"
          valeur={`${TAUX_POUR_MILLE_USD} $`}
          teinte="or"
          icone={<Coins className="w-4 h-4" />}
          aide="Tarif convenu, identique pour tous les partenaires"
          delai={0.15}
        />
        <Indicateur
          libelle="Montant dû sur les vues"
          valeur={`${p.duPourVuesUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $`}
          teinte="vert"
          icone={<Wallet className="w-4 h-4" />}
          aide={`${p.vuesCumulees.toLocaleString("fr-FR")} vues ÷ 1000 × ${TAUX_POUR_MILLE_USD} $`}
          delai={0.2}
        />
      </div>

      {/* ── Coût total ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[22px] border border-[#10b981]/25 bg-gradient-to-r from-[#10b981]/10 via-[#16242e] to-[#16242e] p-6">
        <TrendingUp className="pointer-events-none absolute -right-6 -bottom-6 w-32 h-32 text-[#10b981]/10" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
              Ce que ce partenaire vous coûte au total
            </p>
            <p className="text-4xl font-black text-white tabular-nums mt-1.5">
              {Math.round(forfaitXof + totalUsd).toLocaleString("fr-FR")}{" "}
              <span className="text-lg text-white/40">FCFA</span>
            </p>
          </div>
          <div className="sm:ml-auto text-[11px] text-white/40 leading-relaxed sm:text-right">
            <p>
              Forfait {montantPartenaire(p.amount, p.currency)} ={" "}
              <span className="text-white/70 font-bold">{Math.round(forfaitXof).toLocaleString("fr-FR")} FCFA</span>
            </p>
            <p>
              Vues {p.duPourVuesUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $ ={" "}
              <span className="text-white/70 font-bold">{Math.round(totalUsd).toLocaleString("fr-FR")} FCFA</span>
            </p>
            <p className="mt-1 text-white/25">1 € = 655,957 FCFA (parité fixe) • 1 $ ≈ 600 FCFA</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panneau titre="Ce qui a été convenu" sousTitre={p.audience ? "Contrat et audience" : "Contrat"}>
          <div className="space-y-4">
            {p.terms ? (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{p.terms}</p>
              </div>
            ) : (
              <p className="text-sm text-white/30">Aucun terme enregistré.</p>
            )}

            {p.audience && (
              <div className="flex items-start gap-3 pt-4 border-t border-[#2e4757]">
                <UsersIcon className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-1">Audience</p>
                  <p className="text-sm text-white/60 leading-relaxed">{p.audience}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 pt-4 border-t border-[#2e4757]">
              <BadgeCheck className={`w-4 h-4 shrink-0 mt-0.5 ${p.accesOuvert ? "text-[#10b981]" : "text-amber-400"}`} />
              <p className="text-[12px] text-white/50 leading-relaxed">
                {p.accesOuvert
                  ? `Accès ${p.accesOuvert} ouvert. ${p.inscrit ? `Compte créé ${ilYA(p.inscritLe!)}.` : "Il s'activera à la création du compte, sans intervention."}`
                  : "Aucun accès ouvert sur cette adresse : ce partenaire n'aura pas les fonctionnalités promises."}
              </p>
            </div>
          </div>
        </Panneau>

        <Panneau
          titre="Relevés de vues"
          sousTitre={`Saisie manuelle • ${TAUX_POUR_MILLE_USD} $ pour 1000 vues`}
        >
          <ListeReleves
            partnerId={p.id}
            releves={releves}
            debutParDefaut={lundiDernier.toISOString().slice(0, 10)}
            finParDefaut={dimancheDernier.toISOString().slice(0, 10)}
            tauxPourMille={TAUX_POUR_MILLE_USD}
          />
        </Panneau>
      </div>
    </div>
  );
}
