process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// ProFoot ANALYSE ENGINE v5.0 — STRICT REAL DATA ONLY
// ============================================================================

const analysisCache = new Map<string, { data: any; timestamp: number }>();
const apiFootballCache = new Map<string, { data: any; timestamp: number }>();

const CACHE_TTL = {
  ANALYSIS: 5 * 60 * 1000,
  API_DATA: 60 * 60 * 1000,
  TEAM_STATS: 6 * 60 * 60 * 1000,
};

async function fetchApiFootball(endpoint: string, ttl: number = CACHE_TTL.API_DATA) {
  const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_FOOTBALL_KEY || API_FOOTBALL_KEY === "MA_CLE_API" || API_FOOTBALL_KEY === "") {
    console.error("[BACKEND_ANALYZE] API Key missing!");
    return null;
  }
  
  const cacheKey = endpoint;
  const cached = apiFootballCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) return cached.data;

  const url = `https://v3.football.api-sports.io${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { "x-apisports-key": API_FOOTBALL_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[BACKEND_ANALYZE] API-Football error on ${endpoint}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    apiFootballCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (e: any) {
    console.error(`[BACKEND_ANALYZE] Exception on ${endpoint}:`, e.message);
    return null;
  }
}

async function getTeamApiId(team: any) {
  if (team.logo && team.logo.includes("api-sports.io/football/teams/")) {
    const match = team.logo.match(/teams\/(\d+)\.png/);
    if (match) return match[1];
  }
  
  let searchName = team.name;
  const translations: Record<string, string> = {
    "espagne": "Spain", "allemagne": "Germany", "angleterre": "England", 
    "brésil": "Brazil", "bresil": "Brazil", "argentine": "Argentina", 
    "maroc": "Morocco", "sénégal": "Senegal", "senegal": "Senegal", 
    "algérie": "Algeria", "côte d'ivoire": "Ivory Coast", "égypte": "Egypt", 
    "cameroun": "Cameroon", "rd congo": "Congo DR", "pays de galles": "Wales", 
    "croatie": "Croatia", "italie": "Italy", "danemark": "Denmark",
    "pays-bas": "Netherlands", "belgique": "Belgium", "portugal": "Portugal",
    "etats-unis": "USA", "suisse": "Switzerland", "uruguay": "Uruguay",
    "colombie": "Colombia", "mexique": "Mexico"
  };

  if (translations[team.name.toLowerCase()]) {
    searchName = translations[team.name.toLowerCase()];
  } else if (team.id) {
    const cleanId = team.id.replace("_can", "").replace("_spl", "").replace("_sl", "").replace(/_/g, " ");
    if (translations[cleanId.toLowerCase()]) {
      searchName = translations[cleanId.toLowerCase()];
    }
  }

  const search = await fetchApiFootball(`/teams?name=${encodeURIComponent(searchName)}`);
  if (search?.response?.length > 0) {
    const isNat = team.country === team.name || team.country === "Monde" || team.country === "Afrique" || team.region === "international" || team.region === "africa";
    if (isNat) {
        const nat = search.response.find((t: any) => t.team.national === true);
        if (nat) return nat.team.id;
    }
    return search.response[0].team.id;
  }
  return null;
}

function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

export async function POST(req: Request) {
  let reqPayload: any = {};
  try {
    reqPayload = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { team1, team2 } = reqPayload;
  if (!team1 || !team2) return NextResponse.json({ error: "Équipes manquantes" }, { status: 400 });

  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${team1.id}-${team2.id}-${today}`;
  const cachedAnalysis = analysisCache.get(cacheKey);
  if (cachedAnalysis && Date.now() - cachedAnalysis.timestamp < CACHE_TTL.ANALYSIS) {
    console.log(`[BACKEND_ANALYZE] Returning CACHED analysis for ${team1.name} vs ${team2.name}`);
    return NextResponse.json(cachedAnalysis.data);
  }

  console.log(`[BACKEND_ANALYZE] Starting analysis for ${team1.name} vs ${team2.name}`);

  const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_FOOTBALL_KEY || API_FOOTBALL_KEY === "MA_CLE_API" || API_FOOTBALL_KEY === "") {
    return NextResponse.json({ error: "API Football non configurée." }, { status: 503 });
  }

  const [id1, id2] = await Promise.all([getTeamApiId(team1), getTeamApiId(team2)]);
  if (!id1 || !id2) {
    console.error(`[BACKEND_ANALYZE] IDs not found: ${team1.name}=${id1}, ${team2.name}=${id2}`);
    return NextResponse.json({ error: "Équipes introuvables via API-Football." }, { status: 404 });
  }

  const season = getCurrentSeason();

  console.log(`[BACKEND_ANALYZE] Fetching H2H and Fixtures...`);
  async function getFixturesWithFallback(teamId: string, initialSeason: number) {
    let s = initialSeason;
    let data = await fetchApiFootball(`/fixtures?team=${teamId}&season=${s}`);
    if (!data?.response || data.response.length === 0) {
      s -= 1;
      data = await fetchApiFootball(`/fixtures?team=${teamId}&season=${s}`);
    }
    return { data, season: s };
  }

  const [t1Data, t2Data, h2hRes] = await Promise.all([
    getFixturesWithFallback(id1, season),
    getFixturesWithFallback(id2, season),
    fetchApiFootball(`/fixtures/headtohead?h2h=${id1}-${id2}`)
  ]);

  const h2hList = h2hRes?.response || [];
  h2hList.sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
  
  const futureMatches = h2hList.filter((m: any) => ["NS", "TBD", "PST"].includes(m.fixture.status.short));
  const pastMatches = h2hList.filter((m: any) => ["FT", "AET", "PEN"].includes(m.fixture.status.short));

  const targetFutureMatch = futureMatches.length > 0 ? futureMatches[futureMatches.length - 1] : null;
  const targetPastMatch = pastMatches.length > 0 ? pastMatches[0] : null;

  // ============================================================================
  // CASE 1: MATCH IS IN THE PAST
  // ============================================================================
  if (targetPastMatch && !targetFutureMatch) {
    console.log(`[BACKEND_ANALYZE] Match identified as PAST. Skipping prediction.`);
    const fixtureId = targetPastMatch.fixture.id;
    const [eventsRes, statsRes] = await Promise.all([
      fetchApiFootball(`/fixtures/events?fixture=${fixtureId}`),
      fetchApiFootball(`/fixtures/statistics?fixture=${fixtureId}`)
    ]);

    const isTeam1Home = targetPastMatch.teams.home.id.toString() === id1.toString();
    const hScore = targetPastMatch.goals.home;
    const aScore = targetPastMatch.goals.away;
    const events = eventsRes?.response || [];
    const stats = statsRes?.response || [];

    const homeStats = stats.find((s: any) => s.team.id === targetPastMatch.teams.home.id)?.statistics || [];
    const awayStats = stats.find((s: any) => s.team.id === targetPastMatch.teams.away.id)?.statistics || [];

    const getStat = (arr: any[], type: string) => {
      const s = arr.find((x: any) => x.type === type);
      if (!s || s.value === null) return 0;
      if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
      return parseInt(s.value);
    };

    const formatEvents = events.map((ev: any) => {
      let type = "unknown";
      if (ev.type === "Goal") type = "goal";
      if (ev.type === "Card" && ev.detail.includes("Yellow")) type = "card-yellow";
      if (ev.type === "Card" && ev.detail.includes("Red")) type = "card-red";
      const isHomeEvent = ev.team.id === targetPastMatch.teams.home.id;
      const side = (isHomeEvent && isTeam1Home) || (!isHomeEvent && !isTeam1Home) ? "team1" : "team2";
      return { type, name: ev.player.name, minute: ev.time.elapsed, side };
    }).filter((ev: any) => ev.type !== "unknown");

    const scorers = formatEvents.filter((ev: any) => ev.type === "goal").map((ev: any) => ({
      name: ev.name, minute: ev.minute, side: ev.side
    }));

    const team1StatsData = isTeam1Home ? homeStats : awayStats;
    const team2StatsData = !isTeam1Home ? homeStats : awayStats;

    const realMatchResult = {
      isFinished: true,
      score: isTeam1Home ? `${hScore} - ${aScore}` : `${aScore} - ${hScore}`,
      venue: targetPastMatch.fixture.venue.name || "Stade",
      date: new Date(targetPastMatch.fixture.date).toLocaleDateString("fr-FR"),
      competition: targetPastMatch.league.name,
      scorers,
      events: formatEvents,
      stats: {
        possession: { team1: getStat(team1StatsData, "Ball Possession"), team2: getStat(team2StatsData, "Ball Possession") },
        shots: { team1: getStat(team1StatsData, "Total Shots"), team2: getStat(team1StatsData, "Total Shots") },
        shotsOnTarget: { team1: getStat(team1StatsData, "Shots on Goal"), team2: getStat(team2StatsData, "Shots on Goal") },
        corners: { team1: getStat(team1StatsData, "Corner Kicks"), team2: getStat(team2StatsData, "Corner Kicks") },
        fouls: { team1: getStat(team1StatsData, "Fouls"), team2: getStat(team2StatsData, "Fouls") },
        passes: { team1: getStat(team1StatsData, "Total passes"), team2: getStat(team2StatsData, "Total passes") }
      },
      summary: `Score final certifié via API-Football. ${targetPastMatch.teams.home.name} ${hScore} - ${aScore} ${targetPastMatch.teams.away.name}.`
    };

    analysisCache.set(cacheKey, { data: realMatchResult, timestamp: Date.now() });
    return NextResponse.json(realMatchResult);
  }

  // ============================================================================
  // CASE 2: FUTURE MATCH — MATHEMATICAL PREDICTION + GEMINI ANALYSIS
  // ============================================================================
  console.log(`[BACKEND_ANALYZE] Match identified as FUTURE. Fetching deep stats...`);

  const t1Fixtures = t1Data.data;
  const t2Fixtures = t2Data.data;
  const t1Season = t1Data.season;
  const t2Season = t2Data.season;

  let t1League = 39; let t2League = 39;
  if (t1Fixtures?.response?.length > 0) t1League = t1Fixtures.response[0].league.id;
  if (t2Fixtures?.response?.length > 0) t2League = t2Fixtures.response[0].league.id;

  const [t1Stats, t2Stats, t1Injuries, t2Injuries, t1Squad, t2Squad, t1TopScorers, t2TopScorers] = await Promise.all([
    fetchApiFootball(`/teams/statistics?team=${id1}&season=${t1Season}&league=${t1League}`, CACHE_TTL.TEAM_STATS),
    fetchApiFootball(`/teams/statistics?team=${id2}&season=${t2Season}&league=${t2League}`, CACHE_TTL.TEAM_STATS),
    fetchApiFootball(`/injuries?team=${id1}&season=${t1Season}`),
    fetchApiFootball(`/injuries?team=${id2}&season=${t2Season}`),
    fetchApiFootball(`/players/squads?team=${id1}`, CACHE_TTL.TEAM_STATS),
    fetchApiFootball(`/players/squads?team=${id2}`, CACHE_TTL.TEAM_STATS),
    fetchApiFootball(`/players/topscorers?season=${t1Season}&league=${t1League}`),
    fetchApiFootball(`/players/topscorers?season=${t2Season}&league=${t2League}`)
  ]);

  console.log(`[BACKEND_ANALYZE] Squads loaded: team1=${t1Squad?.response?.length || 0}, team2=${t2Squad?.response?.length || 0}`);

  if (!t1Stats || !t2Stats) {
    console.error(`[BACKEND_ANALYZE] Missing statistics for one or both teams.`);
    return NextResponse.json({ error: "Impossible de récupérer les statistiques réelles." }, { status: 500 });
  }

  // Extract squad player names by position
  function extractSquad(squadRes: any) {
    const players = squadRes?.response?.[0]?.players || [];
    const byPosition: Record<string, string[]> = { Goalkeeper: [], Defender: [], Midfielder: [], Attacker: [] };
    players.forEach((p: any) => {
      const pos = p.position || 'Unknown';
      if (byPosition[pos]) byPosition[pos].push(p.name);
    });
    return { all: players.map((p: any) => p.name), byPosition, count: players.length };
  }

  // Extract top scorers for each team from league top scorers
  function extractTeamTopScorers(topScorersRes: any, teamId: string) {
    const all = topScorersRes?.response || [];
    return all
      .filter((p: any) => p.statistics?.[0]?.team?.id?.toString() === teamId.toString())
      .slice(0, 3)
      .map((p: any) => ({ name: p.player.name, goals: p.statistics[0].goals.total || 0 }));
  }

  const squad1 = extractSquad(t1Squad);
  const squad2 = extractSquad(t2Squad);
  const scorers1 = extractTeamTopScorers(t1TopScorers, id1);
  const scorers2 = extractTeamTopScorers(t2TopScorers, id2);

  console.log(`[BACKEND_ANALYZE] Data fetched successfully. Computing mathematical prediction...`);
  let predictionObj = computeMathematicalPrediction(team1, team2, id1, id2, t1Fixtures, t2Fixtures, t1Stats, t2Stats, t1Injuries, t2Injuries, pastMatches, squad1, squad2, scorers1, scorers2);

  // GEMINI PROMPT GENERATION
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (GEMINI_KEY && GEMINI_KEY !== "fallback_key_for_safety" && GEMINI_KEY !== "") {
    try {
      console.log(`[BACKEND_ANALYZE] Calling Gemini for expert analysis...`);
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout for AI

      // Build squad info strings for the prompt
      const squad1Str = squad1.count > 0 ? `Effectif (${squad1.count} joueurs) - Gardiens: ${squad1.byPosition.Goalkeeper.join(', ') || 'N/A'}, Defenseurs: ${squad1.byPosition.Defender.join(', ') || 'N/A'}, Milieux: ${squad1.byPosition.Midfielder.join(', ') || 'N/A'}, Attaquants: ${squad1.byPosition.Attacker.join(', ') || 'N/A'}` : 'Effectif indisponible';
      const squad2Str = squad2.count > 0 ? `Effectif (${squad2.count} joueurs) - Gardiens: ${squad2.byPosition.Goalkeeper.join(', ') || 'N/A'}, Defenseurs: ${squad2.byPosition.Defender.join(', ') || 'N/A'}, Milieux: ${squad2.byPosition.Midfielder.join(', ') || 'N/A'}, Attaquants: ${squad2.byPosition.Attacker.join(', ') || 'N/A'}` : 'Effectif indisponible';
      const scorers1Str = scorers1.length > 0 ? scorers1.map((s: any) => `${s.name} (${s.goals} buts)`).join(', ') : 'Donnee indisponible';
      const scorers2Str = scorers2.length > 0 ? scorers2.map((s: any) => `${s.name} (${s.goals} buts)`).join(', ') : 'Donnee indisponible';

      const prompt = `Tu es un analyste football professionnel de haut niveau, specialiste de la Coupe du Monde, des championnats europeens et africains.
IMPORTANT : Tu dois utiliser UNIQUEMENT les donnees fournies ci-dessous.
INTERDICTION ABSOLUE :
- inventer des joueurs ou des coachs
- inventer des tactiques non basees sur les stats
- inventer des blesses
- inventer des resultats ou scores historiques

Si une donnee n'existe pas dans les informations fournies, dis simplement : "Donnee indisponible actuellement."

Voici les donnees REELLES de API-FOOTBALL pour ${team1.name} vs ${team2.name} :

[DONNEES ${team1.name}]
- Victoires recentes: ${predictionObj.globalForm.team1.winStreak}
- Buts marques saison: ${predictionObj.globalForm.team1.goalsScored}
- Buts encaisses saison: ${predictionObj.globalForm.team1.goalsConceded}
- Clean sheets: ${predictionObj.globalForm.team1.cleanSheets}
- Possession moyenne: ${predictionObj.advancedMetrics.possession.team1}%
- Formation: ${predictionObj.keyStrengths.team1.join(', ')}
- xG estime: ${predictionObj.advancedMetrics.xG.team1}
- Derniers resultats: ${JSON.stringify(predictionObj.globalForm.team1.recentMatches)}
- Blessures actives: ${JSON.stringify(t1Injuries?.response?.slice(0,8).map((i:any)=>({joueur: i.player.name, raison: i.player.reason || 'blessure'})) || "Aucune")}
- Meilleurs buteurs: ${scorers1Str}
- ${squad1Str}

[DONNEES ${team2.name}]
- Victoires recentes: ${predictionObj.globalForm.team2.winStreak}
- Buts marques saison: ${predictionObj.globalForm.team2.goalsScored}
- Buts encaisses saison: ${predictionObj.globalForm.team2.goalsConceded}
- Clean sheets: ${predictionObj.globalForm.team2.cleanSheets}
- Possession moyenne: ${predictionObj.advancedMetrics.possession.team2}%
- Formation: ${predictionObj.keyStrengths.team2.join(', ')}
- xG estime: ${predictionObj.advancedMetrics.xG.team2}
- Derniers resultats: ${JSON.stringify(predictionObj.globalForm.team2.recentMatches)}
- Blessures actives: ${JSON.stringify(t2Injuries?.response?.slice(0,8).map((i:any)=>({joueur: i.player.name, raison: i.player.reason || 'blessure'})) || "Aucune")}
- Meilleurs buteurs: ${scorers2Str}
- ${squad2Str}

[HISTORIQUE H2H RECENT]
${JSON.stringify(pastMatches.slice(0, 5).map((m:any)=>`${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name} (${new Date(m.fixture.date).toLocaleDateString('fr-FR')})`))}

DONNEES MATHEMATIQUES DU MOTEUR (A NE JAMAIS MODIFIER) : 
Score estime: ${predictionObj.predictedScore.team1Goals} - ${predictionObj.predictedScore.team2Goals}. 
Victoire ${team1.name}: ${predictionObj.winProb}%. Victoire ${team2.name}: ${predictionObj.loseProb}%. Nul: ${predictionObj.drawProb}%.

OBJECTIF :
Redige une explication footballistique professionnelle, ultra-detaillee et humaine expliquant *pourquoi* ce score est genere.
Le ton doit etre celui d'un consultant TV expert (style Canal+, beIN Sports).
Chaque section doit faire AU MINIMUM 4-5 phrases detaillees.
Mentionne les VRAIS joueurs de l'effectif fourni quand c'est pertinent.

Redige UNIQUEMENT un objet JSON valide avec cette structure stricte :
{
  "quickSummary": "Un resume captivant en 2-3 phrases de l'enjeu du match, mentionnant les equipes et le contexte.",
  "reasoning": "Explication en 2-3 phrases justifiant le score estime avec des arguments statistiques.",
  "sections": [
    { "title": "Dynamique & Forme Recente", "icon": "Activity", "content": "Analyse tres detaillee des 5 derniers matchs de chaque equipe. Mentionne les adversaires, les scores, la dynamique. Minimum 5 phrases." },
    { "title": "Bataille Offensive & Defensive", "icon": "Target", "content": "Analyse detaillee des buts marques/encaisses, xG, clean sheets, efficacite offensive et defensive. Mentionne les meilleurs buteurs fournis. Minimum 5 phrases." },
    { "title": "Effectifs & Joueurs Cles", "icon": "Award", "content": "Analyse de la qualite des effectifs fournis. Mentionne les joueurs cles par poste (gardien, defense, milieu, attaque). Evalue la profondeur de banc. Minimum 5 phrases." },
    { "title": "Absents & Blesses", "icon": "Shield", "content": "Impact precis des joueurs absents listes. Comment ces absences affectent la tactique et le resultat. Minimum 4 phrases." },
    { "title": "Historique des Confrontations", "icon": "History", "content": "Tendances historiques entre ces deux equipes basees sur les H2H fournis. Domination psychologique. Minimum 4 phrases." },
    { "title": "Contexte & Enjeux du Match", "icon": "Trophy", "content": "Importance du match, competition, pression, fatigue, avantage domicile/exterieur. Minimum 4 phrases." },
    { "title": "Justification du Score Final", "icon": "Brain", "content": "Explication finale ultra-detaillee justifiant le score de ${predictionObj.predictedScore.team1Goals}-${predictionObj.predictedScore.team2Goals} en croisant TOUTES les donnees ci-dessus. Minimum 5 phrases." }
  ]
}
NE RETOURNE RIEN D'AUTRE QUE CE JSON.`;

      const result = await model.generateContent(prompt, { signal: controller.signal } as any);
      clearTimeout(timeoutId);
      
      let responseText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedText = JSON.parse(responseText);
      
      if (parsedText.quickSummary) predictionObj.quickSummary = parsedText.quickSummary;
      if (parsedText.reasoning) predictionObj.predictedScore.reasoning = parsedText.reasoning;
      if (parsedText.sections && Array.isArray(parsedText.sections)) predictionObj.sections = parsedText.sections;

      console.log(`[BACKEND_ANALYZE] Gemini analysis completed successfully.`);

    } catch (e: any) {
      console.warn("[BACKEND_ANALYZE] Gemini formatting failed or timed out. Fallback to math reasoning.", e.message);
    }
  } else {
      console.warn("[BACKEND_ANALYZE] Gemini Key missing, skipping AI reasoning.");
  }

  analysisCache.set(cacheKey, { data: predictionObj, timestamp: Date.now() });
  return NextResponse.json(predictionObj);
}

