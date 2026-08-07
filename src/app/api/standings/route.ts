import { NextResponse } from "next/server";
import { getStandings, normalizeStandingRow, LEAGUE_IDS } from "@/lib/api-football";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

/**
 * GET /api/standings?league=epl
 * 
 * Returns real-time standings from API-FOOTBALL for a given league.
 */
export async function GET(req: Request) {
  // Anti-abus : protège le quota API-Football (40 requêtes/min/IP).
  const ip = clientIp(req);
  if (isRateLimited(ip, 'standings', 40, 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de requêtes, réessayez dans un instant.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("league");

  if (!leagueId) {
    // Return standings for all major leagues
    const majorLeagues = ["epl", "laliga", "seriea", "bundesliga", "ligue1"];
    const allStandings: Record<string, any> = {};

    const results = await Promise.all(
      majorLeagues.map(async (lid) => {
        const standings = await getStandings(lid);
        return { lid, standings };
      })
    );

    for (const { lid, standings } of results) {
      if (standings) {
        // standings can be an array of groups (e.g., for UCL)
        // For leagues, it's typically standings[0] = array of rows
        if (Array.isArray(standings[0])) {
          allStandings[lid] = standings[0].map(normalizeStandingRow);
        } else {
          allStandings[lid] = standings.map(normalizeStandingRow);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      standings: allStandings,
    });
  }

  // Single league
  if (!LEAGUE_IDS[leagueId]) {
    return NextResponse.json(
      { success: false, error: `Ligue inconnue: ${leagueId}` },
      { status: 400 }
    );
  }

  const standings = await getStandings(leagueId);
  if (!standings) {
    return NextResponse.json(
      { success: false, error: "Impossible de récupérer les classements" },
      { status: 502 }
    );
  }

  // Normalize
  let normalized: any[];
  if (Array.isArray(standings[0])) {
    // Multiple groups (e.g., UCL group stage)
    normalized = standings.map((group: any[]) => group.map(normalizeStandingRow));
  } else {
    normalized = standings.map(normalizeStandingRow);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    league: leagueId,
    standings: normalized,
  });
}
