import { NextResponse } from 'next/server';

const API_KEY = process.env.API_FOOTBALL_KEY || "";

const LEAGUE_MAP: Record<string, { id: number, season: number }> = {
  "ucl": { id: 2, season: 2025 }, // Adjust seasons based on current reality
  "wc": { id: 1, season: 2026 },
  "euro": { id: 4, season: 2024 },
  "can": { id: 34, season: 2025 },
  "copa": { id: 9, season: 2024 },
  "epl": { id: 39, season: 2025 },
  "ligue1": { id: 61, season: 2025 },
  "laliga": { id: 140, season: 2025 },
  "seriea": { id: 135, season: 2025 },
  "bundesliga": { id: 78, season: 2025 },
};

async function fetchApiFootball(endpoint: string) {
  const url = `https://v3.football.api-sports.io${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": API_KEY },
      next: { revalidate: 3600 } // Cache for 1 hour to save API calls
    });
    return await res.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !LEAGUE_MAP[id]) {
    return NextResponse.json({ error: 'Invalid or missing competition ID' }, { status: 400 });
  }

  const { id: apiLeagueId, season } = LEAGUE_MAP[id];

  try {
    // 1. Fetch Standings
    const standingsRes = await fetchApiFootball(`/standings?league=${apiLeagueId}&season=${season}`);
    const standingsData = standingsRes?.response?.[0]?.league?.standings || [];
    
    // Flatten standings (API-Sports returns an array of groups, each containing an array of teams)
    const groups = standingsData.map((group: any[]) => {
      return group.map((teamRank: any) => ({
        rank: teamRank.rank,
        team: {
          id: teamRank.team.id,
          name: teamRank.team.name,
          logo: teamRank.team.logo
        },
        points: teamRank.points,
        goalsDiff: teamRank.goalsDiff,
        group: teamRank.group,
        all: {
          played: teamRank.all.played,
          win: teamRank.all.win,
          draw: teamRank.all.draw,
          lose: teamRank.all.lose,
          goals: {
            for: teamRank.all.goals.for,
            against: teamRank.all.goals.against
          }
        }
      }));
    }).flat();

    // 2. Fetch Fixtures (For Knockout bracket)
    const fixturesRes = await fetchApiFootball(`/fixtures?league=${apiLeagueId}&season=${season}`);
    const fixtures = fixturesRes?.response || [];

    const bracket = {
      r16: [] as any[],
      qf: [] as any[],
      sf: [] as any[],
      final: null as any
    };

    fixtures.forEach((f: any) => {
      const round = f.league.round.toLowerCase();
      const matchData = {
        t1: f.teams.home.name,
        t2: f.teams.away.name,
        t1Logo: f.teams.home.logo,
        t2Logo: f.teams.away.logo,
        s1: f.goals.home !== null ? f.goals.home.toString() : "-",
        s2: f.goals.away !== null ? f.goals.away.toString() : "-",
        status: f.fixture.status.short // "FT", "NS", etc.
      };

      if (round.includes('16') || round.includes('8th')) bracket.r16.push(matchData);
      else if (round.includes('quarter')) bracket.qf.push(matchData);
      else if (round.includes('semi')) bracket.sf.push(matchData);
      else if (round.includes('final') && !round.includes('3rd') && !round.includes('semi') && !round.includes('quarter')) {
        bracket.final = matchData;
      }
    });

    const emptyMatch = { t1: "À déterminer", t2: "À déterminer", s1: "-", s2: "-" };
    
    // Pad arrays to ensure the UI bracket grid is always completely filled
    while (bracket.r16.length < 8) bracket.r16.push(emptyMatch);
    while (bracket.qf.length < 4) bracket.qf.push(emptyMatch);
    while (bracket.sf.length < 2) bracket.sf.push(emptyMatch);
    if (!bracket.final) bracket.final = emptyMatch;

    return NextResponse.json({
      groups: groups.length > 0 ? groups : null,
      bracket: (bracket.r16.some(m => m !== emptyMatch) || bracket.qf.some(m => m !== emptyMatch) || bracket.final !== emptyMatch) ? bracket : null
    });

  } catch (error) {
    console.error('[COMPETITIONS_LIVE] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch live data' }, { status: 500 });
  }
}
