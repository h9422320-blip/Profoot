import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import FinancesClient from "./FinancesClient";
import { redirect } from "next/navigation";

const ADMIN_EMAIL = "h9422320@gmail.com";
const CURRENT_PRICE_CFA = 20000;

async function getFinanceData() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return { premiumUsers: 0, totalUsers: 0, mrr: 0, arpu: 0 };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = usersData?.users || [];
  const totalUsers = allUsers.length;

  const premiumUsers = allUsers.filter(u =>
    u.user_metadata?.is_pro === true || u.app_metadata?.is_pro === true
  ).length;

  const mrr = premiumUsers * CURRENT_PRICE_CFA;
  const arpu = totalUsers > 0 ? mrr / totalUsers : 0;

  return { premiumUsers, totalUsers, mrr, arpu };
}

export default async function FinancesPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const data = await getFinanceData();

  return <FinancesClient data={data} />;
}
