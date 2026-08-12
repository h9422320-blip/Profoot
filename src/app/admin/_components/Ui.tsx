import Link from "next/link";

/**
 * Aides de formatage et petits blocs sans interactivité.
 *
 * Ce fichier reste volontairement exécutable côté serveur : ses fonctions sont
 * appelées pendant le rendu des pages. Tout ce qui a besoin d'animation ou
 * d'état vit dans Panneaux.tsx et Indicateur.tsx, marqués « use client ».
 */

/** Les montants de ProFoot sont en francs CFA, sans décimales. */
export function montant(valeur: number, devise = "XOF"): string {
  return `${valeur.toLocaleString("fr-FR")} ${devise === "XOF" ? "FCFA" : devise}`;
}

export function dateCourte(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateHeure(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ilYA(iso: string | null): string {
  if (!iso) return "jamais";
  const secondes = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  const jours = Math.floor(secondes / 86400);
  if (jours < 31) return `il y a ${jours} j`;
  return dateCourte(iso);
}

/**
 * Adresse e-mail cliquable, ouvrant la fiche du compte.
 *
 * Elle existe parce que les adresses apparaissent dans six listes différentes
 * de l'administration — inscrits, abonnés, analyses, échanges avec l'agent,
 * paiements, partenaires. Rendre le lien à un seul endroit revenait à ne rien
 * faire : c'est justement dans la liste qu'on regarde qu'on veut cliquer.
 *
 * Sans identifiant de compte, l'adresse s'affiche en texte simple plutôt qu'en
 * lien mort : certaines lignes viennent d'un paiement effectué hors de
 * l'application, sans compte rattaché.
 */
export function LienCompte({
  userId,
  email,
  className = '',
}: {
  userId: string | null | undefined;
  email: string | null | undefined;
  className?: string;
}) {
  const texte = email ?? '(adresse non transmise)';
  if (!userId || !email) return <span className={className}>{texte}</span>;

  return (
    <Link
      href={`/admin/users/${userId}`}
      className={`hover:text-[#10b981] hover:underline underline-offset-2 transition-colors ${className}`}
      title="Voir la fiche de ce compte"
    >
      {texte}
    </Link>
  );
}

export function Etiquette({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    VIP: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    PRO: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30",
    ESSENTIAL: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    FREE: "bg-white/5 text-white/40 border-white/10",
  };
  const libelles: Record<string, string> = {
    VIP: "VIP", PRO: "Pro", ESSENTIAL: "Essentiel", FREE: "Gratuit",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[tier] ?? styles.FREE}`}>
      {libelles[tier] ?? tier}
    </span>
  );
}

/** Affiché quand une section n'a réellement aucune donnée — jamais un chiffre inventé. */
export function Vide({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-white/30">{message}</p>
    </div>
  );
}
