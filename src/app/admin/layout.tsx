import { createClient as createServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdminLayoutClient from "./AdminLayoutClient";
import { COOKIE_ADMIN, cleAdminAttendue, cleValide } from "@/lib/admin-access";

const ADMIN_EMAIL = "h9422320@gmail.com";

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

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/analyze");
  }

  const attendue = cleAdminAttendue();
  if (attendue) {
    const jeton = (await cookies()).get(COOKIE_ADMIN)?.value;
    if (!cleValide(jeton, attendue)) {
      redirect("/analyze");
    }
  }

  return <AdminLayoutClient user={user}>{children}</AdminLayoutClient>;
}
