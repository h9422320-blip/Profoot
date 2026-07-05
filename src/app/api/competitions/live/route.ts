import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.API_FOOTBALL_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

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
      next: { revalidate: 3600 }
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
    const standingsRes = await fetchApiFootball(`/standings?league=${apiLeagueId}&season=${season}`);
    const standingsData = standingsRes?.response?.[0]?.league?.standings || [];
    
    const groups = standingsData.map((group: any[]) => {
      return group.map((teamRank: any) => ({
        rank: teamRank.rank,
        team: { id: teamRank.team.id, name: teamRank.team.name, logo: teamRank.team.logo },
        points: teamRank.points,
        goalsDiff: teamRank.goalsDiff,
        group: teamRank.group,
        all: {
          played: teamRank.all.played, win: teamRank.all.win, draw: teamRank.all.draw, lose: teamRank.all.lose,
          goals: { for: teamRank.all.goals.for, against: teamRank.all.goals.against }
        }
      }));
    }).flat();

    const fixturesRes = await fetchApiFootball(`/fixtures?league=${apiLeagueId}&season=${season}`);
    const fixtures = fixturesRes?.response || [];

    const bracket = { r16: [] as any[], qf: [] as any[], sf: [] as any[], final: null as any };

    fixtures.forEach((f: any) => {
      if (!f.league || !f.league.round) return;
      const round = f.league.round.toLowerCase();
      const matchData = {
        t1: f.teams.home.name, t2: f.teams.away.name, t1Logo: f.teams.home.logo, t2Logo: f.teams.away.logo,
        s1: f.goals.home !== null ? f.goals.home.toString() : "-", s2: f.goals.away !== null ? f.goals.away.toString() : "-",
        status: f.fixture.status.short
      };

      if (round.includes('16') || round.includes('8th')) bracket.r16.push(matchData);
      else if (round.includes('quarter')) bracket.qf.push(matchData);
      else if (round.includes('semi')) bracket.sf.push(matchData);
      else if (round.includes('final') && !round.includes('3rd') && !round.includes('semi') && !round.includes('quarter')) {
        bracket.final = matchData;
      }
    });

    // --- AI INTELLIGENCE FALLBACK ---
    // If API-Sports doesn't have the knockout matches (e.g. World Cup 2026), use the AI to generate the realistic bracket
    if (bracket.r16.length === 0 && bracket.qf.length === 0 && !bracket.final && GEMINI_KEY && ["wc", "can", "euro", "ucl", "copa"].includes(id)) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `Agis comme un expert IA du football mondial pour ProFoot. 
Le tournoi "${id}" (wc=Coupe du Monde, euro=Euro, can=CAN) de la saison ${season} est arrivé à la phase éliminatoire.
Génère un arbre de tournoi hautement réaliste (probabilités basées sur l'état de forme, historique, IA) ou les VRAIS résultats si le tournoi a déjà eu lieu.
Retourne UNIQUEMENT un objet JSON valide avec cette structure stricte (pas de markdown, pas de texte avant/après):
{
  "r16": [{"t1": "Equipe 1", "t2": "Equipe 2", "s1": "score ou -", "s2": "score ou -"}],
  "qf": [{"t1": "Equipe 1", "t2": "Equipe 2", "s1": "-", "s2": "-"}],
  "sf": [{"t1": "Equipe 1", "t2": "Equipe 2", "s1": "-", "s2": "-"}],
  "final": {"t1": "Equipe 1", "t2": "Equipe 2", "s1": "-", "s2": "-"}
}
Obligations: r16 doit avoir 8 éléments, qf: 4, sf: 2, final: 1 objet. Utilise les noms de pays en français (ex: "Argentine", "France"). Si les matchs ne sont pas encore joués, prédis des scores réalistes (ex: "2", "1") et des vainqueurs plausibles pour faire avancer les bonnes équipes jusqu'en finale.`;
        
        const aiResult = await model.generateContent(prompt);
        let textResult = aiResult.response.text().trim();
        if (textResult.startsWith('\`\`\`json')) textResult = textResult.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        else if (textResult.startsWith('\`\`\`')) textResult = textResult.replace(/\`\`\`/g, '').trim();
        
        const aiBracket = JSON.parse(textResult);
        bracket.r16 = aiBracket.r16 || [];
        bracket.qf = aiBracket.qf || [];
        bracket.sf = aiBracket.sf || [];
        bracket.final = aiBracket.final || null;
      } catch (e) {
        console.error("[AI Bracket Fallback Error]:", e);
      }
    }

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
