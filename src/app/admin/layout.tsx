import { createClient as createServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdminLayoutClient from "./AdminLayoutClient";
import { COOKIE_ADMIN, cleAdminAttendue, cleValide } from "@/lib/admin-access";
import { getAlertes } from "@/lib/admin-metrics";
import { lireReglages } from "@/lib/app-settings";
import { estAdmin } from "@/lib/admins";

/**
 * Double verrou sur l'administration.
 *
 * 1. Le compte connecté doit être celui de l'administrateur.
 * 2. Si une clé d'accès est configurée, le navigateur doit porter le cookie
 *    posé par le lien personnel.
 *
 * Le second verrou signifie qu'une session volée ne suffit pas : il faut aussi
 * connaître le lien. Quand aucune clé n'est configurée, seul le premier verrou
 * s'applique — ainsi un oubli de configuration ne coupe jamais l'accès à
 * l'administrateur légitime.
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

  const attendue = cleAdminAttendue();
  if (attendue) {
    const jeton = (await cookies()).get(COOKIE_ADMIN)?.value;
    if (!cleValide(jeton, attendue)) {
      redirect("/analyze");
    }
  }

  const [alertes, reglages] = await Promise.all([getAlertes(), lireReglages()]);

  return (
    <AdminLayoutClient user={user} alertes={alertes} appName={reglages.appName} maintenance={reglages.maintenance}>
      {children}
    </AdminLayoutClient>
  );
}
