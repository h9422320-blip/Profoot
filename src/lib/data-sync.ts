// ============================================================================
// ProFoot — DATA SYNC ENGINE v1.0 (Server-side Real-Time Synchronization)
// ============================================================================
// This module bridges API-FOOTBALL data with the existing data.ts interface.
// It runs server-side, fetches real data, and syncs the in-memory stores
// that the frontend pages already consume via data.ts exports.
// ============================================================================

import {
  getTodayFixtures,
  getUpcomingFixtures,
  getRecentResults,
  getLiveFixtures,
  getStandings as getApiStandings,
  normalizeFixture,
  normalizeStandingRow,
  LEAGUE_IDS,
  CURRENT_SEASON,
} from "./api-football";

// ---------------------------------------------------------------------------
// Types matching data.ts interface
// ---------------------------------------------------------------------------
interface SyncMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  date: string;
  time: string;
  venue: string;
  status: "finished" | "live" | "today" | "future";
  minute?: number;
  score?: { home: number; away: number };
  prediction?: { winner: "home" | "away" | "draw"; score: string; confidence: number };
  result?: { home: number; away: number };
  // Extended fields from API-Football
  homeTeamData?: { id: number; name: string; logo: string };
  awayTeamData?: { id: number; name: string; logo: string };
  competitionData?: { id: number; name: string; logo: string; country: string; round: string };
  referee?: string;
  city?: string;
}

interface SyncStandingRow {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  form: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// In-Memory Synced Data Store
// ---------------------------------------------------------------------------
let syncedMatches: SyncMatch[] = [];
let syncedStandings: Record<string, SyncStandingRow[]> = {};
let lastMatchSync = 0;
let lastStandingsSync = 0;
let isSyncing = false;

const MATCH_SYNC_INTERVAL = 3 * 60 * 1000;    // 3 minutes
const STANDINGS_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Match Sync
// ---------------------------------------------------------------------------
export async function syncMatches(): Promise<SyncMatch[]> {
  const now = Date.now();
  
  // Return cached if still fresh
  if (syncedMatches.length > 0 && now - lastMatchSync < MATCH_SYNC_INTERVAL) {
    return syncedMatches;
  }

  // Prevent concurrent syncs
  if (isSyncing) {
    return syncedMatches;
  }

  isSyncing = true;
  console.log("[SYNC] 🔄 Synchronisation des matchs en cours...");

  try {
    // Fetch all match types in parallel
    const [liveRaw, todayRaw, upcomingRaw, recentRaw] = await Promise.all([
      getLiveFixtures().catch(() => []),
      getTodayFixtures().catch(() => []),
      getUpcomingFixtures(7).catch(() => []),
      getRecentResults(5).catch(() => []),
    ]);

    // Deduplicate by fixture ID
    const seen = new Set<number>();
    const allRaw: any[] = [];

    const addUnique = (arr: any[]) => {
      for (const f of arr) {
        const fid = f.fixture?.id;
        if (fid && !seen.has(fid)) {
          seen.add(fid);
          allRaw.push(f);
        }
      }
    };

    addUnique(liveRaw);
    addUnique(todayRaw);
    addUnique(upcomingRaw);
    addUnique(recentRaw);

    // Convert to our format
    const converted: SyncMatch[] = allRaw.map((raw) => {
      const normalized = normalizeFixture(raw);
      const f = raw.fixture;
      const teams = raw.teams;
      const goals = raw.goals;
      const league = raw.league;
      const statusShort = f.status.short;

      let matchStatus: "finished" | "live" | "today" | "future" = "future";
      if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT"].includes(statusShort)) {
        matchStatus = "live";
      } else if (["FT", "AET", "PEN"].includes(statusShort)) {
        matchStatus = "finished";
      } else {
        const matchDate = new Date(f.date);
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
        homeTeam: `api-team-${teams.home.id}`,
        awayTeam: `api-team-${teams.away.id}`,
        competition: findLocalLeagueId(league.id) || `api-league-${league.id}`,
        date: normalized.date,
        time: normalized.time,
        venue: f.venue?.name || "TBD",
        status: matchStatus,
        minute: f.status.elapsed || undefined,
        score: goals ? { home: goals.home ?? 0, away: goals.away ?? 0 } : undefined,
        result: matchStatus === "finished" && goals ? { home: goals.home ?? 0, away: goals.away ?? 0 } : undefined,
        // Extended data for direct rendering
        homeTeamData: { id: teams.home.id, name: teams.home.name, logo: teams.home.logo },
        awayTeamData: { id: teams.away.id, name: teams.away.name, logo: teams.away.logo },
        competitionData: {
          id: league.id,
          name: league.name,
          logo: league.logo,
          country: league.country,
          round: league.round || "",
        },
        referee: f.referee || undefined,
        city: f.venue?.city || undefined,
      };
    });

    // Sort: live first, then today, then future (by date), then finished (most recent first)
    converted.sort((a, b) => {
      const statusOrder = { live: 0, today: 1, future: 2, finished: 3 };
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      // Within same status, sort by time
      return 0;
    });

    syncedMatches = converted;
    lastMatchSync = now;
    console.log(`[SYNC] ✅ ${converted.length} matchs synchronisés (${liveRaw.length} live, ${todayRaw.length} today, ${upcomingRaw.length} upcoming, ${recentRaw.length} recent)`);
  } catch (error: any) {
    console.error("[SYNC] ❌ Erreur de synchronisation des matchs:", error.message);
  } finally {
    isSyncing = false;
  }

