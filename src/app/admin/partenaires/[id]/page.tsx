import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Eye,
  FileText, Globe, Mail, Users as UsersIcon, Wallet,
} from "lucide-react";
import { getPartenaire, montantPartenaire } from "@/lib/partenaires";
import FormulaireReleve from "../FormulaireReleve";
import { Panneau } from "../../_components/Panneaux";
import { Etiquette, Vide, dateCourte, ilYA } from "../../_components/Ui";
import { Indicateur } from "../../_components/Indicateur";

export const dynamic = "force-dynamic";

/**
 * Fiche d'un partenaire : ce qui a été convenu, ce qui a été payé, ce que ça a
 * rapporté. Tout ce qu'il faut pour décider si le contrat sera reconduit.
 */
export default async function FichePartenaire({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getPartenaire(id);
  if (!p) notFound();

  const derniersReleves = [...p.releves].sort(
    (a, b) => +new Date(b.period_start) - +new Date(a.period_start)
  );

  // Coût par millier de vues : le seul indicateur qui permette de comparer deux
  // contrats entre eux. Sans relevé, il n'est pas calculé plutôt qu'affiché à
  // zéro, ce qui laisserait croire à une acquisition gratuite.
  const coutPourMille =
    p.vuesCumulees > 0 ? (Number(p.amount) / p.vuesCumulees) * 1000 : null;

  // Semaine écoulée, pré-remplie dans le formulaire : le relevé convenu est
  // hebdomadaire et se fait le lundi pour les sept jours précédents.
  const aujourdhui = new Date();
  const lundiDernier = new Date(aujourdhui);
  const decalage = (aujourdhui.getDay() + 6) % 7; // 0 = lundi
  lundiDernier.setDate(aujourdhui.getDate() - decalage - 7);
  const dimancheDernier = new Date(lundiDernier);
  dimancheDernier.setDate(lundiDernier.getDate() + 6);
  const debutSemaine = lundiDernier.toISOString().slice(0, 10);
  const finSemaine = dimancheDernier.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/partenaires"
        className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-[#10b981] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tous les partenaires
      </Link>

      {/* En-tête */}
      <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className={`w-16 h-16 rounded-full border flex items-center justify-center shrink-0 ${
              p.inscrit ? "bg-[#1d2f3a] border-[#2e4757]" : "bg-amber-500/10 border-amber-500/30"
            }`}
          >
            <span className={`text-2xl font-black ${p.inscrit ? "text-white/70" : "text-amber-300"}`}>
              {p.name.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">{p.name}</h1>
              {p.handle && <span className="text-sm text-white/40">{p.handle}</span>}
              {p.accesOuvert ? (
                <Etiquette tier={p.accesOuvert} />
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> accès VIP non ouvert
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[12px] text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {p.email}
              </span>
              {p.country && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> {p.country}
                </span>
              )}
              {p.platform && <span>{p.platform}</span>}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-3xl font-black text-white">{montantPartenaire(p.amount, p.currency)}</p>
            <p className={`text-xs font-bold ${p.paid ? "text-[#10b981]" : "text-amber-400"}`}>
              {p.paid
                ? `versé${p.paid_at ? ` le ${dateCourte(p.paid_at)}` : ""}`
                : "pas encore versé"}
            </p>
          </div>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur libelle="Vues cumulées" valeur={p.vuesCumulees.toLocaleString("fr-FR")} accent aide={`${derniersReleves.length} relevé(s)`} />
        <Indicateur libelle="Publications" valeur={p.publications} aide="Vidéos comptabilisées" />
        <Indicateur
          libelle="Coût pour 1000 vues"
          valeur={coutPourMille === null ? "—" : montantPartenaire(Math.round(coutPourMille * 100) / 100, p.currency)}
          aide={coutPourMille === null ? "Aucun relevé de vues" : "Pour comparer vos contrats"}
        />
        <Indicateur
          libelle="Compte sur l'app"
          valeur={p.inscrit ? "Créé" : "En attente"}
          aide={p.inscrit ? `Inscrit ${ilYA(p.inscritLe!)}` : "Accès prêt, pas encore utilisé"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contrat */}
        <Panneau
          titre="Ce qui a été convenu"
          sousTitre={
            p.starts_on
              ? `Du ${dateCourte(p.starts_on)}${p.ends_on ? ` au ${dateCourte(p.ends_on)}` : ""}`
              : "Aucune période définie"
          }
        >
          {p.terms ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{p.terms}</p>
              </div>
              {p.audience && (
                <div className="flex items-start gap-3 pt-3 border-t border-[#2e4757]">
                  <UsersIcon className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-1">Audience</p>
                    <p className="text-sm text-white/60 leading-relaxed">{p.audience}</p>
                  </div>
                </div>
              )}
              {p.notes && (
                <div className="flex items-start gap-3 pt-3 border-t border-[#2e4757]">
                  <CalendarDays className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                  <p className="text-sm text-white/50 leading-relaxed whitespace-pre-line">{p.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <Vide message="Aucun terme enregistré pour ce partenaire." />
          )}
        </Panneau>

        {/* Relevés */}
        <Panneau
          titre="Relevés de vues"
          sousTitre={derniersReleves.length ? "Du plus récent au plus ancien" : "Aucun relevé enregistré"}
        >
          <div className="mb-4">
            <FormulaireReleve
              partnerId={p.id}
              debutParDefaut={debutSemaine}
              finParDefaut={finSemaine}
            />
          </div>

          {derniersReleves.length === 0 ? (
            <Vide message="Les relevés apparaîtront ici une fois les premières semaines comptabilisées." />
          ) : (
            <div className="space-y-3">
              {derniersReleves.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 p-3 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">
                      {dateCourte(r.period_start)} → {dateCourte(r.period_end)}
                    </p>
                    {r.notes && <p className="text-[11px] text-white/35 mt-0.5">{r.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-white flex items-center gap-1 justify-end">
                      <Eye className="w-3.5 h-3.5 text-white/40" />
                      {r.views.toLocaleString("fr-FR")}
                    </p>
                    <p className="text-[10px] text-white/35">
                      {r.posts} publication{r.posts > 1 ? "s" : ""}
                      {r.signups > 0 ? ` • ${r.signups} inscrit(s)` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panneau>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-white/25">
        {p.accesOuvert ? (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#10b981]" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
        )}
        <p>
          {p.accesOuvert
            ? `Accès ${p.accesOuvert} ouvert sur ${p.email}. Il s'active dès la création du compte, sans intervention.`
            : `Aucun accès n'est ouvert sur ${p.email}. Ce partenaire n'aura pas les fonctionnalités promises tant qu'il n'est pas ajouté à la liste des accès offerts.`}
        </p>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-white/25">
        <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Montant affiché dans la devise réellement versée. Les relevés de vues sont saisis manuellement :
          ils ne peuvent pas être lus automatiquement sur les réseaux sociaux.
        </p>
      </div>
    </div>
  );
}
