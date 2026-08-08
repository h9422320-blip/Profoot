import { NextResponse } from 'next/server';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { getSeason } from '@/lib/api-football';

const API_KEY = process.env.API_FOOTBALL_KEY || "";

/**
 * Les saisons étaient écrites en dur à 2025 : cette route renvoyait donc les
 * classements de la SAISON PASSÉE (la phase de ligue 2025-26 de la Ligue des
 * Champions, avec Arsenal à 24 points), affichés comme s'ils étaient actuels.
 * La saison est désormais calculée.
 */
const LEAGUE_MAP: Record<string, number> = {
  ucl: 2, uel: 3, uecl: 848,
  epl: 39, ligue1: 61, laliga: 140, seriea: 135, bundesliga: 78,
  eredivisie: 88, ligaportugal: 94, proleague: 144, premiership: 179, superlig: 203,
  euro: 4, can: 6, copa: 9, caf: 12, nations_league: 5,
};

async function fetchApiFootball(endpoint: string) {
  const url = `https://v3.football.api-sports.io${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": API_KEY },
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    return await res.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  // Anti-abus : protège le quota API-Football (40 requêtes/min/IP).
  const ip = clientIp(request);
  if (isRateLimited(ip, 'live', 40, 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de requêtes, réessayez dans un instant.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !LEAGUE_MAP[id]) {
    return NextResponse.json({ error: 'Invalid or missing competition ID' }, { status: 400 });
  }

  const apiLeagueId = LEAGUE_MAP[id];
  const season = getSeason(id);

  try {
    let groups: any[] = [];
    let bracket = {
      r32: [] as any[],
      r16: [] as any[],
      qf: [] as any[],
      sf: [] as any[],
      third_place: null as any,
      final: null as any
    };

    // 1. Fetch Standings
    const standingsRes = await fetchApiFootball(`/standings?league=${apiLeagueId}&season=${season}`);
    const standingsData = standingsRes?.response?.[0]?.league?.standings || [];
    
    // Flatten standings
    groups = standingsData.map((group: any[]) => {
      return group.map((teamRank: any) => ({
        rank: teamRank.rank,
        team: { id: teamRank.team.id, name: teamRank.team.name, logo: teamRank.team.logo },
        points: teamRank.points, goalsDiff: teamRank.goalsDiff, group: teamRank.group,
        all: {
          played: teamRank.all.played, win: teamRank.all.win, draw: teamRank.all.draw, lose: teamRank.all.lose,
          goals: { for: teamRank.all.goals.for, against: teamRank.all.goals.against }
        }
      }));
    }).flat();

    // 2. Fetch Fixtures
    const fixturesRes = await fetchApiFootball(`/fixtures?league=${apiLeagueId}&season=${season}`);
    const fixtures = fixturesRes?.response || [];

    fixtures.forEach((f: any) => {
      const round = f.league.round.toLowerCase();
      const matchData = {
        t1: f.teams.home.name, t2: f.teams.away.name,
        t1Logo: f.teams.home.logo, t2Logo: f.teams.away.logo,
        s1: f.goals.home !== null ? f.goals.home.toString() : "-",
        s2: f.goals.away !== null ? f.goals.away.toString() : "-",
        status: f.fixture.status.short
      };

      if (round.includes('16') || round.includes('8th')) bracket.r16.push(matchData);
      else if (round.includes('quarter')) bracket.qf.push(matchData);
      else if (round.includes('semi')) bracket.sf.push(matchData);
      else if (round.includes('final') && !round.includes('3rd') && !round.includes('semi') && !round.includes('quarter')) {
        bracket.final = matchData;
      }
    });

    return NextResponse.json({ groups, bracket });
  } catch (error) {
    console.error("Live fetch error:", error);
    return NextResponse.json({ error: 'Failed to fetch live data' }, { status: 500 });
  }
}
