import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/utils/supabase/server";
import AdminDashboardClient from "./AdminDashboardClient";

const ADMIN_EMAIL = "h9422320@gmail.com";

// ─── PRICING (en Francs CFA) ───────────────────────────────────────────────
// Abonnement Mensuel : 20 000 CFA
// Abonnement Annuel  : 60 000 CFA
const PROD_MONTHLY_CFA = 20000;
const PROD_ANNUAL_CFA = 60000;
const IS_TEST_MODE = false;         // false = mode production (prix réels)
const CURRENT_PRICE_CFA = PROD_MONTHLY_CFA;

// Coût estimé par requête IA en CFA (~0.02 USD * ~600 CFA/USD)
const COST_PER_ANALYSIS_CFA = 12;

// ─── EMPTY DATA (état initial si erreur) ───────────────────────────────────
const emptyData = {
  totalUsers: 0,
  newUsersToday: 0,
  premiumUsers: 0,
  freeUsers: 0,
  totalAnalyses: 0,
  analysesToday: 0,
  mrr: 0,
  arpu: 0,
  activeUsers24h: 0,
  activeUsers7d: 0,
  activeUsers30d: 0,
  totalAnalysesCost: 0,
  recentUsers: [] as any[],
  recentAnalyses: [] as any[],
  monthlyStats: [] as any[],
  analysisChart: Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      count: 0,
    };
  }),
  pricingConfig: {
    currentPriceCfa: CURRENT_PRICE_CFA,
    monthlyPriceCfa: PROD_MONTHLY_CFA,
    annualPriceCfa: PROD_ANNUAL_CFA,
    isTestMode: IS_TEST_MODE,
    costPerAnalysisCfa: COST_PER_ANALYSIS_CFA,
  },
  error: null as string | null,
};

// ─── MAIN DATA FETCHER ──────────────────────────────────────────────────────
async function getRealData() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return {
      ...emptyData,
      error: "⚠️ La clé SUPABASE_SERVICE_ROLE_KEY est manquante dans les variables d'environnement Vercel.",
    };
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Fetch tous les utilisateurs ───────────────────────────────────
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const allUsers = usersData?.users || [];
    const totalUsers = allUsers.length;

    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const newUsersToday = allUsers.filter(u => new Date(u.created_at) >= today).length;
    const activeUsers24h = allUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= last24h).length;
    const activeUsers7d = allUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= last7d).length;
    const activeUsers30d = allUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= last30d).length;

    const premiumUsers = allUsers.filter(u =>
      u.user_metadata?.is_pro === true || u.app_metadata?.is_pro === true
    ).length;

    // ── 2. Financials en CFA ─────────────────────────────────────────────
    const mrr = premiumUsers * CURRENT_PRICE_CFA;
    const arpu = totalUsers > 0 ? mrr / totalUsers : 0;

    // ── 3. Fetch analyses ────────────────────────────────────────────────
    const { data: analyses } = await supabaseAdmin
      .from("analysis_history")
      .select("id, user_id, team1_name, team2_name, score, summary, created_at, confidence")
      .order("created_at", { ascending: false })
      .limit(1000);

    const allAnalyses = analyses || [];
    const analysesToday = allAnalyses.filter(a => new Date(a.created_at) >= today).length;
    const totalAnalyses = allAnalyses.length;
    const totalAnalysesCost = totalAnalyses * COST_PER_ANALYSIS_CFA;

    // ── 4. Fetch monthly_stats depuis Supabase ────────────────────────────
    const { data: monthlyStatsRaw } = await supabaseAdmin
      .from("monthly_stats")
      .select("*")
      .order("year", { ascending: true })
      .order("month", { ascending: true });

    const monthlyStats = (monthlyStatsRaw || []).map((row: any) => ({
      id: row.id,
      year: row.year,
      month: row.month,
      newUsers: row.new_users ?? 0,
      cancelledUsers: row.cancelled_users ?? 0,
      totalPremiumUsers: row.total_premium_users ?? 0,
      totalAnalyses: row.total_analyses ?? 0,
      marketingBudgetCfa: row.marketing_budget_cfa ?? 0,
      notes: row.notes || "",
      // Calculs dérivés
      mrr: (row.total_premium_users ?? 0) * CURRENT_PRICE_CFA,
      churnRate: row.new_users > 0
        ? ((row.cancelled_users ?? 0) / Math.max(row.new_users, 1)) * 100
        : 0,
      cac: (row.new_users ?? 0) > 0
        ? Math.round((row.marketing_budget_cfa ?? 0) / row.new_users)
        : 0,
    }));

    // ── 5. Formater les utilisateurs ──────────────────────────────────────
    const recentUsers = allUsers
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(u => ({
        id: u.id,
        email: u.email || "—",
        name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Utilisateur",
        isPro: u.user_metadata?.is_pro === true || u.app_metadata?.is_pro === true,
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at || null,
        phone: u.phone || null,
        provider: u.app_metadata?.provider || "email",
        emailConfirmed: !!u.email_confirmed_at,
        country: u.user_metadata?.country || null,
      }));

    // ── 6. Formater les analyses ──────────────────────────────────────────
    const recentAnalyses = allAnalyses.map((a: any) => ({
      id: a.id,
      team1: a.team1_name || "Équipe 1",
      team2: a.team2_name || "Équipe 2",
      createdAt: a.created_at,
      userId: a.user_id,
      score: a.score || "N/A",
      summary: a.summary || "Aucun résumé disponible.",
      confidence: a.confidence || 0,
    }));

    // ── 7. Graphique d'activité (7 derniers jours, données réelles) ───────
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const analysisChart = last7Days.map(day => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const count = allAnalyses.filter((a: any) => {
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
      mrr,
      arpu,
      activeUsers24h,
      activeUsers7d,
      activeUsers30d,
      totalAnalysesCost,
      recentUsers,
      recentAnalyses,
      monthlyStats,
      analysisChart,
      pricingConfig: {
        currentPriceCfa: CURRENT_PRICE_CFA,
        monthlyPriceCfa: PROD_MONTHLY_CFA,
        annualPriceCfa: PROD_ANNUAL_CFA,
        isTestMode: IS_TEST_MODE,
        costPerAnalysisCfa: COST_PER_ANALYSIS_CFA,
      },
      error: null,
    };
  } catch (e: any) {
    return {
      ...emptyData,
      error: `Erreur serveur : ${e.message}`,
    };
  }
}

// ─── PAGE COMPONENT ─────────────────────────────────────────────────────────
export default async function AdminPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/analyze");
  }

  const data = await getRealData();
  return <AdminDashboardClient data={data} adminEmail={ADMIN_EMAIL} />;
}
