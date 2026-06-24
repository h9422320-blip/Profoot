process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// ProFoot ANALYSE ENGINE v6.0 — FULL AI DELEGATION
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
    // French -> English
    "espagne": "Spain", "allemagne": "Germany", "angleterre": "England", 
    "brésil": "Brazil", "bresil": "Brazil", "brasil": "Brazil",
    "france": "France", "argentine": "Argentina", "argentina": "Argentina",
    "maroc": "Morocco", "sénégal": "Senegal", "senegal": "Senegal", 
    "algérie": "Algeria", "algerie": "Algeria",
    "côte d'ivoire": "Ivory Coast", "cote d'ivoire": "Ivory Coast", "cote divoire": "Ivory Coast",
    "égypte": "Egypt", "egypte": "Egypt",
    "cameroun": "Cameroon", "rd congo": "Congo DR", "pays de galles": "Wales", 
    "croatie": "Croatia", "italie": "Italy", "danemark": "Denmark",
    "pays-bas": "Netherlands", "belgique": "Belgium", "portugal": "Portugal",
    "etats-unis": "USA", "usa": "USA", "suisse": "Switzerland", "uruguay": "Uruguay",
    "colombie": "Colombia", "mexique": "Mexico", "mexico": "Mexico",
    "ghana": "Ghana", "nigeria": "Nigeria", "tunisie": "Tunisia",
    "mali": "Mali", "guinée": "Guinea", "guinee": "Guinea", "burkina faso": "Burkina Faso",
    "japon": "Japan", "corée du sud": "South Korea", "australie": "Australia",
    "hollande": "Netherlands",
    "serbie": "Serbia", "pologne": "Poland", "roumanie": "Romania",
    "suède": "Sweden", "suede": "Sweden",
    "norvège": "Norway", "norvege": "Norway", "finlande": "Finland",
    "russie": "Russia", "turquie": "Turkey", "grèce": "Greece", "grece": "Greece",
    "chine": "China", "inde": "India", "arabie saoudite": "Saudi Arabia",
    "iran": "Iran", "irak": "Iraq", "émirats arabes unis": "United Arab Emirates",
    "angola": "Angola", "mozambique": "Mozambique", "zimbabwe": "Zimbabwe",
    "afrique du sud": "South Africa", "zambie": "Zambia", "kenya": "Kenya",
    "tanzanie": "Tanzania", "ethiopie": "Ethiopia",
    "venezuela": "Venezuela", "pérou": "Peru", "perou": "Peru", "chili": "Chile",
    "bolivie": "Bolivia", "équateur": "Ecuador", "equateur": "Ecuador", "paraguay": "Paraguay",
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
  const cacheKey = `${team1.id || team1.name}-${team2.id || team2.name}-${today}`;
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

  let id1 = null; let id2 = null;
  try {
    const ids = await Promise.all([getTeamApiId(team1), getTeamApiId(team2)]);
    id1 = ids[0]; id2 = ids[1];
  } catch (e) {}

  let t1Data: any = null, t2Data: any = null, h2hRes: any = null;
  const season = getCurrentSeason();

  if (id1 && id2) {
    console.log(`[BACKEND_ANALYZE] Fetching H2H and Fixtures...`);
    const [t1d, t2d, h2hr] = await Promise.all([
      getFixturesWithFallback(id1, season),
      getFixturesWithFallback(id2, season),
      fetchApiFootball(`/fixtures/headtohead?h2h=${id1}-${id2}`)
    ]);
    t1Data = t1d; t2Data = t2d; h2hRes = h2hr;
  } else {
    console.warn(`[BACKEND_ANALYZE] API-Football IDs missing (Rate Limit or Unmapped). Bypassing API-Football for PURE AI analysis.`);
    t1Data = { data: { response: [] }, season };
    t2Data = { data: { response: [] }, season };
    h2hRes = { response: [] };
  }

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
    // ... (Past Match Logic remains the same as before for history)
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

    const scorers = formatEvents.filter((ev: any) => ev.type === "goal").map((ev: any) => ({ name: ev.name, minute: ev.minute, side: ev.side }));
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
  // CASE 2: FUTURE MATCH — FULL AI PREDICTION WITH GEMINI
  // ============================================================================
  console.log(`[BACKEND_ANALYZE] Match identified as FUTURE. Fetching deep stats...`);

  const t1Fixtures = t1Data.data;
  const t2Fixtures = t2Data.data;
  const t1Season = t1Data.season;
  const t2Season = t2Data.season;

  let t1League = 39; let t2League = 39;
  if (t1Fixtures?.response?.length > 0) t1League = t1Fixtures.response[0].league.id;
  if (t2Fixtures?.response?.length > 0) t2League = t2Fixtures.response[0].league.id;

  let t1Stats = null, t2Stats = null, t1Injuries = null, t2Injuries = null, t1Squad = null, t2Squad = null, t1TopScorers = null, t2TopScorers = null, t1Standings = null, t2Standings = null;

  if (id1 && id2) {
    const statsRes = await Promise.all([
      fetchApiFootball(`/teams/statistics?team=${id1}&season=${t1Season}&league=${t1League}`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/teams/statistics?team=${id2}&season=${t2Season}&league=${t2League}`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/injuries?team=${id1}&season=${t1Season}`),
      fetchApiFootball(`/injuries?team=${id2}&season=${t2Season}`),
      fetchApiFootball(`/players/squads?team=${id1}`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/players/squads?team=${id2}`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/players/topscorers?season=${t1Season}&league=${t1League}`),
      fetchApiFootball(`/players/topscorers?season=${t2Season}&league=${t2League}`),
      fetchApiFootball(`/standings?season=${t1Season}&league=${t1League}`, CACHE_TTL.API_DATA),
      fetchApiFootball(`/standings?season=${t2Season}&league=${t2League}`, CACHE_TTL.API_DATA)
    ]);
    [t1Stats, t2Stats, t1Injuries, t2Injuries, t1Squad, t2Squad, t1TopScorers, t2TopScorers, t1Standings, t2Standings] = statsRes;
  }

  // Extract Standings Info (For League Level/Rank Context)
  const extractStandings = (standingsRes: any, teamId: string) => {
    try {
      const leageStandings = standingsRes?.response?.[0]?.league?.standings?.[0] || [];
      const teamStanding = leageStandings.find((s: any) => s.team.id.toString() === teamId.toString());
      if (teamStanding) {
        return `Classé ${teamStanding.rank}e sur ${leageStandings.length}. Forme ligue: ${teamStanding.form}. Points: ${teamStanding.points}.`;
      }
    } catch(e) {}
    return "Classement inconnu ou non applicable (ex: match amical).";
  };
  const stand1 = extractStandings(t1Standings, id1);
  const stand2 = extractStandings(t2Standings, id2);

  // Extract squad player names
  function extractSquad(squadRes: any) {
    const players = squadRes?.response?.[0]?.players || [];
    const byPosition: Record<string, string[]> = { Goalkeeper: [], Defender: [], Midfielder: [], Attacker: [] };
    players.forEach((p: any) => {
      const pos = p.position || 'Unknown';
      if (byPosition[pos]) byPosition[pos].push(p.name);
    });
    return { all: players.map((p: any) => p.name), byPosition, count: players.length };
  }
  const squad1 = extractSquad(t1Squad);
  const squad2 = extractSquad(t2Squad);

  function extractTeamTopScorers(topScorersRes: any, teamId: string) {
    const all = topScorersRes?.response || [];
    return all.filter((p: any) => p.statistics?.[0]?.team?.id?.toString() === teamId.toString()).slice(0, 3).map((p: any) => ({ name: p.player.name, goals: p.statistics[0].goals.total || 0 }));
  }
  const scorers1 = extractTeamTopScorers(t1TopScorers, id1);
  const scorers2 = extractTeamTopScorers(t2TopScorers, id2);

  // Get Recent Matches
  const getRecentMatches = (fixtures: any[], teamId: string) => {
    const allMatches = (fixtures || []).filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
    allMatches.sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
    return allMatches.slice(0, 5).map((f: any) => {
      const isHome = f.teams?.home?.id?.toString() === teamId;
      const gh = f.goals?.home ?? 0; const ga = f.goals?.away ?? 0;
      let res: "W" | "D" | "L" = "D";
      if (gh !== ga) res = (isHome && gh > ga) || (!isHome && ga > gh) ? "W" : "L";
      return { opponent: isHome ? f.teams?.away?.name : f.teams?.home?.name, score: `${gh}-${ga}`, result: res };
    });
  };
  const recent1 = getRecentMatches(t1Fixtures?.response, id1);
  const recent2 = getRecentMatches(t2Fixtures?.response, id2);

  // Base Fallback Metrics (Just for basic display if Gemini fails completely)
  const s1r = t1Stats?.response || {};
  const s2r = t2Stats?.response || {};
  const baseAvgPossession1 = parseInt(s1r.ball_possession?.average || "50", 10);
  const baseAvgPossession2 = parseInt(s2r.ball_possession?.average || "50", 10);
  const baseGoalsFor1 = s1r.goals?.for?.total?.total || 0;
  const baseGoalsFor2 = s2r.goals?.for?.total?.total || 0;
  const baseGoalsAgainst1 = s1r.goals?.against?.total?.total || 0;
  const baseGoalsAgainst2 = s2r.goals?.against?.total?.total || 0;
  const played1 = s1r.fixtures?.played?.total || 1;
  const played2 = s2r.fixtures?.played?.total || 1;
  const winStreak1 = s1r.fixtures?.wins?.total || 0;
  const winStreak2 = s2r.fixtures?.wins?.total || 0;

  // GEMINI PROMPT GENERATION
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY || GEMINI_KEY === "fallback_key_for_safety" || GEMINI_KEY === "") {
    return NextResponse.json({ error: "Clé API Gemini manquante. Impossible de générer la prédiction." }, { status: 500 });
  }

  try {
    console.log(`[BACKEND_ANALYZE] Calling Gemini for PREDICTION and EXPERT ANALYSIS...`);
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    // Use flash as it's very fast and excellent at reasoning with structured JSON
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout

    const prompt = `Tu es le moteur de prédiction IA de ProFoot, un système ultra-avancé d'analyse de football.
TA MISSION : Analyser le match entre ${team1.name} et ${team2.name}, prendre en compte LA FORCE REELLE DES ÉQUIPES, évaluer les dynamiques et PREDIRE LE SCORE EXACT avec une explication détaillée.
TRÈS IMPORTANT : Si les données statistiques ci-dessous sont vides ou incomplètes (ex: possession à 50%, buts à 0), CELA SIGNIFIE QUE NOTRE API STATISTIQUE EST INJOIGNABLE. DANS CE CAS, IGNORE CES DONNÉES VIDES ET UTILISE TA PROPRE CONNAISSANCE GLOBALE DU FOOTBALL POUR RÉDIGER UNE ANALYSE PARFAITE DE CE MATCH !

DONNÉES REELLES FOURNIES :

[DONNÉES ${team1.name}]
- Niveau/Classement : ${stand1}
- Statistiques globales : ${baseGoalsFor1} buts marqués, ${baseGoalsAgainst1} encaissés en ${played1} matchs. Possession : ${baseAvgPossession1}%.
- Derniers résultats : ${JSON.stringify(recent1)}
- Blessures majeures : ${JSON.stringify(t1Injuries?.response?.slice(0,5).map((i:any)=>i.player.name) || "Aucune")}
- Meilleurs buteurs : ${scorers1.map((s:any) => `${s.name} (${s.goals})`).join(', ')}

[DONNÉES ${team2.name}]
- Niveau/Classement : ${stand2}
- Statistiques globales : ${baseGoalsFor2} buts marqués, ${baseGoalsAgainst2} encaissés en ${played2} matchs. Possession : ${baseAvgPossession2}%.
- Derniers résultats : ${JSON.stringify(recent2)}
- Blessures majeures : ${JSON.stringify(t2Injuries?.response?.slice(0,5).map((i:any)=>i.player.name) || "Aucune")}
- Meilleurs buteurs : ${scorers2.map((s:any) => `${s.name} (${s.goals})`).join(', ')}

[HISTORIQUE CONFRONTATIONS (H2H)]
${JSON.stringify(pastMatches.slice(0, 3).map((m:any)=>`${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`))}

TON ANALYSE ET TA DECISION :
1. Évalue la différence de niveau réel entre les deux équipes (très important pour des matchs comme Belgique vs Iran, ou une équipe européenne vs une équipe asiatique/africaine).
2. Prédit le score exact (team1Goals et team2Goals).
3. Calcule les probabilités (winProb, drawProb, loseProb, somme = 100).
4. Génère les métriques avancées et les textes d'analyse pour l'utilisateur.

RETOURNE UNIQUEMENT UN JSON VALIDE AVEC LA STRUCTURE EXACTE SUIVANTE (aucun markdown) :
{
  "predictedScore": { "team1Goals": 0, "team2Goals": 0, "reasoning": "Phrase courte de 2 lignes justifiant le score avec des arguments percutants." },
  "winProb": 0,
  "drawProb": 0,
  "loseProb": 0,
  "confidence": 0, // entre 70 et 99 selon la certitude de ta prédiction
  "quickSummary": "Un résumé captivant du match.",
  "comparison": {
    "attack": { "team1": 0, "team2": 0 }, // Score de 10 à 99
    "defense": { "team1": 0, "team2": 0 },
    "form": { "team1": 0, "team2": 0 },
    "h2h": { "team1": 50, "team2": 50 },
    "goals": { "team1": 0, "team2": 0 },
    "global": { "team1": 0, "team2": 0 }
  },
  "predictions": {
    "expectedGoals": { "team1": 0.0, "team2": 0.0, "total": 0.0 },
    "btts": { "yes": 0, "no": 0 },
    "overUnder": { "over05": 0, "over15": 0, "over25": 0, "over35": 0 }
  },
  "advancedMetrics": {
    "possession": { "team1": 50, "team2": 50 },
    "xG": { "team1": 0.0, "team2": 0.0 },
    "xT": { "team1": 0.0, "team2": 0.0 },
    "ppda": { "team1": 10, "team2": 10 }
  },
  "keyStrengths": { "team1": ["Force 1", "Force 2"], "team2": ["Force 1", "Force 2"] },
  "scenarios": [ { "title": "Scénario principal", "content": "..." } ],
  "sections": [
    { "title": "Dynamique & Forme Récente", "icon": "Activity", "content": "Analyse détaillée de la forme. 4 phrases." },
    { "title": "Bataille Offensive & Défensive", "icon": "Target", "content": "Analyse détaillée des forces en présence. 4 phrases." },
    { "title": "Effectifs & Joueurs Clés", "icon": "Award", "content": "Analyse des joueurs. 4 phrases." },
    { "title": "Absents & Blessés", "icon": "Shield", "content": "Impact des blessés. 4 phrases." },
    { "title": "Historique des Confrontations", "icon": "History", "content": "Analyse du H2H. 4 phrases." },
    { "title": "Contexte & Enjeux du Match", "icon": "Trophy", "content": "Importance du match et pression. 4 phrases." },
    { "title": "Justification du Score Final", "icon": "Brain", "content": "Pourquoi tu as choisi ce score final précis en croisant l'écart de niveau et la forme. 5 phrases." }
  ]
}`;

    const result = await model.generateContent(prompt, { signal: controller.signal } as any);
    clearTimeout(timeoutId);
    
    let responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    const parsedData = JSON.parse(responseText);

    // Merge API basic data to keep the interface working
    parsedData.isFinished = false;
    parsedData.globalForm = {
      team1: { recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1, cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1, winStreak: winStreak1 },
      team2: { recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2, cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2, winStreak: winStreak2 }
    };

    console.log(`[BACKEND_ANALYZE] Gemini analysis & prediction completed successfully.`);
    analysisCache.set(cacheKey, { data: parsedData, timestamp: Date.now() });
    
    return NextResponse.json(parsedData);

  } catch (e: any) {
    console.error("[BACKEND_ANALYZE] Gemini failed:", e.message);
    
    // MATHEMATICAL FALLBACK IN CASE OF GEMINI ERROR (ex: Leaked API Key)
    let winProb = 45; let loseProb = 25; let drawProb = 30;
    let t1Goals = 2; let t2Goals = 1;
    if (baseGoalsFor2 > baseGoalsFor1) {
       winProb = 25; loseProb = 45; t1Goals = 1; t2Goals = 2;
    }
    
    const fallbackData = {
      isFinished: false,
      predictedScore: { team1Goals: t1Goals, team2Goals: t2Goals, reasoning: `(Mode Secours Automatique) ${t1Goals > t2Goals ? team1.name : team2.name} est favori selon les statistiques de base.` },
      winProb, drawProb, loseProb,
      confidence: 75,
      quickSummary: `[Note: Analyse IA désactivée - Problème de clé API Google] Prédiction basée sur les statistiques globales.`,
      comparison: {
        attack: { team1: 60, team2: 50 }, defense: { team1: 60, team2: 50 },
        form: { team1: 60, team2: 50 }, h2h: { team1: 50, team2: 50 },
        goals: { team1: 60, team2: 50 }, global: { team1: 60, team2: 50 }
      },
      predictions: {
        expectedGoals: { team1: t1Goals + 0.5, team2: t2Goals + 0.2, total: t1Goals + t2Goals + 0.7 },
        btts: { yes: 60, no: 40 },
        overUnder: { over05: 90, over15: 75, over25: 50, over35: 30 }
      },
      advancedMetrics: {
        possession: { team1: baseAvgPossession1, team2: baseAvgPossession2 },
        xG: { team1: t1Goals + 0.5, team2: t2Goals + 0.2 },
        xT: { team1: t1Goals + 0.6, team2: t2Goals + 0.3 },
        ppda: { team1: 10, team2: 10 }
      },
      keyStrengths: { team1: ["Donnée non disponible"], team2: ["Donnée non disponible"] },
      scenarios: [ { title: "Scénario de base", content: "Analyse experte indisponible." } ],
      sections: [
        { title: "Dynamique & Forme Récente", icon: "Activity", content: `Statistiques basiques : ${team1.name} a marqué ${baseGoalsFor1} buts cette saison. ${team2.name} a marqué ${baseGoalsFor2} buts.` },
        { title: "Bataille Offensive & Défensive", icon: "Target", content: "Analyse détaillée impossible sans IA." },
        { title: "Effectifs & Joueurs Clés", icon: "Award", content: "Analyse des joueurs impossible sans IA." },
        { title: "Absents & Blessés", icon: "Shield", content: "Données ignorées en mode secours." },
        { title: "Historique des Confrontations", icon: "History", content: "Données ignorées en mode secours." },
        { title: "Contexte & Enjeux du Match", icon: "Trophy", content: "Données ignorées en mode secours." },
        { title: "Alerte Système", icon: "Brain", content: "Le modèle d'intelligence artificielle n'a pas pu être contacté car la clé API Gemini configurée sur le serveur a été désactivée par Google (erreur: API key leaked). Veuillez configurer une nouvelle clé API dans les variables d'environnement Vercel." }
      ],
      globalForm: {
        team1: { recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1, cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1, winStreak: winStreak1 },
        team2: { recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2, cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2, winStreak: winStreak2 }
      }
    };
    
    analysisCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
    return NextResponse.json(fallbackData);
  }
}
