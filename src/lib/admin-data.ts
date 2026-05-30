// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROFOOT ADMIN — MOCK DATA ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const adminStats = {
  totalUsers: 1247,
  activeToday: 89,
  totalAnalyses: 4832,
  analysesToday: 156,
  avgResponseTime: 12.4,
  aiAccuracy: 72.8,
  revenue: 8940,
  proUsers: 312,
  premiumUsers: 87,
  freeUsers: 848,
  errorRate: 0.3,
  uptime: 99.97,
};

export const realtimeStats = {
  connectedNow: 23,
  analysesInProgress: 4,
  peakToday: 67,
  avgSessionDuration: "14m 32s",
  trafficByCountry: [
    { country: "France", flag: "🇫🇷", users: 412, pct: 33 },
    { country: "Espagne", flag: "🇪🇸", users: 198, pct: 16 },
    { country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", users: 167, pct: 13 },
    { country: "Allemagne", flag: "🇩🇪", users: 134, pct: 11 },
    { country: "Italie", flag: "🇮🇹", users: 98, pct: 8 },
    { country: "Brésil", flag: "🇧🇷", users: 87, pct: 7 },
    { country: "Argentine", flag: "🇦🇷", users: 62, pct: 5 },
    { country: "Autres", flag: "🌍", users: 89, pct: 7 },
  ],
  deviceSplit: { desktop: 62, mobile: 34, tablet: 4 },
  trafficHourly: [12, 8, 5, 3, 2, 4, 15, 34, 52, 67, 58, 45, 61, 55, 48, 62, 71, 64, 53, 42, 35, 28, 22, 16],
};

export const users = [
  { id: "u1", name: "Lucas Martin", email: "lucas.martin@gmail.com", country: "🇫🇷 France", device: "Chrome / MacOS", plan: "Pro", analyses: 47, lastActive: "il y a 2 min", joined: "12 jan 2026", status: "online" },
  { id: "u2", name: "Carlos Rivera", email: "c.rivera@outlook.es", country: "🇪🇸 Espagne", device: "Safari / iPhone", plan: "Premium", analyses: 124, lastActive: "il y a 5 min", joined: "03 nov 2025", status: "online" },
  { id: "u3", name: "James Wilson", email: "jwilson@protonmail.com", country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre", device: "Firefox / Windows", plan: "Gratuit", analyses: 8, lastActive: "il y a 1h", joined: "28 avr 2026", status: "offline" },
  { id: "u4", name: "Sophie Dupont", email: "sophie.d@free.fr", country: "🇫🇷 France", device: "Chrome / Windows", plan: "Pro", analyses: 63, lastActive: "il y a 12 min", joined: "19 fév 2026", status: "online" },
  { id: "u5", name: "Marco Rossi", email: "m.rossi@libero.it", country: "🇮🇹 Italie", device: "Edge / Windows", plan: "Gratuit", analyses: 3, lastActive: "il y a 3h", joined: "14 mai 2026", status: "offline" },
  { id: "u6", name: "Fatima Benzema", email: "fatima.b@yahoo.fr", country: "🇫🇷 France", device: "Chrome / Android", plan: "Pro", analyses: 91, lastActive: "il y a 8 min", joined: "07 déc 2025", status: "online" },
  { id: "u7", name: "Pedro Santos", email: "p.santos@gmail.com", country: "🇧🇷 Brésil", device: "Chrome / MacOS", plan: "Premium", analyses: 156, lastActive: "il y a 1 min", joined: "22 sept 2025", status: "online" },
  { id: "u8", name: "Elena Fischer", email: "elena.f@web.de", country: "🇩🇪 Allemagne", device: "Firefox / Linux", plan: "Gratuit", analyses: 12, lastActive: "il y a 6h", joined: "01 mai 2026", status: "offline" },
  { id: "u9", name: "Mateo García", email: "mateo.g@hotmail.com", country: "🇦🇷 Argentine", device: "Safari / iPhone", plan: "Pro", analyses: 78, lastActive: "il y a 20 min", joined: "15 jan 2026", status: "online" },
  { id: "u10", name: "Amina Diallo", email: "amina.d@orange.fr", country: "🇫🇷 France", device: "Chrome / MacOS", plan: "Gratuit", analyses: 5, lastActive: "il y a 2 jours", joined: "10 mai 2026", status: "offline" },
];

export const analysisHistory = [
  { id: "a1", user: "Lucas Martin", team1: "Real Madrid", team2: "Arsenal", score: "3-1", confidence: 87, date: "17 mai 2026 14:32", duration: "11.2s", status: "correct" },
  { id: "a2", user: "Carlos Rivera", team1: "Barcelona", team2: "Atlético Madrid", score: "2-1", confidence: 82, date: "17 mai 2026 13:15", duration: "14.8s", status: "pending" },
  { id: "a3", user: "Sophie Dupont", team1: "PSG", team2: "Manchester City", score: "1-2", confidence: 74, date: "17 mai 2026 12:44", duration: "9.7s", status: "correct" },
  { id: "a4", user: "Pedro Santos", team1: "Liverpool", team2: "Bayern Munich", score: "2-2", confidence: 68, date: "17 mai 2026 11:30", duration: "13.1s", status: "incorrect" },
  { id: "a5", user: "Fatima Benzema", team1: "Juventus", team2: "Inter Milan", score: "1-0", confidence: 79, date: "17 mai 2026 10:22", duration: "10.5s", status: "correct" },
  { id: "a6", user: "James Wilson", team1: "Chelsea", team2: "Tottenham", score: "2-1", confidence: 71, date: "16 mai 2026 22:18", duration: "15.3s", status: "correct" },
  { id: "a7", user: "Mateo García", team1: "France", team2: "Argentine", score: "1-1", confidence: 65, date: "16 mai 2026 20:05", duration: "12.8s", status: "pending" },
  { id: "a8", user: "Elena Fischer", team1: "Borussia Dortmund", team2: "RB Leipzig", score: "3-2", confidence: 72, date: "16 mai 2026 18:30", duration: "11.9s", status: "incorrect" },
  { id: "a9", user: "Lucas Martin", team1: "Napoli", team2: "AC Milan", score: "2-0", confidence: 81, date: "16 mai 2026 16:15", duration: "10.1s", status: "correct" },
  { id: "a10", user: "Carlos Rivera", team1: "Manchester United", team2: "Arsenal", score: "0-2", confidence: 78, date: "16 mai 2026 14:42", duration: "13.6s", status: "correct" },
  { id: "a11", user: "Sophie Dupont", team1: "Real Madrid", team2: "Barcelona", score: "2-2", confidence: 70, date: "16 mai 2026 12:10", duration: "14.2s", status: "pending" },
  { id: "a12", user: "Pedro Santos", team1: "PSG", team2: "Marseille", score: "3-1", confidence: 85, date: "15 mai 2026 23:05", duration: "9.4s", status: "correct" },
];

export const aiPerformance = {
  overall: 72.8,
  byCompetition: [
    { name: "Ligue 1", accuracy: 78.2, total: 312 },
    { name: "Premier League", accuracy: 74.5, total: 567 },
    { name: "La Liga", accuracy: 71.8, total: 445 },
    { name: "Serie A", accuracy: 69.4, total: 298 },
    { name: "Bundesliga", accuracy: 73.1, total: 234 },
    { name: "Champions League", accuracy: 68.9, total: 187 },
    { name: "Internationaux", accuracy: 64.3, total: 89 },
  ],
  exactScoreAccuracy: 18.4,
  resultAccuracy: 72.8,
  weeklyAccuracy: [68, 71, 74, 69, 73, 76, 72],
  topPredictedClubs: [
    { club: "Real Madrid", analyses: 234, accuracy: 76.2 },
    { club: "Barcelona", analyses: 198, accuracy: 74.8 },
    { club: "PSG", analyses: 187, accuracy: 71.3 },
    { club: "Arsenal", analyses: 176, accuracy: 73.9 },
    { club: "Manchester City", analyses: 165, accuracy: 75.1 },
    { club: "Liverpool", analyses: 156, accuracy: 72.6 },
    { club: "Bayern Munich", analyses: 143, accuracy: 70.8 },
    { club: "Juventus", analyses: 121, accuracy: 69.5 },
  ],
};

export const systemLogs = [
  { id: "l1", type: "error", message: "API Gemini timeout - analyse Real Madrid vs Arsenal", timestamp: "17 mai 14:32:15", severity: "high" },
  { id: "l2", type: "warning", message: "Temps de réponse élevé: 28.3s (seuil: 20s)", timestamp: "17 mai 14:12:08", severity: "medium" },
  { id: "l3", type: "success", message: "Mise à jour du cache des compositions réussie", timestamp: "17 mai 13:45:00", severity: "low" },
  { id: "l4", type: "error", message: "Google Search Grounding - quota temporairement atteint", timestamp: "17 mai 12:58:33", severity: "high" },
  { id: "l5", type: "info", message: "Nouveau déploiement v3.2.1 appliqué", timestamp: "17 mai 11:00:00", severity: "low" },
  { id: "l6", type: "warning", message: "Taux d'erreur API au-dessus de 2% pendant 5 min", timestamp: "17 mai 10:15:22", severity: "medium" },
  { id: "l7", type: "success", message: "Backup base de données complété", timestamp: "17 mai 06:00:00", severity: "low" },
  { id: "l8", type: "error", message: "JSON parse error - réponse IA malformée (PSG vs City)", timestamp: "16 mai 23:44:11", severity: "high" },
  { id: "l9", type: "info", message: "SSL certificat renouvelé automatiquement", timestamp: "16 mai 22:00:00", severity: "low" },
  { id: "l10", type: "warning", message: "Mémoire serveur à 82% - surveillance active", timestamp: "16 mai 20:30:45", severity: "medium" },
  { id: "l11", type: "success", message: "Migration données utilisateurs v2 -> v3 terminée", timestamp: "16 mai 18:00:00", severity: "low" },
  { id: "l12", type: "error", message: "Rate limit Gemini API - 429 Too Many Requests", timestamp: "16 mai 16:22:09", severity: "high" },
];

export const subscriptions = {
  plans: [
    { name: "Gratuit", users: 848, color: "text-foreground/60", revenue: 0 },
    { name: "Pro", users: 312, color: "text-primary", revenue: 3120 },
    { name: "Premium", users: 87, color: "text-warning", revenue: 5820 },
  ],
  mrr: 8940,
  growth: 12.4,
  churnRate: 2.1,
  ltv: 142,
  revenueHistory: [4200, 5100, 5800, 6400, 7200, 7800, 8200, 8500, 8940],
};

export const ADMIN_PASSWORD = "profoot2026admin";