  return syncedMatches;
}

// ---------------------------------------------------------------------------
// Standings Sync
// ---------------------------------------------------------------------------
export async function syncStandings(leagueId?: string): Promise<Record<string, SyncStandingRow[]>> {
  const now = Date.now();

  // Return cached if still fresh
  if (Object.keys(syncedStandings).length > 0 && now - lastStandingsSync < STANDINGS_SYNC_INTERVAL) {
    if (leagueId) {
      return { [leagueId]: syncedStandings[leagueId] || [] };
    }
    return syncedStandings;
  }

  console.log("[SYNC] 🔄 Synchronisation des classements...");

  const majorLeagues = leagueId ? [leagueId] : ["epl", "laliga", "seriea", "bundesliga", "ligue1"];

  try {
    const results = await Promise.all(
      majorLeagues.map(async (lid) => {
        const standings = await getApiStandings(lid);
        if (!standings) return { lid, rows: [] };

        let rows: SyncStandingRow[];
        if (Array.isArray(standings[0])) {
          rows = standings[0].map(normalizeStandingRow);
        } else {
          rows = standings.map(normalizeStandingRow);
        }
        return { lid, rows };
      })
    );

    for (const { lid, rows } of results) {
      if (rows.length > 0) {
        syncedStandings[lid] = rows;
      }
    }

    lastStandingsSync = now;
    console.log(`[SYNC] ✅ Classements synchronisés pour ${results.filter(r => r.rows.length > 0).length} ligues`);
  } catch (error: any) {
    console.error("[SYNC] ❌ Erreur de synchronisation des classements:", error.message);
  }

  if (leagueId) {
    return { [leagueId]: syncedStandings[leagueId] || [] };
  }
  return syncedStandings;
}

// ---------------------------------------------------------------------------
// Public Getters (match data.ts interface)
// ---------------------------------------------------------------------------

export async function getSyncedMatches(): Promise<SyncMatch[]> {
  return syncMatches();
}

export async function getSyncedMatchesByStatus(status: string): Promise<SyncMatch[]> {
  const matches = await syncMatches();
  return matches.filter((m) => m.status === status);
}

export async function getSyncedStandings(leagueId?: string): Promise<Record<string, SyncStandingRow[]>> {
  return syncStandings(leagueId);
}

// Force refresh
export async function forceSync(): Promise<void> {
  lastMatchSync = 0;
  lastStandingsSync = 0;
  await Promise.all([syncMatches(), syncStandings()]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findLocalLeagueId(apiLeagueId: number): string | null {
  for (const [localId, apiId] of Object.entries(LEAGUE_IDS)) {
    if (apiId === apiLeagueId) return localId;
  }
  return null;
}
