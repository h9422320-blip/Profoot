import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "./_components/SelecteurPeriode";
import Audience from "./_components/Audience";
import EchecsAnalyse from "./_components/EchecsAnalyse";
import Fidelisation from "./_components/Fidelisation";
import SuiviPrecision from "./_components/SuiviPrecision";
import { heureDeLecture } from "@/lib/recettes-boutique";
import { Courbe, Barres, Camembert } from "./_components/Graphique";
import { Etiquette, LienCompte, Vide, montant, dateCourte, ilYA } from "./_components/Ui";
import { Panneau, Classement } from "./_components/Panneaux";
import { Indicateur } from "./_components/Indicateur";
import { EnTete, Rapport } from "./_components/EnTete";
import {
  AlertTriangle, Users, CreditCard, Brain, Wallet, LayoutDashboard,
  Target, Megaphone, Activity, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

/**
 * ── LA PAGE S AFFICHE D ABORD, LES CHIFFRES ARRIVENT ENSUITE ─────────────
 *
 * Elle attendait que TOUT soit calcule avant d afficher quoi que ce soit.
 * Chronometre le 25 aout 2026, bloc par bloc :
 *
 *   Indicateurs (boutique Chariow) .... 37 s
 *   Suivi de precision ................ 26 s
 *   Echecs d analyse .................. 13 s
 *   Controle du marche ................ 12 s
 *   Mesure maison ..................... 10 s
 *   Fidelisation ....................... 5 s
 *                                     ──────
 *                                      104 s
 *
 * Cent quatre secondes d ecran inchange apres un clic. Le proprietaire le
 * decrivait ainsi : « on est oblige de cliquer deux a trois fois, voire cinq,
 * avant que ca ne passe ». Il ne cliquait pas trop : rien ne lui repondait.
 *
 * Chaque bloc est desormais isole dans son propre `Suspense`. La coquille part
 * immediatement — un clic repond dans la seconde — et chaque panneau se
 * remplit des qu il est pret, sans retenir les autres.
 */
export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);

  return (
    <div className="space-y-6">
      <Suspense fallback={<Patience titre="Vue d ensemble" lignes={4} />}>
        <BlocIndicateurs periode={periode} />
      </Suspense>

      <Suspense fallback={<Patience titre="Precision du moteur" />}>
        <SuiviPrecision />
      </Suspense>

      <Suspense fallback={<Patience titre="Analyses en echec" />}>
        <EchecsAnalyse />
      </Suspense>

      <Suspense fallback={<Patience titre="Fidelisation" />}>
        <Fidelisation />
      </Suspense>

      <Suspense fallback={<Patience titre="Audience" />}>
        <Audience />
      </Suspense>
    </div>
  );
}

/**
 * Ce qui s affiche pendant qu un bloc se calcule.
 *
 * Un espace vide laisse croire que rien ne se passe — et fait recliquer. Une
 * forme grise qui pulse dit « ca arrive » sans mentir sur le contenu.
 */
