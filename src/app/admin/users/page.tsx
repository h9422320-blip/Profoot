import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { Courbe } from "../_components/Graphique";
import { Panneau } from "../_components/Panneaux";
import { Indicateur } from "../_components/Indicateur";
import { EnTete, Rapport } from "../_components/EnTete";
import { Activity, Filter, UserPlus, UserX, Users } from "lucide-react";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);
  const m = await getAdminMetrics(periode);

  return (
    <div className="space-y-6">
      <EnTete
        titre="Utilisateurs"
        sousTitre={`${m.utilisateurs.total} compte${m.utilisateurs.total > 1 ? "s" : ""} au total — ${m.periode.libelle.toLowerCase()}`}
        icone={<Users className="w-6 h-6" />}
        teinte="violet"
        action={<SelecteurPeriode />}
        reperes={[
          { libelle: "Deviennent abonnés", valeur: `${m.liens.tauxConversion} %`, accent: true },
          { libelle: "Se sont connectés", valeur: `${m.liens.tauxActivation} %` },
          { libelle: "Ont analysé", valeur: `${m.liens.tauxUsage} %` },
          { libelle: "Rapporte par compte", valeur: `${m.liens.revenuParCompte.toLocaleString("fr-FR")} FCFA` },
        ]}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Total des comptes"
          valeur={m.utilisateurs.total}
          teinte="violet"
          icone={<Users className="w-4 h-4" />}
          aide={`${m.abonnements.personnes} abonné${m.abonnements.personnes > 1 ? "s" : ""}, soit ${m.liens.tauxConversion} %`}
          delai={0.05}
        />
        <Indicateur
          libelle="Nouveaux"
          valeur={m.utilisateurs.nouveaux}
          precedent={m.periode.cle === "tout" ? undefined : m.utilisateurs.nouveauxPrecedent}
          teinte="cyan"
          icone={<UserPlus className="w-4 h-4" />}
          delai={0.1}
        />
        <Indicateur
          libelle="Actifs sur la période"
          valeur={m.utilisateurs.actifs}
          teinte="vert"
          icone={<Activity className="w-4 h-4" />}
          aide={`${m.liens.analysesParAbonne} analyse${m.liens.analysesParAbonne > 1 ? "s" : ""} par abonné en moyenne`}
          delai={0.15}
        />
        <Indicateur
          libelle="Jamais connectés"
          valeur={m.utilisateurs.jamaisConnectes}
          teinte="rose"
          icone={<UserX className="w-4 h-4" />}
          aide={`Comptes créés mais jamais utilisés • ${m.utilisateurs.emailsNonConfirmes} e-mail${m.utilisateurs.emailsNonConfirmes > 1 ? "s" : ""} non confirmé${m.utilisateurs.emailsNonConfirmes > 1 ? "s" : ""}`}
          delai={0.2}
        />
      </div>

      {/* Le parcours, étape par étape : où les visiteurs s'arrêtent. */}
      <Panneau
        titre="Du compte créé à l'abonnement"
        sousTitre="Chaque étape rapportée au nombre de comptes inscrits"
        icone={<Filter className="w-4 h-4" />}
        teinte="violet"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Rapport
            libelle="Se connectent"
            valeur={`${m.liens.tauxActivation} %`}
            pourcentage={m.liens.tauxActivation}
            teinte="#a78bfa"
            detail={`${m.utilisateurs.total - m.utilisateurs.jamaisConnectes} sur ${m.utilisateurs.total} comptes se sont connectés au moins une fois`}
          />
          <Rapport
            libelle="Lancent une analyse"
            valeur={`${m.liens.tauxUsage} %`}
            pourcentage={m.liens.tauxUsage}
            teinte="#22d3ee"
            detail={`${m.analyses.total} analyse${m.analyses.total > 1 ? "s" : ""} lancée${m.analyses.total > 1 ? "s" : ""} au total`}
          />
          <Rapport
            libelle="Souscrivent"
            valeur={`${m.liens.tauxConversion} %`}
            pourcentage={m.liens.tauxConversion}
            detail={`${m.abonnements.personnes} abonné${m.abonnements.personnes > 1 ? "s" : ""} actif${m.abonnements.personnes > 1 ? "s" : ""} • ${m.liens.revenuParAbonne.toLocaleString("fr-FR")} FCFA chacun`}
          />
        </div>
      </Panneau>

      <Panneau
        titre="Inscriptions"
        sousTitre={`Nouveaux comptes — ${m.periode.libelle.toLowerCase()}`}
        icone={<UserPlus className="w-4 h-4" />}
        teinte="cyan"
      >
        <Courbe donnees={m.utilisateurs.serie} suffixe="inscription(s)" />
      </Panneau>

      <UsersClient utilisateurs={m.listeUtilisateurs} />
    </div>
  );
}
