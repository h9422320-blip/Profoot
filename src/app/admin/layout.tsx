import { createClient as createServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AdminLayoutClient from "./AdminLayoutClient";
import { getAlertes } from "@/lib/admin-metrics";
import { lireReglages } from "@/lib/app-settings";
import { estAdmin } from "@/lib/admins";

/**
 * Porte d'entrée de l'administration.
 *
 * Une seule condition : être connecté avec une adresse figurant dans la liste
 * des administrateurs. Cette liste vit dans `src/lib/admins.ts`, et la
 * comparaison y est faite en minuscules.
 *
 * Ce contrôle est répété dans chaque action serveur, et non pas seulement ici :
 * une action est une adresse appelable directement, elle ne traverse pas ce
 * gabarit et n'hérite donc d'aucune de ses protections.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    redirect("/analyze");
  }

  // LE VERROU PAR LIEN PERSONNEL A ÉTÉ RETIRÉ le 16/08/2026, sur demande.
  //
  // Il exigeait, en plus du compte, un cookie déposé par un lien secret
  // (/a/<clé>). Il protégeait contre une session volée : la voler ne suffisait
  // pas, il fallait aussi connaître le lien. Il rendait en revanche l'arrivée
  // d'un nouvel administrateur incompréhensible — connecté, autorisé, et
  // pourtant renvoyé vers l'accueil sans un mot d'explication.
  //
  // Le contrôle du compte ci-dessus reste entier : il est désormais seul.
  // Pour le rétablir, remettre ici la vérification du cookie et renseigner
  // ADMIN_ACCESS_KEY ; le module admin-access et la route /a/<clé> sont
  // conservés intacts à cette fin.

  const [alertes, reglages] = await Promise.all([getAlertes(), lireReglages()]);

  return (
    <AdminLayoutClient user={user} alertes={alertes} appName={reglages.appName} maintenance={reglages.maintenance}>
      {children}
    </AdminLayoutClient>
  );
}
