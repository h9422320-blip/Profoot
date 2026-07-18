import { createClient as createServerClient } from "@/utils/supabase/server";
import SettingsClient from "./SettingsClient";
import { redirect } from "next/navigation";

const ADMIN_EMAIL = "h9422320@gmail.com";

export default async function SettingsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return <SettingsClient />;
}
