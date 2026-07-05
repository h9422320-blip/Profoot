import { NextResponse } from 'next/server';

const API_KEY = process.env.API_FOOTBALL_KEY || "";

const LEAGUE_MAP: Record<string, { id: number, season: number }> = {
  "ucl": { id: 2, season: 2025 },
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
      next: { revalidate: 3600 } // Cache for 1 hour
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
    let groups: any[] = [];
    let bracket = {
      r32: [] as any[],
      r16: [] as any[],
      qf: [] as any[],
      sf: [] as any[],
      third_place: null as any,
      final: null as any
    };

    if (id === 'wc') {
      const wcGroups = [
        { name: "Groupe A", teams: ["Mexique", "Afrique du Sud", "Corée du Sud", "République Tchèque"] },
        { name: "Groupe B", teams: ["Suisse", "Canada", "Bosnie-Herzégovine", "Qatar"] },
        { name: "Groupe C", teams: ["Brésil", "Maroc", "Ecosse", "Haïti"] },
        { name: "Groupe D", teams: ["USA", "Australie", "Paraguay", "Turquie"] },
        { name: "Groupe E", teams: ["Allemagne", "Côte d'Ivoire", "Equateur", "Curaçao"] },
        { name: "Groupe F", teams: ["Pays-Bas", "Japon", "Suède", "Tunisie"] },
        { name: "Groupe G", teams: ["Belgique", "Egypte", "Iran", "Nouvelle-Zélande"] },
        { name: "Groupe H", teams: ["Espagne", "Iles du Cap-Vert", "Uruguay", "Arabie Saoudite"] },
        { name: "Groupe I", teams: ["France", "Norvège", "Sénégal", "Irak"] },
        { name: "Groupe J", teams: ["Argentine", "Autriche", "Algérie", "Jordanie"] },
        { name: "Groupe K", teams: ["Colombie", "Portugal", "Rép. Dém. du Congo", "Ouzbékistan"] },
        { name: "Groupe L", teams: ["Angleterre", "Croatie", "Ghana", "Panama"] }
      ];

      wcGroups.forEach(g => {
        g.teams.forEach((teamName, i) => {
          let pts = 0;
          if (teamName === "Mexique" || teamName === "Argentine" || teamName === "France") pts = 9;
          else if (teamName === "Brésil" || teamName === "Suisse" || teamName === "Pays-Bas" || teamName === "Espagne" || teamName === "Colombie" || teamName === "Angleterre") pts = 7;
          else if (teamName === "Allemagne") pts = 6;
          else if (teamName === "Belgique" || teamName === "Portugal") pts = 5;
          else if (teamName === "Afrique du Sud" || teamName === "Australie" || teamName === "Paraguay" || teamName === "Canada") pts = 4;
          else pts = Math.max(0, 4 - i);

          groups.push({
            rank: i + 1,
            team: { id: teamName.toLowerCase(), name: teamName, logo: `https://flagcdn.com/w40/${getTeamFlag(teamName)}.png` },
            points: pts,
            goalsDiff: 0,
            group: g.name,
            all: { played: 3, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } }
          });
        });
      });
      return NextResponse.json({ groups, bracket });
    }

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

function getTeamFlag(name: string) {
  const map: any = {
    "Mexique": "mx", "Afrique du Sud": "za", "Corée du Sud": "kr", "République Tchèque": "cz",
    "Suisse": "ch", "Canada": "ca", "Bosnie-Herzégovine": "ba", "Qatar": "qa",
    "Brésil": "br", "Maroc": "ma", "Ecosse": "gb-sct", "Haïti": "ht",
    "USA": "us", "Australie": "au", "Paraguay": "py", "Turquie": "tr",
    "Allemagne": "de", "Côte d'Ivoire": "ci", "Equateur": "ec", "Curaçao": "cw",
    "Pays-Bas": "nl", "Japon": "jp", "Suède": "se", "Tunisie": "tn",
    "Belgique": "be", "Egypte": "eg", "Iran": "ir", "Nouvelle-Zélande": "nz",
    "Espagne": "es", "Iles du Cap-Vert": "cv", "Uruguay": "uy", "Arabie Saoudite": "sa",
    "France": "fr", "Norvège": "no", "Sénégal": "sn", "Irak": "iq",
    "Argentine": "ar", "Autriche": "at", "Algérie": "dz", "Jordanie": "jo",
    "Colombie": "co", "Portugal": "pt", "Rép. Dém. du Congo": "cd", "Ouzbékistan": "uz",
    "Angleterre": "gb-eng", "Croatie": "hr", "Ghana": "gh", "Panama": "pa"
  };
  return map[name] || "un";
}
