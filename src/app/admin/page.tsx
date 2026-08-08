import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "./_components/SelecteurPeriode";
import { Courbe, Barres, Camembert } from "./_components/Graphique";
import { Etiquette, Vide, montant, dateCourte, ilYA } from "./_components/Ui";
import { Panneau, Classement } from "./_components/Panneaux";
import { Indicateur } from "./_components/Indicateur";
import { AlertTriangle, Users, CreditCard, Brain, Wallet } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);
  const m = await getAdminMetrics(periode);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Vue d'ensemble</h1>
          <p className="text-sm text-white/40 mt-1">
            {m.periode.libelle} — données réelles lues dans la base
          </p>
        </div>
        <SelecteurPeriode />
      </div>

      {m.avertissements.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-[16px] p-4 space-y-1">
          {m.avertissements.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">{a}</p>
            </div>
          ))}
        </div>
      )}

      {/* Indicateurs principaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Comptes inscrits"
          valeur={m.utilisateurs.total}
          aide={`${m.utilisateurs.nouveaux} nouveau${m.utilisateurs.nouveaux > 1 ? "x" : ""} sur la période`}
        />
        <Indicateur
          libelle="Nouveaux inscrits"
          valeur={m.utilisateurs.nouveaux}
          precedent={m.periode.cle === "tout" ? undefined : m.utilisateurs.nouveauxPrecedent}
        />
        <Indicateur
          libelle="Abonnés actifs"
          valeur={m.abonnements.actifs}
          accent
          aide={`${m.abonnements.nouveaux} nouvel abonnement sur la période`}
        />
        <Indicateur
          libelle="Revenus de la période"
          valeur={montant(m.revenus.surPeriode, m.revenus.devise)}
          aide={`${montant(m.revenus.totalCumule, m.revenus.devise)} encaissés depuis le début`}
        />
      </div>

      {/* Courbes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panneau titre="Inscriptions" sousTitre={`Nouveaux comptes — ${m.periode.libelle.toLowerCase()}`}>
          <Courbe donnees={m.utilisateurs.serie} suffixe="inscription(s)" />
        </Panneau>

        <Panneau titre="Analyses lancées" sousTitre={`${m.analyses.surPeriode} sur la période, ${m.analyses.moyenneParJour} par jour en moyenne`}>
          <Courbe donnees={m.analyses.serie} suffixe="analyse(s)" />
        </Panneau>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Panneau titre="Revenus encaissés" sousTitre="Montant des abonnements souscrits sur la période">
            <Barres donnees={m.revenus.serie} suffixe="FCFA" />
          </Panneau>
        </div>

        <Panneau titre="Répartition des offres" sousTitre="Abonnements actifs aujourd'hui">
          <Camembert donnees={m.abonnements.parOffre.map((o) => ({ nom: o.libelle, valeur: o.nombre }))} />
        </Panneau>
      </div>

      {/* Chiffres secondaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicateur
          libelle="Revenu mensuel récurrent"
          valeur={montant(m.revenus.revenuMensuelRecurrent, m.revenus.devise)}
          aide="Abonnements actifs ramenés à 30 jours"
        />
        <Indicateur
          libelle="Panier moyen"
          valeur={montant(m.revenus.panierMoyen, m.revenus.devise)}
          aide="Sur tous les abonnements souscrits"
        />
        <Indicateur
          libelle="Comptes actifs"
          valeur={m.utilisateurs.actifs}
          aide="Se sont connectés sur la période"
        />
        <Indicateur
          libelle="Expirent sous 7 jours"
          valeur={m.abonnements.expirentBientot}
          aide="Abonnements à renouveler"
        />
      </div>

      {/* Listes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panneau
          titre="Derniers inscrits"
          sousTitre="Tous comptes confondus"
          action={
            <Link href="/admin/users" className="text-xs font-bold text-[#10b981] hover:underline">
              Tout voir
            </Link>
          }
        >
          {m.listeUtilisateurs.length === 0 ? (
            <Vide message="Aucun compte inscrit." />
          ) : (
            <div className="space-y-3">
              {m.listeUtilisateurs.slice(0, 8).map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1d2f3a] border border-[#2e4757] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white/70">{u.email.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{u.email}</p>
                    <p className="text-[11px] text-white/35">Inscrit {ilYA(u.inscritLe)}</p>
                  </div>
                  <Etiquette tier={u.offre} />
                </div>
              ))}
            </div>
          )}
        </Panneau>

        <Panneau titre="Compétitions les plus analysées" sousTitre={m.periode.libelle}>
          <Classement lignes={m.analyses.topCompetitions} unite="analyses" />
        </Panneau>
      </div>

      {/* Raccourcis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/admin/users", icone: Users, titre: "Utilisateurs", valeur: `${m.utilisateurs.total} comptes` },
          { href: "/admin/finances", icone: Wallet, titre: "Finances", valeur: montant(m.revenus.totalCumule, m.revenus.devise) },
          { href: "/admin/system", icone: Brain, titre: "Analyses IA", valeur: `${m.analyses.total} au total` },
          { href: "/admin/logs", icone: CreditCard, titre: "Paiements", valeur: `${m.paiements.length} événements` },
        ].map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="bg-[#16242e] border border-[#2e4757] rounded-[20px] p-5 hover:border-[#10b981]/40 transition-colors group"
          >
            <r.icone className="w-5 h-5 text-[#10b981] mb-3" />
            <p className="text-sm font-bold text-white group-hover:text-[#10b981] transition-colors">{r.titre}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{r.valeur}</p>
          </Link>
        ))}
      </div>

      <p className="text-[11px] text-white/25 text-center pt-2">
        Dernière lecture : {dateCourte(new Date().toISOString())} — les chiffres sont recalculés à chaque ouverture de la page.
      </p>
    </div>
  );
}
