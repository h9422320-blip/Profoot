// ============================================================================
// ProFoot — API-FOOTBALL CLIENT v2.0 (Centralized, Cached, Real-Time)
// ============================================================================
// Ce module centralise TOUTES les requêtes vers API-FOOTBALL.
// Cache intelligent en mémoire avec TTL configurable.
// Fallback sécurisé en cas d'erreur réseau.
// ============================================================================

const API_BASE = "https://v3.football.api-sports.io";

// ---------------------------------------------------------------------------
// In-Memory Cache with TTL
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  memoryCache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

// TTL Constants
const TTL = {
  FIXTURES_LIVE: 60 * 1000,           // 1 minute for live data
  FIXTURES_TODAY: 5 * 60 * 1000,      // 5 minutes for today's fixtures
  FIXTURES_UPCOMING: 30 * 60 * 1000,  // 30 minutes for upcoming fixtures
  STANDINGS: 60 * 60 * 1000,          // 1 hour for standings
  TEAM_INFO: 24 * 60 * 60 * 1000,     // 24 hours for team info
};

// ---------------------------------------------------------------------------
// Core Fetch Function
// ---------------------------------------------------------------------------
async function apiFootballFetch<T = any>(endpoint: string, ttl: number = TTL.FIXTURES_TODAY): Promise<T | null> {
  const API_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_KEY || API_KEY === "MA_CLE_API" || API_KEY === "") {
    console.error("[API-FOOTBALL] Clé API manquante");
    return null;
  }

  const cacheKey = `apifb:${endpoint}`;
  const cached = getCached<T>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${API_BASE}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[API-FOOTBALL] HTTP ${res.status} on ${endpoint}`);
      return null;
    }

    const json = await res.json();
    setCache(cacheKey, json, ttl);
    return json as T;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error(`[API-FOOTBALL] Timeout on ${endpoint}`);
    } else {
      console.error(`[API-FOOTBALL] Network error on ${endpoint}:`, err.message);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Major League IDs (API-Football)
// ---------------------------------------------------------------------------
export const LEAGUE_IDS: Record<string, number> = {
  epl: 39,
  laliga: 140,
  seriea: 135,
  bundesliga: 78,
  ligue1: 61,
  ucl: 2,
  uel: 3,
  uecl: 848,
  eredivisie: 88,
  ligaportugal: 94,
  proleague: 144,
  premiership: 179,
  superlig: 203,
  wc: 1,
  can: 6,
  caf: 12,
  nations_league: 5,
};

/**
 * Saison en cours, calculée et non écrite en dur.
 *
 * Chez API-Football, une saison de club est désignée par son année de début :
 * « 2026 » = saison 2026-2027, qui démarre à la mi-août. À partir du 1er août
 * on bascule donc sur la nouvelle saison. Ce calcul évite d'avoir à réécrire
 * ce fichier chaque été — c'est ce qui avait laissé toute l'application sur
 * la saison 2025-2026.
 */
export function getClubSeason(now: Date = new Date()): number {
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Compétitions internationales : leur millésime ne suit pas le cycle des clubs. */
const INTERNATIONAL_SEASONS: Record<string, (y: number) => number> = {
  // Coupe du monde : tous les 4 ans (2026, 2030…)
  wc: (y) => y - ((y - 2026) % 4 + 4) % 4,
  // CAN : années impaires depuis 2025
  can: (y) => (y % 2 === 1 ? y : y - 1),
  // Ligue des nations : cycle bisannuel depuis 2024
  nations_league: (y) => (y % 2 === 0 ? y : y - 1),
};

/**
 * Libellé de saison affiché à l'écran : « 2026-27 » pour un championnat de
 * clubs, l'année seule pour une compétition internationale. Les libellés
 * étaient écrits en dur dans le référentiel et affichaient encore 2025-26.
 */
export function getSeasonLabel(leagueKey: string, now: Date = new Date()): string {
  const year = getSeason(leagueKey, now);
  if (INTERNATIONAL_SEASONS[leagueKey]) return String(year);
  return `${year}-${String(year + 1).slice(2)}`;
}

/** Saison à interroger pour une compétition donnée. */
export function getSeason(leagueKey: string, now: Date = new Date()): number {
  const special = INTERNATIONAL_SEASONS[leagueKey];
  if (special) return special(now.getFullYear());
  return getClubSeason(now);
}

/**
 * Conservé pour compatibilité : se comporte comme un objet mais renvoie
 * désormais une valeur calculée au lieu d'une constante périmée.
 */
export const CURRENT_SEASON: Record<string, number> = new Proxy(
  {},
  { get: (_t, key: string) => getSeason(key) }
) as Record<string, number>;

// ---------------------------------------------------------------------------
// Public API Functions
// ---------------------------------------------------------------------------

/**
 * Get today's fixtures across all major leagues
 */
export async function getTodayFixtures() {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const data = await apiFootballFetch<any>(`/fixtures?date=${today}`, TTL.FIXTURES_TODAY);
  return data?.response || [];
}

/**
 * Get upcoming fixtures for a date range (next N days)
 */
export async function getUpcomingFixtures(days: number = 7) {
  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const to = new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  // Fetch from major leagues to avoid too many results
  const majorLeagues = [39, 140, 135, 78, 61, 2, 3, 1, 6]; // EPL, Liga, SerieA, Bund, L1, UCL, UEL, WC, CAN
  
  const allFixtures: any[] = [];
  
  // Batch requests — max 3 parallel to respect rate limits
  for (let i = 0; i < majorLeagues.length; i += 3) {
    const batch = majorLeagues.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(leagueId => 
        apiFootballFetch<any>(`/fixtures?league=${leagueId}&season=${getSeasonForLeague(leagueId)}&from=${from}&to=${to}`, TTL.FIXTURES_UPCOMING)
      )
    );
    results.forEach(r => {
      if (r?.response) allFixtures.push(...r.response);
    });
  }

  // Sort by date
  allFixtures.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
  return allFixtures;
}

/**
 * Get live fixtures
 */
export async function getLiveFixtures() {
  const data = await apiFootballFetch<any>(`/fixtures?live=all`, TTL.FIXTURES_LIVE);
  return data?.response || [];
}

/**
 * Get recently finished fixtures (last 3 days)
 */
export async function getRecentResults(days: number = 3) {
  const today = new Date();
  const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  const majorLeagues = [39, 140, 135, 78, 61, 2, 3];
  const allFixtures: any[] = [];

  for (let i = 0; i < majorLeagues.length; i += 3) {
    const batch = majorLeagues.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(leagueId =>
        apiFootballFetch<any>(`/fixtures?league=${leagueId}&season=${getSeasonForLeague(leagueId)}&from=${from}&to=${to}`, TTL.FIXTURES_UPCOMING)
      )
    );
    results.forEach(r => {
      if (r?.response) allFixtures.push(...r.response);
    });
  }

  // Filter only finished matches and sort by most recent
  const finished = allFixtures.filter(f => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
  finished.sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
  return finished;
}

/**
 * Get standings for a specific league
 */
export async function getStandings(leagueId: string) {
  const apiId = LEAGUE_IDS[leagueId];
  const season = CURRENT_SEASON[leagueId] || 2025;
  if (!apiId) return null;

  const data = await apiFootballFetch<any>(`/standings?league=${apiId}&season=${season}`, TTL.STANDINGS);
  if (!data?.response?.[0]?.league?.standings) return null;

  return data.response[0].league.standings;
}

/**
 * Get fixture details by fixture ID
 */
export async function getFixtureById(fixtureId: number) {
  const data = await apiFootballFetch<any>(`/fixtures?id=${fixtureId}`, TTL.FIXTURES_TODAY);
  return data?.response?.[0] || null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function getSeasonForLeague(apiLeagueId: number): number {
  // Retrouve la clé de compétition à partir de son identifiant API pour
  // réutiliser le calcul de saison commun — plus aucune année en dur.
  const key = Object.keys(LEAGUE_IDS).find((k) => LEAGUE_IDS[k] === apiLeagueId);
  return getSeason(key || 'epl');
}

/**
 * Normalize an API-Football fixture into a simplified format for the frontend
 */
export function normalizeFixture(fixture: any) {
  const f = fixture.fixture;
  const teams = fixture.teams;
  const goals = fixture.goals;
  const league = fixture.league;

  const matchDate = new Date(f.date);
  const status = f.status.short;

  let matchStatus: "live" | "finished" | "future" | "today" = "future";
  if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT"].includes(status)) {
    matchStatus = "live";
  } else if (["FT", "AET", "PEN"].includes(status)) {
    matchStatus = "finished";
  } else {
    // Check if the match is today
    const today = new Date();
    if (
      matchDate.getFullYear() === today.getFullYear() &&
      matchDate.getMonth() === today.getMonth() &&
      matchDate.getDate() === today.getDate()
    ) {
      matchStatus = "today";
    }
  }

  return {
    id: `api-${f.id}`,
    fixtureId: f.id,
    homeTeam: {
      id: teams.home.id,
      name: teams.home.name,
      logo: teams.home.logo,
      winner: teams.home.winner,
    },
    awayTeam: {
      id: teams.away.id,
      name: teams.away.name,
      logo: teams.away.logo,
      winner: teams.away.winner,
    },
    competition: {
      id: league.id,
      name: league.name,
      country: league.country,
      logo: league.logo,
      round: league.round,
    },
    date: matchDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    fullDate: matchDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" }),
    time: matchDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }),
    timestamp: matchDate.getTime(),
    venue: f.venue?.name || "TBD",
    city: f.venue?.city || "",
    status: matchStatus,
    statusDetail: f.status.long,
    minute: f.status.elapsed,
    score: goals ? { home: goals.home, away: goals.away } : null,
    referee: f.referee,
  };
}

/**
 * Normalize an API-Football standing row
 */
export function normalizeStandingRow(row: any) {
  return {
    rank: row.rank,
    team: {
      id: row.team.id,
      name: row.team.name,
      logo: row.team.logo,
    },
    points: row.points,
    goalsDiff: row.goalsDiff,
    played: row.all.played,
    wins: row.all.win,
    draws: row.all.draw,
    losses: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    form: row.form ? row.form.split("").slice(-5) : [],
    description: row.description,
    status: row.status,
  };
}