// ---------------------------------------------------------------------------
// THE MATHEMATICAL ENGINE
// ---------------------------------------------------------------------------
function computeMathematicalPrediction(
  team1: any, team2: any, id1: string, id2: string,
  t1Fixtures: any, t2Fixtures: any, t1Stats: any, t2Stats: any,
  t1Injuries: any, t2Injuries: any, pastMatches: any[],
  squad1?: any, squad2?: any, scorers1?: any[], scorers2?: any[]
) {
  const computeRecent = (fixtures: any, teamId: string) => {
    const allMatches = (fixtures?.response || []).filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
    allMatches.sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
    const list = allMatches.slice(0, 5);
    let played = 0, wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
    list.forEach((f: any) => {
      if (f.goals?.home === null) return;
      played++;
      const isHome = f.teams?.home?.id?.toString() === teamId;
      const gh = f.goals.home; const ga = f.goals.away;
      const gf = isHome ? gh : ga; const ga_con = isHome ? ga : gh;
      goalsFor += gf; goalsAgainst += ga_con;
      if (ga_con === 0) cleanSheets++;
      if (gf > ga_con) wins++; else if (gf === ga_con) draws++; else losses++;
    });
    return { played: played || 1, wins, draws, losses, goalsFor, goalsAgainst, cleanSheets };
  };

  const f1 = computeRecent(t1Fixtures, id1);
  const f2 = computeRecent(t2Fixtures, id2);

  const parseSeason = (stats: any, recent: any) => {
    const r = stats?.response || {};
    return {
      played: r.fixtures?.played?.total ?? recent.played ?? 1,
      wins: r.fixtures?.wins?.total ?? recent.wins ?? 0,
      goalsFor: r.goals?.for?.total?.total ?? recent.goalsFor ?? 0,
      goalsAgainst: r.goals?.against?.total?.total ?? recent.goalsAgainst ?? 0,
      cleanSheets: r.clean_sheet?.total ?? recent.cleanSheets ?? 0,
      avgPossession: parseInt(r.ball_possession?.average || "50", 10),
      formation: r.lineups?.[0]?.formation || "4-3-3"
    };
  };

  const s1 = parseSeason(t1Stats, f1);
  const s2 = parseSeason(t2Stats, f2);

  const off1 = s1.goalsFor / (s1.played || 1);
  const def1 = s1.goalsAgainst / (s1.played || 1);
  const off2 = s2.goalsFor / (s2.played || 1);
  const def2 = s2.goalsAgainst / (s2.played || 1);

  // xG calculation with home advantage and form bonus
  let xG1 = (off1 + def2) / 2 + 0.25; // Home advantage
  let xG2 = (off2 + def1) / 2;

  // Boost xG based on recent form momentum
  const formBonus1 = (f1.wins / f1.played) * 0.3;
  const formBonus2 = (f2.wins / f2.played) * 0.3;
  xG1 += formBonus1;
  xG2 += formBonus2;
  
  if (isNaN(xG1)) xG1 = 1.2;
  if (isNaN(xG2)) xG2 = 1.0;
  xG1 = Math.max(0.5, xG1);
  xG2 = Math.max(0.4, xG2);

  const diff = xG1 - xG2;
  let winProb = 0, drawProb = 0, loseProb = 0;
  
  // More granular probability tiers
  if (diff > 1.0) { winProb = 68; drawProb = 18; loseProb = 14; }
  else if (diff > 0.6) { winProb = 55; drawProb = 22; loseProb = 23; }
  else if (diff > 0.2) { winProb = 45; drawProb = 27; loseProb = 28; }
  else if (diff > -0.2) { winProb = 33; drawProb = 34; loseProb = 33; }
  else if (diff > -0.6) { winProb = 28; drawProb = 27; loseProb = 45; }
  else if (diff > -1.0) { winProb = 23; drawProb = 22; loseProb = 55; }
  else { winProb = 14; drawProb = 18; loseProb = 68; }

  // Adjust by form (momentum)
  const formDiff = (f1.wins / f1.played) - (f2.wins / f2.played);
  if (formDiff > 0.4) { winProb += 7; loseProb -= 4; drawProb -= 3; }
  else if (formDiff > 0.2) { winProb += 4; loseProb -= 2; drawProb -= 2; }
  if (formDiff < -0.4) { loseProb += 7; winProb -= 4; drawProb -= 3; }
  else if (formDiff < -0.2) { loseProb += 4; winProb -= 2; drawProb -= 2; }
  
  // Normalize
  const sum = winProb + drawProb + loseProb;
  winProb = Math.round((winProb / sum) * 100);
  loseProb = Math.round((loseProb / sum) * 100);
  drawProb = 100 - winProb - loseProb;

  // Score generation with more variety
  // Use fractional xG to create more diverse scorelines
  let t1Goals: number, t2Goals: number;

  if (winProb > loseProb && winProb > drawProb) {
    // Team 1 favored
    if (xG1 >= 2.3) { t1Goals = 3; t2Goals = Math.max(0, Math.round(xG2 * 0.7)); }
    else if (xG1 >= 1.7) { t1Goals = 2; t2Goals = xG2 >= 1.2 ? 1 : 0; }
    else { t1Goals = 2; t2Goals = 1; }
    if (t1Goals <= t2Goals) t1Goals = t2Goals + 1;
  } else if (loseProb > winProb && loseProb > drawProb) {
    // Team 2 favored
    if (xG2 >= 2.3) { t2Goals = 3; t1Goals = Math.max(0, Math.round(xG1 * 0.7)); }
    else if (xG2 >= 1.7) { t2Goals = 2; t1Goals = xG1 >= 1.2 ? 1 : 0; }
    else { t2Goals = 2; t1Goals = 1; }
    if (t2Goals <= t1Goals) t2Goals = t1Goals + 1;
  } else {
    // Draw scenario
    const avgGoals = (xG1 + xG2) / 2;
    if (avgGoals >= 1.8) { t1Goals = 2; t2Goals = 2; }
    else if (avgGoals >= 1.0) { t1Goals = 1; t2Goals = 1; }
    else { t1Goals = 0; t2Goals = 0; }
  }

  const getRecentMatches = (fixtures: any[], teamId: string) => {
    const allMatches = (fixtures || []).filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
    allMatches.sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
    return allMatches.slice(0, 5).map((f: any) => {
      const isHome = f.teams?.home?.id?.toString() === teamId;
      const gh = f.goals?.home ?? 0; const ga = f.goals?.away ?? 0;
      let res: "W" | "D" | "L" = "D";
      if (gh !== ga) res = (isHome && gh > ga) || (!isHome && ga > gh) ? "W" : "L";
      return {
        opponent: isHome ? f.teams?.away?.name : f.teams?.home?.name,
        score: `${gh}-${ga}`,
        result: res,
        competition: f.league?.name || "Match",
        venue: isHome ? "H" : "A"
      };
    });
  };

  const recent1 = getRecentMatches(t1Fixtures?.response, id1);
  const recent2 = getRecentMatches(t2Fixtures?.response, id2);

  const attack1 = Math.min(99, Math.max(10, Math.round(30 + (off1 * 25))));
  const attack2 = Math.min(99, Math.max(10, Math.round(30 + (off2 * 25))));
  const defense1 = Math.min(99, Math.max(10, Math.round(95 - (def1 * 25))));
  const defense2 = Math.min(99, Math.max(10, Math.round(95 - (def2 * 25))));
  const form1 = Math.min(99, Math.max(10, Math.round(40 + (f1.wins/(f1.played || 1))*60)));
  const form2 = Math.min(99, Math.max(10, Math.round(40 + (f2.wins/(f2.played || 1))*60)));

  // Build human-readable recent form strings
  const formStr = (matches: any[]) => matches.map(m => `${m.result === 'W' ? 'Victoire' : m.result === 'D' ? 'Nul' : 'Defaite'} vs ${m.opponent} (${m.score})`).join(', ');
  const form1Str = formStr(recent1);
  const form2Str = formStr(recent2);

  // Build injuries text
  const inj1List = (t1Injuries?.response || []).slice(0, 5).map((i: any) => i.player?.name).filter(Boolean);
  const inj2List = (t2Injuries?.response || []).slice(0, 5).map((i: any) => i.player?.name).filter(Boolean);
  const inj1Text = inj1List.length > 0 ? inj1List.join(', ') : 'Aucun absent majeur signal\u00e9';
  const inj2Text = inj2List.length > 0 ? inj2List.join(', ') : 'Aucun absent majeur signal\u00e9';

  // Build H2H text
  const h2hRecent = (pastMatches || []).slice(0, 3);
  const h2hText = h2hRecent.length > 0
    ? h2hRecent.map((m: any) => `${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`).join(' | ')
    : 'Aucune confrontation directe recente trouvee';

  const favoriteTeam = winProb > loseProb ? team1.name : (loseProb > winProb ? team2.name : 'aucune des deux');

  const reasoningText = winProb > loseProb
    ? `${team1.name} presente un avantage statistique avec ${f1.wins} victoire(s) sur les 5 derniers matchs, un xG de ${xG1.toFixed(2)} et une possession moyenne de ${s1.avgPossession}%. Face a ${team2.name} qui encaisse en moyenne ${def2.toFixed(2)} but(s) par match, le score de ${t1Goals}-${t2Goals} est le scenario le plus probable.`
    : loseProb > winProb
    ? `${team2.name} arrive en meilleure forme avec ${f2.wins} victoire(s) recentes et un xG de ${xG2.toFixed(2)}, tandis que ${team1.name} concede en moyenne ${def1.toFixed(2)} but(s). Le score de ${t1Goals}-${t2Goals} reflete cette dynamique.`
    : `Les deux equipes affichent des niveaux tres proches (xG ${xG1.toFixed(2)} vs ${xG2.toFixed(2)}), ce qui rend un match nul ${t1Goals}-${t2Goals} hautement probable.`;

  // Build squad section text for fallback
  const squad1Text = squad1?.count > 0 ? `Effectif de ${squad1.count} joueurs. Attaquants : ${squad1.byPosition.Attacker?.join(', ') || 'N/A'}. Milieux : ${squad1.byPosition.Midfielder?.slice(0,5).join(', ') || 'N/A'}.` : 'Effectif indisponible actuellement.';
  const squad2Text = squad2?.count > 0 ? `Effectif de ${squad2.count} joueurs. Attaquants : ${squad2.byPosition.Attacker?.join(', ') || 'N/A'}. Milieux : ${squad2.byPosition.Midfielder?.slice(0,5).join(', ') || 'N/A'}.` : 'Effectif indisponible actuellement.';
  const scorers1Text = scorers1 && scorers1.length > 0 ? scorers1.map((s: any) => `${s.name} (${s.goals} buts)`).join(', ') : 'Donnee indisponible';
  const scorers2Text = scorers2 && scorers2.length > 0 ? scorers2.map((s: any) => `${s.name} (${s.goals} buts)`).join(', ') : 'Donnee indisponible';

  return {
    isFinished: false,
    quickSummary: `Analyse predictive complete : ${team1.name} vs ${team2.name}. ${favoriteTeam === 'aucune des deux' ? 'Match tres equilibre.' : favoriteTeam + ' part avec un leger avantage selon les donnees.'}`,
    confidence: Math.min(98, Math.max(70, Math.round(75 + Math.abs(winProb - loseProb)/3))),
    winProb, drawProb, loseProb,
    predictedScore: { team1Goals: t1Goals, team2Goals: t2Goals, reasoning: reasoningText },
    globalForm: {
      team1: { recentMatches: recent1, goalsScored: f1.goalsFor, goalsConceded: f1.goalsAgainst, cleanSheets: s1.cleanSheets, avgPossession: s1.avgPossession, winStreak: f1.wins },
      team2: { recentMatches: recent2, goalsScored: f2.goalsFor, goalsConceded: f2.goalsAgainst, cleanSheets: s2.cleanSheets, avgPossession: s2.avgPossession, winStreak: f2.wins }
    },
    scenarios: [
      { title: "Deroulement probable", content: `En se basant sur les donnees, ${t1Goals > t2Goals ? team1.name : team2.name} devrait controler le jeu (${winProb > loseProb ? s1.avgPossession : s2.avgPossession}% de possession moyenne historiquement).` }
    ],
    comparison: {
      attack: { team1: attack1, team2: attack2 },
      defense: { team1: defense1, team2: defense2 },
      form: { team1: form1, team2: form2 },
      h2h: { team1: 50, team2: 50 },
      goals: { team1: Math.min(99, Math.round(xG1*40)), team2: Math.min(99, Math.round(xG2*40)) },
      global: { team1: Math.round((attack1+defense1+form1)/3), team2: Math.round((attack2+defense2+form2)/3) }
    },
    predictions: {
      expectedGoals: { team1: parseFloat(xG1.toFixed(2)), team2: parseFloat(xG2.toFixed(2)), total: parseFloat((xG1+xG2).toFixed(2)) },
      btts: { yes: (t1Goals > 0 && t2Goals > 0) ? 65 : 45, no: (t1Goals === 0 || t2Goals === 0) ? 55 : 35 },
      overUnder: {
        over05: 95,
        over15: (xG1+xG2 > 1.5) ? 75 : 45,
        over25: (xG1+xG2 > 2.5) ? 60 : 35,
        over35: (xG1+xG2 > 3.5) ? 30 : 15
      }
    },
    keyStrengths: { team1: [`Formation en ${s1.formation}`, `Possession de ${s1.avgPossession}%`], team2: [`Formation en ${s2.formation}`, `Possession de ${s2.avgPossession}%`] },
    advancedMetrics: {
      possession: { team1: s1.avgPossession, team2: s2.avgPossession },
      xG: { team1: parseFloat(xG1.toFixed(2)), team2: parseFloat(xG2.toFixed(2)) },
      xT: { team1: parseFloat((xG1*1.1).toFixed(2)), team2: parseFloat((xG2*1.1).toFixed(2)) },
      ppda: { team1: 10, team2: 10 }
    },
    sections: [
      {
        title: "Dynamique & Forme Recente",
        icon: "Activity",
        content: `${team1.name} : ${f1.wins} victoire(s), ${f1.draws} nul(s), ${f1.losses} defaite(s) sur les 5 derniers matchs. ${f1.goalsFor} buts marques, ${f1.goalsAgainst} encaisses. Derniers resultats : ${form1Str || 'Donnee indisponible actuellement.'}.\n\n${team2.name} : ${f2.wins} victoire(s), ${f2.draws} nul(s), ${f2.losses} defaite(s) sur les 5 derniers matchs. ${f2.goalsFor} buts marques, ${f2.goalsAgainst} encaisses. Derniers resultats : ${form2Str || 'Donnee indisponible actuellement.'}.`
      },
      {
        title: "Bataille Offensive & Defensive",
        icon: "Target",
        content: `${team1.name} affiche un rendement offensif de ${off1.toFixed(2)} but(s)/match avec un xG estime a ${xG1.toFixed(2)}. En defense, ${def1.toFixed(2)} but(s) encaisses en moyenne, ${s1.cleanSheets} clean sheet(s) cette saison. Formation principale : ${s1.formation}. Meilleurs buteurs : ${scorers1Text}.\n\n${team2.name} marque en moyenne ${off2.toFixed(2)} but(s)/match (xG ${xG2.toFixed(2)}). En defense : ${def2.toFixed(2)} encaisses/match, ${s2.cleanSheets} clean sheet(s). Formation : ${s2.formation}. Meilleurs buteurs : ${scorers2Text}.\n\nAvantage offensif : ${off1 > off2 ? team1.name : team2.name}. Avantage defensif : ${def1 < def2 ? team1.name : team2.name}.`
      },
      {
        title: "Effectifs & Joueurs Cles",
        icon: "Award",
        content: `${team1.name} : ${squad1Text}\n\n${team2.name} : ${squad2Text}\n\nLa profondeur de l'effectif et la qualite des joueurs selectionnes jouent un role determinant dans l'issue de cette rencontre.`
      },
      {
        title: "Absents & Blesses",
        icon: "Shield",
        content: `${team1.name} - Joueurs absents/blesses : ${inj1Text}.\n\n${team2.name} - Joueurs absents/blesses : ${inj2Text}.\n\n${inj1List.length > 2 ? team1.name + ' est significativement affaibli par ses absences.' : inj2List.length > 2 ? team2.name + ' est significativement affaibli par ses absences.' : 'Les deux effectifs semblent relativement au complet pour cette rencontre.'}`
      },
      {
        title: "Historique des Confrontations",
        icon: "History",
        content: `Derniers face-a-face : ${h2hText}.\n\n${h2hRecent.length > 0 ? 'L\'historique recense ' + h2hRecent.length + ' confrontation(s) recente(s) entre ces deux equipes.' : 'Pas de confrontation directe recente trouvee dans la base de donnees.'}`
      },
      {
        title: "Contexte & Enjeux du Match",
        icon: "Trophy",
        content: `Ce match entre ${team1.name} et ${team2.name} s'inscrit dans un contexte competitif important. ${winProb > 55 ? team1.name + ' joue avec la pression du favori et devra confirmer sa superiorite statistique.' : loseProb > 55 ? team2.name + ' part favori mais devra gerer la pression du deplacement.' : 'Les deux equipes se tiennent de tres pres, ce qui promet un match intense et indecis.'}\n\nLa possession moyenne (${s1.avgPossession}% vs ${s2.avgPossession}%) donnera un indice sur qui controlera le rythme du match.`
      },
      {
        title: "Justification du Score Final",
        icon: "Brain",
        content: `Le score de ${t1Goals}-${t2Goals} est estime sur la base des expected goals (${xG1.toFixed(2)} vs ${xG2.toFixed(2)}), ajustes par la forme recente et l'avantage domicile (+0.25 xG).\n\nProbabilites : Victoire ${team1.name} ${winProb}%, Nul ${drawProb}%, Victoire ${team2.name} ${loseProb}%.\n\n${reasoningText}`
      }
    ]
  };
}
