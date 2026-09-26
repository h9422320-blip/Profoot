/**
 * LES FRAIS DE FONCTIONNEMENT — LA LECTURE.
 *
 * ── POURQUOI CE BLOC EXISTE, ET POURQUOI IL EST PARTAGÉ ───────────────────
 *
 * Demande du propriétaire, le 26 septembre 2026 : Supabase, Vercel,
 * OpenRouter, Anthropic, API-Football et les frais de boutique se retirent du
 * chiffre d'affaires AVANT le partage. Le partenaire y participe donc à
 * hauteur de sa part — et c'est exactement pour cela qu'il doit lire chaque
 * ligne : un « − 25 000 FCFA » sans explication se soupçonne.
 *
 * Il avait d'abord été écrit UNIQUEMENT sur la fiche d'un partenaire. Le
 * propriétaire a ouvert la page « Partenaires », n'a rien vu, et a eu raison :
 * c'est cette page-là qu'on ouvre en premier. Le bloc vit donc dans un seul
 * composant, posé aux DEUX endroits — une implémentation, aucun écran où il
 * manque.
 *
 * ── QUI ÉCRIT ─────────────────────────────────────────────────────────────
 *
 * Le fondateur seul. Le partenaire est administrateur — il voit tout, c'est le
 * principe — mais chaque ligne ajoutée diminue sa part : cette écriture ne peut
 * pas lui appartenir. La garde qui compte vit dans les actions serveur, qui
 * sont des adresses appelables directement (voir `actions.ts`) ; celle d'ici ne
 * fait que cacher des boutons.
 */
import { createClient as createServerClient } from "@/utils/supabase/server";
import { estFondateur } from "@/lib/admins";
import { depensesParMois, lireTauxUsdXof } from "@/lib/depenses";
import VueDepenses from "./VueDepenses";

export default async function BlocDepenses() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [taux, parMois] = await Promise.all([lireTauxUsdXof(), depensesParMois()]);
  const mois = [...parMois.values()].sort((a, b) => b.mois.localeCompare(a.mois));

  return <VueDepenses fondateur={estFondateur(user?.email)} taux={taux} mois={mois} />;
}
