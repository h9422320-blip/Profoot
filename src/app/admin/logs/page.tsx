import { createClient as createServerClient } from "@/utils/supabase/server";
import LogsClient from "./LogsClient";
import { redirect } from "next/navigation";

const ADMIN_EMAIL = "h9422320@gmail.com";

export default async function LogsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return <LogsClient />;
}
