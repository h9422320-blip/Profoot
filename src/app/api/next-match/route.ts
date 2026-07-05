import { NextResponse } from 'next/server';
import { clubs } from '@/lib/data';

async function fetchApiFootball(endpoint: string) {
  const url = `https://v3.football.api-sports.io${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "x-apisports-key": process.env.API_FOOTBALL_KEY || "",
    },
    next: { revalidate: 3600 }
  });
  return res.json();
}

const getApiIdFromLogo = (logo: string) => parseInt(logo.split('/').pop()?.split('.')[0] || '0', 10);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');

  if (!teamId) {
    return NextResponse.json({ error: 'Missing teamId' }, { status: 400 });
  }

  const team = clubs[teamId];
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const apiId = getApiIdFromLogo(team.logo);
  if (!apiId) {
    return NextResponse.json({ error: 'No API ID found' }, { status: 404 });
  }

  try {
    const data = await fetchApiFootball(`/fixtures?team=${apiId}&next=1`);
    const fixtures = data?.response || [];
    
    if (fixtures.length > 0) {
      const match = fixtures[0];
      // Find the opponent's API ID
      const isHome = match.teams.home.id === apiId;
      const opponentApiId = isHome ? match.teams.away.id : match.teams.home.id;

      // Find local internal ID for opponent
      const opponentKey = Object.keys(clubs).find(key => getApiIdFromLogo(clubs[key].logo) === opponentApiId);
      
      if (opponentKey) {
        return NextResponse.json({ nextTeamId: opponentKey });
      }
    }
    
    return NextResponse.json({ nextTeamId: null });
  } catch (error) {
    console.error('[NEXT_MATCH] Error fetching:', error);
    return NextResponse.json({ error: 'Failed to fetch next match' }, { status: 500 });
  }
}
