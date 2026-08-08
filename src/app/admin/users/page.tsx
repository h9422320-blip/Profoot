import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { Courbe } from "../_components/Graphique";
import { Panneau, Indicateur } from "../_components/Ui";
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-white/40 mt-1">
            {m.utilisateurs.total} compte{m.utilisateurs.total > 1 ? "s" : ""} au total — {m.periode.libelle.toLowerCase()}
          </p>
        </div>
        <SelecteurPeriode />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur libelle="Total des comptes" valeur={m.utilisateurs.total} />
        <Indicateur
          libelle="Nouveaux"
          valeur={m.utilisateurs.nouveaux}
          precedent={m.periode.cle === "tout" ? undefined : m.utilisateurs.nouveauxPrecedent}
        />
        <Indicateur libelle="Actifs sur la période" valeur={m.utilisateurs.actifs} accent />
        <Indicateur
          libelle="Jamais connectés"
          valeur={m.utilisateurs.jamaisConnectes}
          aide="Comptes créés mais jamais utilisés"
        />
      </div>

      <Panneau titre="Inscriptions" sousTitre={`Nouveaux comptes — ${m.periode.libelle.toLowerCase()}`}>
        <Courbe donnees={m.utilisateurs.serie} suffixe="inscription(s)" />
      </Panneau>

      <UsersClient utilisateurs={m.listeUtilisateurs} />
    </div>
  );
}