function Patience({ titre, lignes = 2 }: { titre: string; lignes?: number }) {
  return (
    <div className="rounded-[20px] border border-[#2e4757] bg-[#16242e] p-5 animate-pulse">
      <div className="h-3 w-40 rounded bg-white/10 mb-4" />
      <div className="space-y-2.5">
        {Array.from({ length: lignes }).map((_, i) => (
          <div key={i} className="h-2.5 rounded bg-white/[0.06]" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
      <span className="sr-only">{titre} — calcul en cours</span>
    </div>
  );
}

/** Tout ce qui depend des indicateurs de la boutique, isole pour ne rien retenir. */
async function BlocIndicateurs({ periode }: { periode: ReturnType<typeof resoudrePeriode> }) {
  const m = await getAdminMetrics(periode);

  return (
    <div className="space-y-6">
      {/* En-tête : les trois rapports qui résument l'état du produit. */}
      <EnTete
        titre="Vue d'ensemble"
        // L'heure de lecture accompagne le chiffre : sans elle, un montant ne
        // peut être confronté à rien. Le 22 août 2026, on a cherché une erreur
        // de calcul entre 325 000 et 336 000 alors que les deux étaient justes,
        // lus à vingt minutes d'écart.
        sousTitre={`${m.periode.libelle} — recettes arrêtées à ${heureDeLecture()}`}
        icone={<LayoutDashboard className="w-6 h-6" />}
        action={<SelecteurPeriode />}
        reperes={[
          { libelle: "Conversion", valeur: `${m.liens.tauxConversion} %`, accent: true },
          { libelle: "Revenu par compte", valeur: `${m.liens.revenuParCompte.toLocaleString("fr-FR")} FCFA` },
          { libelle: "Analyses par abonné", valeur: String(m.liens.analysesParAbonne) },
          {
            libelle: "Résultat net",
            valeur: `${m.liens.resultatNetXof >= 0 ? "+" : ""}${m.liens.resultatNetXof.toLocaleString("fr-FR")} FCFA`,
          },
        ]}
      />

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
          teinte="violet"
          icone={<Users className="w-4 h-4" />}
          aide={`${m.utilisateurs.nouveaux} nouveau${m.utilisateurs.nouveaux > 1 ? "x" : ""} sur la période • ${m.liens.tauxActivation} % se sont déjà connectés`}
          delai={0.05}
        />
        <Indicateur
          libelle="Nouveaux inscrits"
          valeur={m.utilisateurs.nouveaux}
          precedent={m.periode.cle === "tout" ? undefined : m.utilisateurs.nouveauxPrecedent}
          teinte="cyan"
          icone={<TrendingUp className="w-4 h-4" />}
          delai={0.1}
        />
        <Indicateur
          libelle="Abonnés actifs"
          valeur={m.abonnements.actifs}
          teinte="vert"
          icone={<Target className="w-4 h-4" />}
          aide={`${m.liens.tauxConversion} % des ${m.utilisateurs.total} comptes • ${m.abonnements.nouveaux} nouvel abonnement sur la période`}
          delai={0.15}
        />
        <Indicateur
          libelle="Revenus de la période"
          valeur={montant(m.revenus.surPeriode, m.revenus.devise)}
          teinte="or"
          icone={<Wallet className="w-4 h-4" />}
          aide={`${montant(m.revenus.totalCumule, m.revenus.devise)} depuis le début • ${m.liens.revenuParAbonne.toLocaleString("fr-FR")} FCFA par abonné`}
          delai={0.2}
        />
      </div>

      {/* Les rapports entre les chiffres : chacun met deux valeurs en relation,
          parce qu'un total isolé ne dit rien de la santé du produit. */}
      <Panneau
        titre="Ce que les chiffres disent ensemble"
        sousTitre="Chaque valeur est le rapport de deux autres, pas un compteur isolé"
        icone={<Activity className="w-4 h-4" />}
        teinte="cyan"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Rapport
            libelle="Conversion"
            valeur={`${m.liens.tauxConversion} %`}
            pourcentage={m.liens.tauxConversion}
            detail={`${m.abonnements.actifs} abonnés sur ${m.utilisateurs.total} comptes inscrits`}
          />
          <Rapport
            libelle="Activation"
            valeur={`${m.liens.tauxActivation} %`}
            pourcentage={m.liens.tauxActivation}
            teinte="#a78bfa"
            detail={`${m.utilisateurs.jamaisConnectes} compte${m.utilisateurs.jamaisConnectes > 1 ? "s" : ""} créé${m.utilisateurs.jamaisConnectes > 1 ? "s" : ""} mais jamais utilisé${m.utilisateurs.jamaisConnectes > 1 ? "s" : ""}`}
          />
          <Rapport
            libelle="Usage"
            valeur={`${m.liens.tauxUsage} %`}
            pourcentage={m.liens.tauxUsage}
            teinte="#22d3ee"
            detail={`des comptes ont lancé au moins une analyse • ${m.liens.analysesParAbonne} par abonné`}
          />
          <Rapport
            libelle="Revenu par compte"
            valeur={`${m.liens.revenuParCompte.toLocaleString("fr-FR")} FCFA`}
            teinte="#fbbf24"
            detail={`${montant(m.revenus.totalCumule, m.revenus.devise)} ÷ ${m.utilisateurs.total} comptes`}
          />
        </div>
      </Panneau>

      {/* Rentabilité : les recettes confrontées au coût des influenceurs. */}
      {m.liens.coutPartenairesXof > 0 && (
        <div
          className={`relative overflow-hidden rounded-[22px] border p-6 bg-gradient-to-r ${
            m.liens.resultatNetXof >= 0
              ? "border-[#10b981]/30 from-[#10b981]/12 via-[#16242e] to-[#16242e]"
              : "border-amber-500/30 from-amber-500/10 via-[#16242e] to-[#16242e]"
          }`}
        >
          <Megaphone className="pointer-events-none absolute -right-5 -bottom-5 w-28 h-28 text-white/[0.04]" />
          <div className="relative flex flex-wrap items-center gap-x-10 gap-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Résultat net</p>
              <p className={`text-3xl font-black tabular-nums mt-1 ${m.liens.resultatNetXof >= 0 ? "text-[#10b981]" : "text-amber-400"}`}>
                {m.liens.resultatNetXof >= 0 ? "+" : ""}
                {m.liens.resultatNetXof.toLocaleString("fr-FR")} <span className="text-base text-white/30">FCFA</span>
              </p>
            </div>
            <div className="text-[11px] text-white/40 leading-relaxed">
              <p>
                Recettes <span className="text-white/70 font-bold">{montant(m.revenus.totalCumule, m.revenus.devise)}</span>
              </p>
              <p>
                Coût des partenaires{" "}
                <span className="text-white/70 font-bold">−{m.liens.coutPartenairesXof.toLocaleString("fr-FR")} FCFA</span>
              </p>
            </div>
            <Link
              href="/admin/partenaires"
              className="ml-auto text-xs font-bold text-[#10b981] hover:underline shrink-0"
            >
              Voir le détail des partenaires
            </Link>
          </div>
        </div>
      )}

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
                <Link
                  key={u.id}
                  href={`/admin/users/${u.id}`}
                  className="group flex items-center gap-3 -mx-2 px-2 py-1 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1d2f3a] border border-[#2e4757] flex items-center justify-center shrink-0 group-hover:border-[#10b981]/50 transition-colors">
                    <span className="text-xs font-bold text-white/70">{u.email.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate group-hover:text-[#10b981] transition-colors">{u.email}</p>
                    <p className="text-[11px] text-white/35">Inscrit {ilYA(u.inscritLe)}</p>
                  </div>
                  <Etiquette tier={u.offre} />
                </Link>
              ))}
            </div>
          )}
        </Panneau>

        <Panneau
          titre="Partenaires"
          sousTitre={
            m.partenaires.total === 0
              ? "Aucun accès offert"
              : `${m.partenaires.total} accès offert${m.partenaires.total > 1 ? "s" : ""} — ` +
                `${m.partenaires.inscrits} inscrit${m.partenaires.inscrits > 1 ? "s" : ""}` +
                (m.partenaires.enAttente > 0 ? `, ${m.partenaires.enAttente} en attente` : "")
          }
        >
          {m.partenaires.total === 0 ? (
            <Vide message="Aucun accès partenaire accordé." />
          ) : (
            <div className="space-y-3">
              {m.partenaires.liste.map((p) => (
                <div key={p.email} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                      p.inscrit
                        ? "bg-[#1d2f3a] border-[#2e4757]"
                        : "bg-amber-500/10 border-amber-500/30"
                    }`}
                  >
                    <span className={`text-xs font-bold ${p.inscrit ? "text-white/70" : "text-amber-300"}`}>
                      {p.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      <LienCompte userId={p.userId} email={p.email} />
                    </p>
                    <p className="text-[11px] text-white/35">
                      {p.inscrit
                        ? `Inscrit ${ilYA(p.inscritLe!)} — ${p.nbAnalyses} analyse${p.nbAnalyses > 1 ? "s" : ""}` +
                          (p.derniereConnexion ? ` — vu ${ilYA(p.derniereConnexion)}` : " — jamais connecté")
                        : "Accès prêt, compte pas encore créé"}
                    </p>
                  </div>
                  <Etiquette tier={p.niveau} />
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

      {/* Les quatre panneaux qui suivaient ici — precision, echecs,
          fidelisation, audience — sont remontes dans la coquille, chacun dans
          son propre `Suspense`. Ils y attendaient les trente-sept secondes des
          indicateurs de la boutique AVANT de commencer leur propre calcul.
          Leur place dans l affichage est inchangee. */}
    </div>
  );
}
