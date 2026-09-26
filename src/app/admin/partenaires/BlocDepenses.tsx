/**
 * LES FRAIS DE FONCTIONNEMENT — LA LECTURE.
 *
 * ── POURQUOI CE BLOC EXISTE, ET POURQUOI IL EST PARTAGÉ ───────────────────
 *
 * Demande du propriétaire, le 26 septembre 2026 : Claude, OpenRouter,
 * Supabase, Vercel, API-Football se retirent du chiffre d'affaires AVANT le
 * partage. Le partenaire y participe donc à hauteur de sa part — et c'est
 * exactement pour cela qu'il doit lire chaque ligne.
 *
 * Il avait d'abord été écrit UNIQUEMENT sur la fiche d'un partenaire. Le
 * propriétaire a ouvert la page « Partenaires », n'a rien vu, et a eu raison :
 * c'est cette page-là qu'on ouvre en premier. Le bloc vit donc dans un seul
 * composant, posé aux DEUX endroits.
 *
 * ── PERSONNE N'ÉCRIT ICI ──────────────────────────────────────────────────
 *
 * Le propriétaire ne veut rien saisir lui-même : il dit à Claude ce qu'il a
 * payé, et Claude l'inscrit par `scripts/depense.mts`, avec la clé de service.
 * La page n'a donc ni formulaire ni action serveur d'écriture — ce qui
 * supprime aussi la question de savoir qui, du fondateur ou du partenaire,
 * pourrait modifier la part de l'autre depuis l'écran.
 */
import { lireTauxUsdXof, lireDepenses, tableauDuMois } from "@/lib/depenses";
import VueDepenses from "./VueDepenses";

export default async function BlocDepenses() {
  // Les mêmes lignes que celles que le partage retire (`depensesParMois` lit
  // `lireDepenses`, lui aussi) : le tableau et la déduction ne peuvent pas diverger.
  const [taux, lignes] = await Promise.all([lireTauxUsdXof(), lireDepenses()]);

  // Le mois en cours s'affiche TOUJOURS, même vide ; les mois précédents
  // seulement s'ils ont eu des dépenses.
  const moisCourant = new Date().toISOString().slice(0, 7);
  const mois = [...new Set([moisCourant, ...lignes.map((l) => String(l.jour).slice(0, 7))])].sort((a, b) =>
    b.localeCompare(a)
  );

  return <VueDepenses taux={taux} tableaux={mois.map((m) => tableauDuMois(m, lignes))} />;
}
