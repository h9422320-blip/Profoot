import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import UsersClient from "./UsersClient";
import { redirect } from "next/navigation";

const ADMIN_EMAIL = "h9422320@gmail.com";

async function getUsers() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return [];
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = usersData?.users || [];

  let allActivityLogs: any[] = [];
  try {
    const { data: actData, error: actErr } = await supabaseAdmin
      .from("activity_logs")
      .select("id, user_id, country, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!actErr && actData) allActivityLogs = actData;
  } catch (e) {}

  return allUsers
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(u => {
      const userLogs = allActivityLogs.filter(l => l.user_id === u.id);
      const realCountry = userLogs.find(l => l.country)?.country || u.user_metadata?.country || "Inconnu";

      return {
        id: u.id,
        email: u.email || "—",
        name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Utilisateur",
        isPro: u.user_metadata?.is_pro === true || u.app_metadata?.is_pro === true,
        createdAt: u.created_at,
        country: realCountry,
      };
    });
}

export default async function UsersPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const users = await getUsers();

  return <UsersClient users={users} />;
}
