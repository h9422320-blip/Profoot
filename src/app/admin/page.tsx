import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/utils/supabase/server";
import AdminDashboardClient from "./AdminDashboardClient";

const ADMIN_EMAIL = "kuzmabah@gmail.com";

async function getRealData() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Vrais utilisateurs inscrits
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = usersData?.users || [];

  const totalUsers = allUsers.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newUsersToday = allUsers.filter(u => new Date(u.created_at) >= today).length;

  // 2. Vrais abonnements premium (depuis les métadonnées utilisateur)
  const premiumUsers = allUsers.filter(u => 
    u.user_metadata?.is_pro === true || u.app_metadata?.is_pro === true
  ).length;

  // 3. Vraies analyses depuis l'historique
  const { data: analyses, error: analysesError } = await supabaseAdmin
    .from("analysis_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const allAnalyses = analyses || [];
  const analysesToday = allAnalyses.filter(a => new Date(a.created_at) >= today).length;
  const totalAnalyses = allAnalyses.length;

  // 4. Derniers inscrits (les 8 plus récents)
  const recentUsers = allUsers
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map(u => ({
      id: u.id,
      email: u.email || "—",
      name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Utilisateur",
      isPro: u.user_metadata?.is_pro === true || u.app_metadata?.is_pro === true,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at || null,
    }));

  // 5. Dernières analyses (les 10 plus récentes)
  const recentAnalyses = allAnalyses.slice(0, 10).map(a => ({
    id: a.id,
    team1: a.team1_name || "Équipe 1",
    team2: a.team2_name || "Équipe 2",
    createdAt: a.created_at,
    userId: a.user_id,
  }));

  // 6. Analyses par jour sur les 7 derniers jours (graphique)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d;
  }).reverse();

  const analysisChart = last7Days.map(day => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const count = allAnalyses.filter(a => {
      const d = new Date(a.created_at);
      return d >= day && d < next;
    }).length;
    return {
      label: day.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      count,
    };
  });

  return {
    totalUsers,
    newUsersToday,
    premiumUsers,
    freeUsers: totalUsers - premiumUsers,
    totalAnalyses,
    analysesToday,
    recentUsers,
    recentAnalyses,
    analysisChart,
  };
}

export default async function AdminPage() {
  // Vérification de sécurité côté serveur
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/analyze");
  }

  const data = await getRealData();

  return <AdminDashboardClient data={data} adminEmail={ADMIN_EMAIL} />;
}
