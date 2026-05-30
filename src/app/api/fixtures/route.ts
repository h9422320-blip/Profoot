import { NextResponse } from "next/server";
import {
  getTodayFixtures,
  getUpcomingFixtures,
  getLiveFixtures,
  getRecentResults,
  normalizeFixture,
} from "@/lib/api-football";

/**
 * GET /api/fixtures
 * 
 * Returns REAL matches from API-FOOTBALL.
 * 
 * Query params:
 *   type = "today" | "upcoming" | "live" | "recent" | "all"  (default: "all")
 *   days = number of days to look ahead/back (default: 7)
 * 
 * The data format matches the existing frontend interface so no UI changes are needed.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";
  const days = parseInt(searchParams.get("days") || "7", 10);

  try {
    let rawFixtures: any[] = [];

    switch (type) {
      case "today": {
        rawFixtures = await getTodayFixtures();
        break;
      }
      case "upcoming": {
        rawFixtures = await getUpcomingFixtures(days);
        rawFixtures = rawFixtures.filter(f => 
          ["NS", "TBD", "PST"].includes(f.fixture.status.short)
        );
        break;
      }
      case "live": {
        rawFixtures = await getLiveFixtures();
        break;
      }
      case "recent": {
        rawFixtures = await getRecentResults(days);
        break;
      }
      case "all":
      default: {
        const [live, today, upcoming, recent] = await Promise.all([
          getLiveFixtures().catch(() => []),
          getTodayFixtures().catch(() => []),
          getUpcomingFixtures(days).catch(() => []),
          getRecentResults(Math.min(days, 5)).catch(() => []),
        ]);

        const seen = new Set<number>();
        const merge = (arr: any[]) => {
          for (const f of arr) {
            if (f?.fixture?.id && !seen.has(f.fixture.id)) {
              seen.add(f.fixture.id);
              rawFixtures.push(f);
            }
          }
        };
        merge(live);
        merge(today);
        merge(upcoming);
        merge(recent);
        break;
      }
    }

    // Normalize all fixtures
    const fixtures = rawFixtures.map(normalizeFixture);

    // Group by status
    const grouped = {
      live: fixtures.filter(f => f.status === "live"),
      today: fixtures.filter(f => f.status === "today"),
      upcoming: fixtures.filter(f => f.status === "future"),
      finished: fixtures.filter(f => f.status === "finished"),
    };

    return NextResponse.json({
      success: true,
      count: fixtures.length,
      timestamp: new Date().toISOString(),
      fixtures,
      grouped,
    });
  } catch (error: any) {
    console.error("[API /fixtures] Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération des matchs",
        fixtures: [],
        grouped: { live: [], today: [], upcoming: [], finished: [] },
      },
      { status: 500 }
    );
  }
}
