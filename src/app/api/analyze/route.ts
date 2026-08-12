import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { avecBasculeDeModele, MODELES_GEMINI } from "@/lib/gemini-models";
import { requireUser } from "@/lib/subscription";
import { consumeAnalysis, buildMatchKey, type QuotaState } from "@/lib/analysis-quota";
import { toTeaser } from "@/lib/analysis-teaser";
import { clubs } from "@/lib/data";
import { findLiveTeam } from "@/lib/teams-live";
import { calculerScoreProbable, bornerConfiance } from "@/lib/score-probable";
import { enregistrerEchecAnalyse } from "@/lib/echecs-analyse";

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
    setBounded(apiFootballCache, cacheKey, { data, timestamp: Date.now() });
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

import { isRateLimited, clientIp, setBounded } from "@/lib/rateLimit";

// L'analyse enchaîne plusieurs appels API-Football puis un appel Gemini : bien
// au-delà des 10 s accordées par défaut à une fonction serverless. Sans cette
// déclaration, l'hébergeur interrompt la requête et le client voit une
// « erreur de connexion au modèle IA ».
export const maxDuration = 60;

export async function POST(req: Request) {
  // --- PERMISSIONS ---
  // L'analyse est ouverte à tout utilisateur connecté : le modèle produit est
  // un APERÇU gratuit (résultat partiel, reste flouté avec invitation à
  // s'abonner). Exiger un abonnement ici supprimerait cet aperçu, qui est le
  // principal levier de conversion.
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  // --- BOUCLIER ANTI-SPAM (5 requêtes par minute) ---
  // Clé = identifiant du compte : contrairement à l'IP, il n'est pas
  // renouvelable à volonté par l'attaquant.
  const ip = guard.user.id;
  if (isRateLimited(ip, 'analyze', 5, 60 * 1000)) {
    console.warn(`[ANTI-SPAM] Compte ${ip} bloqué pour abus d'analyse.`);
    return NextResponse.json({ error: "Trop de requêtes. Veuillez patienter une minute." }, { status: 429 });
  }
  // --------------------------------------------------

  let reqPayload: any = {};
  try {
    reqPayload = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // SÉCURITÉ : les équipes sont résolues depuis le référentiel serveur à partir
  // de leur seul identifiant. Faire confiance aux noms envoyés par le client
  // permettrait d'injecter des instructions dans le prompt de l'IA, et de
  // stocker la réponse détournée dans le cache partagé par tous les abonnés.
  const rawTeam1 = reqPayload.team1;
  const rawTeam2 = reqPayload.team2;
  if (!rawTeam1?.id || !rawTeam2?.id) {
    return NextResponse.json({ error: "Équipes manquantes" }, { status: 400 });
  }
  // hasOwnProperty et non `clubs[id]` : un identifiant comme "constructor" ou
  // "toString" remonte la chaîne de prototypes et passerait un simple test de
  // vérité, avec un objet qui n'est pas une équipe.
  const teamKey1 = String(rawTeam1.id);
  const teamKey2 = String(rawTeam2.id);

  // Une équipe est valide si elle figure dans le référentiel historique OU
  // dans la liste chargée en direct depuis API-Football (promus, championnats
  // hors « big 5 »). Le nom n'est jamais repris du client : il vient toujours
  // d'une source serveur, ce qui ferme l'injection dans le prompt de l'IA.
  const resolveTeam = async (id: string) => {
    if (Object.prototype.hasOwnProperty.call(clubs, id)) return clubs[id];
    const live = await findLiveTeam(id);
    if (!live) return null;
    return {
      id: live.id,
      name: live.name,
      logo: live.logo,
      country: live.country,
      league: live.league,
      stadium: live.stadium,
    } as any;
  };

  const [team1, team2] = await Promise.all([resolveTeam(teamKey1), resolveTeam(teamKey2)]);
  if (!team1 || !team2) {
    return NextResponse.json({ error: "Équipe inconnue" }, { status: 404 });
  }

  // --- QUOTA MENSUEL ---
  // Contrôlé AVANT le cache : sinon un abonné ayant épuisé sa limite obtiendrait
  // gratuitement une analyse déjà mise en cache par quelqu'un d'autre.
  // Les comptes gratuits ne sont pas décomptés : ils reçoivent l'aperçu
  // partiel, verrouillé par le paywall — c'est le levier de conversion.
  const quotaMatchKey = buildMatchKey(team1.id, team2.id);
  let quota: QuotaState | null = null;

  if (guard.entitlements.premium) {
    const consumption = await consumeAnalysis(
      guard.user.id,
      guard.entitlements,
      quotaMatchKey
    );
    quota = consumption.state;

    if (!consumption.allowed) {
      return NextResponse.json(
        {
          error: `Limite mensuelle atteinte : ${consumption.state.limit} analyses pour votre offre.`,
          code: 'ANALYSIS_LIMIT_REACHED',
          quota: consumption.state,
        },
        { status: 429 }
      );
    }
  }

  /**
   * Seule sortie de cette route. Un compte sans abonnement ne reçoit que
   * l'aperçu : le contenu payant est retiré ICI et ne quitte jamais le serveur.
   * Flouter côté navigateur ne protégeait rien, la réponse complète étant déjà
   * lisible dans les outils de développement.
   */
  const respond = (data: Record<string, any>) =>
    NextResponse.json(
      guard.entitlements.premium
        ? { ...data, quota }
        : { ...toTeaser(data), quota }
    );

  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${team1.id}-${team2.id}-${today}`;
  const cachedAnalysis = analysisCache.get(cacheKey);
  if (cachedAnalysis && Date.now() - cachedAnalysis.timestamp < CACHE_TTL.ANALYSIS) {
    console.log(`[BACKEND_ANALYZE] Returning CACHED analysis for ${team1.name} vs ${team2.name}`);
    return respond(cachedAnalysis.data);
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

  let t1Data: any = null, t2Data: any = null, h2hRes: any = null, nextH2H: any = null;
  // Derniers matchs joués, indépendamment de la saison — voir plus bas.
  let t1Recent: any = { response: [] }, t2Recent: any = { response: [] };
  const season = getCurrentSeason();

  if (id1 && id2) {
    console.log(`[BACKEND_ANALYZE] Fetching H2H and Fixtures...`);
    // Sans le paramètre `next`, l'API ne renvoie que des confrontations
    // PASSÉES : la rencontre à venir (date, heure, stade) était donc invisible.
    //
    // Deux requêtes distinctes pour les matchs d'une équipe :
    //
    //  - AVEC la saison : sert à identifier le championnat de l'équipe.
    //
    //  - SANS la saison : sert à la forme récente. En début d'exercice, une
    //    équipe n'a joué que deux ou trois matchs amicaux dans la saison en
    //    cours ; filtrer dessus ne renvoyait donc que ces deux matchs et
    //    l'affichage se remplissait de cases vides. La forme d'une équipe ne
    //    s'arrête pas au 1er juillet : les dernières journées de l'exercice
    //    précédent en font partie.
    const [t1Fixtures, t2Fixtures, h2hr, nextH2Hr, r1, r2] = await Promise.all([
      fetchApiFootball(`/fixtures?team=${id1}&season=${season}&last=10`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/fixtures?team=${id2}&season=${season}&last=10`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/fixtures/headtohead?h2h=${id1}-${id2}`),
      fetchApiFootball(`/fixtures/headtohead?h2h=${id1}-${id2}&next=1`, CACHE_TTL.API_DATA),
      fetchApiFootball(`/fixtures?team=${id1}&last=12`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/fixtures?team=${id2}&last=12`, CACHE_TTL.TEAM_STATS)
    ]);
    t1Data = { data: t1Fixtures, season };
    t2Data = { data: t2Fixtures, season };
    t1Recent = r1 ?? { response: [] };
    t2Recent = r2 ?? { response: [] };
    h2hRes = h2hr;
    nextH2H = nextH2Hr?.response?.[0] || null;
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
    setBounded(analysisCache, cacheKey, { data: realMatchResult, timestamp: Date.now() });
    return respond(realMatchResult);
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

    // ── SAISON QUI VIENT DE COMMENCER ────────────────────────────────────────
    //
    // Vérifié le 12 août 2026 sur la Liga : Barcelone, Elche et le Real
    // affichaient tous 0 match, 0 but pour la saison en cours, qui débutait à
    // peine. Trois semaines par an, toutes les équipes d'un championnat sont
    // donc statistiquement vides.
    //
    // Sans ce rattrapage, le calcul du score reçoit des zéros pour les deux
    // équipes, les considère comme équivalentes, et rend le même résultat pour
    // toutes les affiches — le défaut qu'on vient précisément de corriger.
    // La saison précédente est complète et reste le meilleur reflet du niveau
    // d'une équipe tant que la nouvelle n'a pas produit de matchs.
    const aucuneDonnee = (stats: any) => !((stats?.response?.fixtures?.played?.total ?? 0) > 0);

    if (aucuneDonnee(t1Stats) || aucuneDonnee(t2Stats)) {
      const [precedent1, precedent2] = await Promise.all([
        aucuneDonnee(t1Stats)
          ? fetchApiFootball(`/teams/statistics?team=${id1}&season=${t1Season - 1}&league=${t1League}`, CACHE_TTL.TEAM_STATS)
          : Promise.resolve(null),
        aucuneDonnee(t2Stats)
          ? fetchApiFootball(`/teams/statistics?team=${id2}&season=${t2Season - 1}&league=${t2League}`, CACHE_TTL.TEAM_STATS)
          : Promise.resolve(null),
      ]);
      if (precedent1 && !aucuneDonnee(precedent1)) {
        console.log(`[BACKEND_ANALYZE] Saison ${t1Season} vide pour ${id1} — bascule sur ${t1Season - 1}.`);
        t1Stats = precedent1;
      }
      if (precedent2 && !aucuneDonnee(precedent2)) {
        console.log(`[BACKEND_ANALYZE] Saison ${t2Season} vide pour ${id2} — bascule sur ${t2Season - 1}.`);
        t2Stats = precedent2;
      }
    }
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
  // La forme se lit sur les derniers matchs RÉELLEMENT joués, toutes
  // compétitions et toutes saisons confondues. Repli sur les matchs de la
  // saison en cours si la requête sans saison n'a rien renvoyé.
  const recent1 = getRecentMatches(
    (t1Recent?.response?.length ? t1Recent.response : t1Fixtures?.response),
    id1
  );
  const recent2 = getRecentMatches(
    (t2Recent?.response?.length ? t2Recent.response : t2Fixtures?.response),
    id2
  );

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

  // ── SCORE CALCULÉ ──────────────────────────────────────────────────────────
  //
  // Le score exact était demandé au modèle de langage. Constaté sur 228 analyses
  // réelles : 186 annonçaient 2-1, soit 82 %, y compris pour la même affiche
  // inversée. Un modèle de langage ne calcule pas un score, il répond le plus
  // banal du football.
  //
  // Il est donc calculé ici, à partir des buts marqués et encaissés des deux
  // équipes et de l'avantage du terrain. Le modèle garde la rédaction ; il ne
  // décide plus des chiffres.
  const lieuConnu = targetFutureMatch || targetPastMatch || nextH2H;
  const equipe1AJoueADomicile: boolean | null = lieuConnu
    ? String(lieuConnu.teams?.home?.id) === String(id1)
    : null;

  const scoreCalcule = calculerScoreProbable(
    { butsMarques: baseGoalsFor1, butsEncaisses: baseGoalsAgainst1, matchsJoues: played1 },
    { butsMarques: baseGoalsFor2, butsEncaisses: baseGoalsAgainst2, matchsJoues: played2 },
    equipe1AJoueADomicile
  );

  /**
   * Impose les chiffres calculés à la réponse du modèle.
   *
   * Le modèle rédige, mais les nombres affichés sont ceux du calcul : sans quoi
   * le texte et le score pourraient se contredire, et le 2-1 reviendrait par la
   * fenêtre. Sert aussi bien quand le modèle répond que quand il échoue.
   */
  const imposerChiffresCalcules = (donnees: any) => {
    const raison =
      typeof donnees?.predictedScore?.reasoning === 'string' && donnees.predictedScore.reasoning.trim()
        ? donnees.predictedScore.reasoning
        : `Les buts attendus ressortent à ${scoreCalcule.butsAttendus1} contre ${scoreCalcule.butsAttendus2}, ce qui rend ce score le plus probable.`;

    donnees.predictedScore = {
      team1Goals: scoreCalcule.buts1,
      team2Goals: scoreCalcule.buts2,
      reasoning: raison,
    };
    donnees.winProb = scoreCalcule.probaVictoire1;
    donnees.drawProb = scoreCalcule.probaNul;
    donnees.loseProb = scoreCalcule.probaVictoire2;
    // Une analyse à 100 % et une autre à 8 % ont réellement été servies.
    donnees.confidence = scoreCalcule.donneesInsuffisantes
      ? scoreCalcule.confiance
      : bornerConfiance(scoreCalcule.confiance);

    donnees.predictions = {
      ...(donnees.predictions ?? {}),
      expectedGoals: {
        team1: scoreCalcule.butsAttendus1,
        team2: scoreCalcule.butsAttendus2,
        total: Math.round((scoreCalcule.butsAttendus1 + scoreCalcule.butsAttendus2) * 100) / 100,
      },
      btts: {
        yes: scoreCalcule.probaLesDeuxMarquent,
        no: 100 - scoreCalcule.probaLesDeuxMarquent,
      },
      overUnder: {
        over05: scoreCalcule.probaPlusDe.zeroCinq,
        over15: scoreCalcule.probaPlusDe.unCinq,
        over25: scoreCalcule.probaPlusDe.deuxCinq,
        over35: scoreCalcule.probaPlusDe.troisCinq,
      },
    };
    return donnees;
  };

  // GEMINI PROMPT GENERATION
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY || GEMINI_KEY === "fallback_key_for_safety" || GEMINI_KEY === "") {
    return NextResponse.json({ error: "Clé API Gemini manquante. Impossible de générer la prédiction." }, { status: 500 });
  }

  const debutAnalyse = Date.now();
  try {
    console.log(`[BACKEND_ANALYZE] Calling Gemini for PREDICTION and EXPERT ANALYSIS...`);
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    // Use flash as it's very fast and excellent at reasoning with structured JSON
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash", generationConfig: { responseMimeType: "application/json" } });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout

    const apiDataMissing = (baseGoalsFor1 === 0 && baseGoalsFor2 === 0 && played1 <= 1);
    const prompt = `Tu es le moteur de prédiction IA de ProFoot, un système ultra-avancé d'analyse de football.
TA MISSION : Analyser le match entre ${team1.name} et ${team2.name}, prendre en compte LA FORCE REELLE DES ÉQUIPES, évaluer les dynamiques et PREDIRE LE SCORE EXACT.

⚠️ RÈGLE ABSOLUE N°1 - INTERDIT : Il est FORMELLEMENT INTERDIT d'écrire des phrases du genre "absence de données récentes", "manque d'informations", "données insuffisantes" ou toute formulation similaire. TU ES UNE IA ENTRAÎNÉE SUR DES MILLIONS DE DONNÉES FOOTBALLISTIQUES. Tu connais ${team1.name} et ${team2.name} : leurs joueurs, leurs résultats récents, leur style de jeu. UTILISE CES CONNAISSANCES.
⚠️ RÈGLE ABSOLUE N°2 - DONNÉES VIDES : ${apiDataMissing ? `Les statistiques API pour ce match affichent 0 (ces équipes n'ont peut-être pas encore de matchs enregistrés dans la ligue cette saison, ou ce sont des équipes nationales). IGNORE CES ZÉROS. Dans ton JSON, retourne des valeurs RÉALISTES basées sur ta connaissance réelle de ces équipes (buts marqués, possession habituelle, forme réelle). Cite des résultats récents réels que tu connais.` : `Les données API sont disponibles, utilise-les.`}

DONNÉES REELLES FOURNIES :

[DONNÉES ${team1.name}]
- Niveau/Classement : ${stand1}
- Statistiques globales : ${baseGoalsFor1} buts marqués, ${baseGoalsAgainst1} encaissés en ${played1} matchs. Possession : ${baseAvgPossession1}%.
- Derniers résultats : ${JSON.stringify(recent1)}
- Blessures majeures : ${JSON.stringify(t1Injuries?.response?.slice(0,5).map((i:any)=>i.player.name) || "Aucune")}
- Meilleurs buteurs : ${scorers1.length > 0 ? scorers1.map((s:any) => `${s.name} (${s.goals})`).join(', ') : "Inconnu (utilise tes connaissances)"}
- Effectif complet : ${squad1.all.length > 0 ? squad1.all.slice(0, 20).join(', ') : "Inconnu (API injoignable, base-toi sur ta propre connaissance des titulaires et remplaçants actuels de " + team1.name + ")"}

[DONNÉES ${team2.name}]
- Niveau/Classement : ${stand2}
- Statistiques globales : ${baseGoalsFor2} buts marqués, ${baseGoalsAgainst2} encaissés en ${played2} matchs. Possession : ${baseAvgPossession2}%.
- Derniers résultats : ${JSON.stringify(recent2)}
- Blessures majeures : ${JSON.stringify(t2Injuries?.response?.slice(0,5).map((i:any)=>i.player.name) || "Aucune")}
- Meilleurs buteurs : ${scorers2.length > 0 ? scorers2.map((s:any) => `${s.name} (${s.goals})`).join(', ') : "Inconnu (utilise tes connaissances)"}
- Effectif complet : ${squad2.all.length > 0 ? squad2.all.slice(0, 20).join(', ') : "Inconnu (API injoignable, base-toi sur ta propre connaissance des titulaires et remplaçants actuels de " + team2.name + ")"}

[HISTORIQUE CONFRONTATIONS (H2H)]
${JSON.stringify(pastMatches.slice(0, 3).map((m:any)=>`${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`))}

[PROJECTION CHIFFRÉE DÉJÀ CALCULÉE — À NE PAS CONTREDIRE]
Le score et les probabilités de ce match ont été calculés à partir des buts marqués et encaissés des deux équipes et de l'avantage du terrain. Ils sont définitifs :
- Buts attendus : ${team1.name} ${scoreCalcule.butsAttendus1} — ${team2.name} ${scoreCalcule.butsAttendus2}
- Score le plus probable : ${scoreCalcule.buts1} - ${scoreCalcule.buts2}
- Victoire ${team1.name} ${scoreCalcule.probaVictoire1} %, nul ${scoreCalcule.probaNul} %, victoire ${team2.name} ${scoreCalcule.probaVictoire2} %
Ton texte doit être COHÉRENT avec ces chiffres. N'annonce jamais un autre score ni un autre vainqueur, et ne mentionne jamais qu'un calcul a été fait : tu expliques le match, pas la méthode.

TON ANALYSE ET TA DECISION (MODE EXPERT & COACH) :
1. Évalue la différence de niveau réel entre les équipes en t'appuyant sur TA PROPRE CONNAISSANCE.
2. Reprends le score ci-dessus dans predictedScore, et explique en une phrase POURQUOI ce score tient debout au vu des forces en présence.
3. Reprends les probabilités ci-dessus telles quelles (winProb, drawProb, loseProb).
4. GÉNÉRATION DES TEXTES (TRÈS IMPORTANT) : Ton style de rédaction doit être fluide, percutant et facile à lire. Interdiction d'utiliser des phrases banales. 
   - INTERDICTION ABSOLUE : Tu ne dois JAMAIS mentionner "API", "API Football", ou "données fournies". Tu es un expert humain, tu parles en ton nom. Ne dis JAMAIS "absence de données".
   - LANGAGE SIMPLE : N'utilise pas de mots trop compliqués. Fais des phrases claires, courtes et sans fautes de grammaire, compréhensibles par tout fan de foot.
   - EXPLICATION OBLIGATOIRE DES TERMES TECHNIQUES : À chaque fois que tu utilises un terme technique (xG, PPDA, xT, bloc médian, etc.), tu DOIS OBLIGATOIREMENT l'expliquer brièvement entre parenthèses avec des mots très simples pour le grand public.
   - STYLE ATTENDU : des phrases courtes et imagées, chaque terme technique expliqué entre parenthèses juste après, et les joueurs clés notés sur 10. Exemple de tournure, sans aucun nom réel : "Cette équipe a une attaque terrifiante. Son xG (qui mesure la qualité des occasions) montre qu'elle est très dangereuse, portée par un ailier étincelant (Note: 9/10). En face, on va souffrir face à un PPDA très bas (ce qui prouve un pressing très haut)..."
   - Cet exemple illustre une manière d'écrire, jamais un contenu : tous les noms, chiffres et notes que tu produis doivent venir des données de ce match, pas de cet exemple ni de ta mémoire.
   - ÉVALUATION DES EFFECTIFS : Décortique les joueurs titulaires et les remplaçants fournis. Note les joueurs clés sur 10, explique leur rôle exact dans ce match précis, et révèle qui sera le facteur X capable de renverser la rencontre.

RETOURNE UNIQUEMENT UN JSON VALIDE AVEC LA STRUCTURE EXACTE SUIVANTE (aucun markdown) :
{
  "predictedScore": { "team1Goals": 0, "team2Goals": 0, "reasoning": "Phrase courte justifiant le score." },
  "winProb": 0,
  "drawProb": 0,
  "loseProb": 0,
  "confidence": 0,
  "quickSummary": "Un résumé captivant du match et de la tactique attendue.",
  "comparison": {
    "attack": { "team1": 0, "team2": 0 },
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
  "keyStrengths": { "team1": ["Force 1"], "team2": ["Force 1"] },
  "scenarios": [ { "title": "Scénario principal", "content": "..." } ],
  "sections": [
    { "title": "Dynamique & Forme Récente", "icon": "Activity", "content": "Analyse de la forme." },
    { "title": "Bataille Tactique (xG, PPDA, Blocs)", "icon": "Target", "content": "Analyse tactique pro (pressing, blocs, xT) avec explications des abréviations pour le lecteur." },
    { "title": "Effectifs & Évaluation des Joueurs", "icon": "Award", "content": "Analyse des joueurs de l'effectif. Qui est en forme ? Qui est sur le banc ? Évalue et note les joueurs clés." },
    { "title": "Absents & Blessés", "icon": "Shield", "content": "Impact des blessés." },
    { "title": "Historique des Confrontations", "icon": "History", "content": "Analyse du H2H." },
    { "title": "Contexte & Enjeux du Match", "icon": "Trophy", "content": "Importance du match." },
    { "title": "Justification du Score Final", "icon": "Brain", "content": "Pourquoi ce score final, en combinant les joueurs clés et la tactique." }
  ]
}`;

    // Chaque modèle a son propre quota journalier : si le premier est épuisé,
    // le suivant prend le relais. Mieux vaut une analyse rédigée par un modèle
    // plus léger qu'un texte de secours identique pour tous les matchs.
    const result = await avecBasculeDeModele((modele) =>
      genAI
        .getGenerativeModel({ model: modele, generationConfig: { responseMimeType: 'application/json' } })
        .generateContent(prompt, { signal: controller.signal } as any)
    );
    clearTimeout(timeoutId);
    
    let responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    const parsedData = JSON.parse(responseText);

    // Les chiffres affichés sont ceux du calcul, jamais ceux que le modèle a pu
    // réécrire au passage. C'est ce qui garantit qu'on ne reverra pas 82 % de
    // 2-1, et que le texte ne peut pas contredire le score annoncé.
    imposerChiffresCalcules(parsedData);

    // Informations réelles du match (compétition, coup d'envoi, stade, ville).
    // Sans elles, l'en-tête affichait ses valeurs de repli — « Match
    // International » et « Bientôt » — au lieu du contexte réel de la rencontre.
    const fixtureSource = targetFutureMatch || nextH2H;
    if (fixtureSource) {
      const f = fixtureSource.fixture;
      const kickoff = new Date(f.date);
      parsedData.competition = fixtureSource.league?.name || parsedData.competition;
      parsedData.date = kickoff.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      parsedData.time = kickoff.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      parsedData.venue = f.venue?.name || null;
      parsedData.venueCity = f.venue?.city || null;
    }

    // Merge API basic data to keep the interface working
    parsedData.isFinished = false;
    parsedData.globalForm = {
      team1: { recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1, cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1, winStreak: winStreak1 },
      team2: { recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2, cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2, winStreak: winStreak2 }
    };

    console.log(`[BACKEND_ANALYZE] Gemini analysis & prediction completed successfully.`);
    setBounded(analysisCache, cacheKey, { data: parsedData, timestamp: Date.now() });
    
    return respond(parsedData);

  } catch (e: any) {
    console.error("[BACKEND_ANALYZE] Gemini failed:", e.message);

    // ── REPRISE SUR ÉCHEC ────────────────────────────────────────────────────
    //
    // L'abonné ne doit rien voir. Il reçoit une analyse complète et exploitable
    // — le score et les probabilités sont ceux du calcul, exactement comme
    // lorsque le modèle répond. Seuls les textes sont plus sobres.
    //
    // Ce qui change, c'est que l'échec ne disparaît plus dans le silence : il
    // est enregistré pour l'administration. Auparavant, près d'une analyse sur
    // cinq servait un score écrit en dur et une phrase creuse sans que personne
    // ne le sache.
    enregistrerEchecAnalyse({
      userId: guard.user.id,
      equipe1: team1.name,
      equipe2: team2.name,
      competition: (targetFutureMatch || nextH2H)?.league?.name ?? null,
      message: String(e?.message ?? e),
      modele: MODELES_GEMINI[0],
      dureeMs: Date.now() - debutAnalyse,
      serviQuandMeme: true,
    });

    const t1Goals = scoreCalcule.buts1;
    const t2Goals = scoreCalcule.buts2;
    const vainqueur =
      t1Goals > t2Goals ? team1.name : t2Goals > t1Goals ? team2.name : null;

    const fallbackData = imposerChiffresCalcules({
      isFinished: false,
      quickSummary: vainqueur
        ? `Les buts attendus penchent vers ${vainqueur} : ${scoreCalcule.butsAttendus1} contre ${scoreCalcule.butsAttendus2} au vu des attaques et des défenses en présence.`
        : `Les deux équipes affichent des projections très proches — ${scoreCalcule.butsAttendus1} contre ${scoreCalcule.butsAttendus2} buts attendus — ce qui rend le partage des points le scénario le plus probable.`,
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
        // Les buts attendus viennent du calcul : les afficher decales du score
        // arrondi revenait a inventer une metrique qui a l air savante.
        xG: { team1: scoreCalcule.butsAttendus1, team2: scoreCalcule.butsAttendus2 },
        xT: { team1: scoreCalcule.butsAttendus1, team2: scoreCalcule.butsAttendus2 },
        ppda: { team1: 10, team2: 10 }
      },
      keyStrengths: { team1: ["Performance offensive régulière"], team2: ["Solidité défensive"] },
      scenarios: [ { title: "Scénario Tactique", content: `Selon l'historique récent, ${t1Goals > t2Goals ? team1.name : team2.name} s'appuiera sur sa dynamique offensive pour tenter de prendre l'avantage, tandis que l'adversaire cherchera à resserrer les lignes et exploiter les contres.` } ],
      sections: [
        { title: "Dynamique & Forme Récente", icon: "Activity", content: `Les statistiques récentes indiquent que ${team1.name} a enregistré ${baseGoalsFor1} buts marqués, tandis que ${team2.name} totalise ${baseGoalsFor2} buts. Une dynamique qui reflète l'état de forme des deux équipes.` },
        { title: "Bataille Offensive & Défensive", icon: "Target", content: `L'équilibre des forces montre une légère domination attendue de ${t1Goals > t2Goals ? team1.name : team2.name}, avec une projection de possession de ${t1Goals > t2Goals ? baseAvgPossession1 || 55 : baseAvgPossession2 || 55}%. La défense adverse devra se montrer particulièrement vigilante.` },
        { title: "Effectifs & Joueurs Clés", icon: "Award", content: "Les internationaux des deux équipes devront faire preuve de créativité. Les qualités individuelles au milieu de terrain pourraient être le véritable facteur X de la rencontre." },
        { title: "Contexte & Enjeux du Match", icon: "Trophy", content: "Chaque équipe cherchera à imposer son rythme dès le début du match pour asseoir sa domination et prendre une option sur la victoire." }
      ],
      globalForm: {
        team1: { recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1, cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1, winStreak: winStreak1 },
        team2: { recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2, cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2, winStreak: winStreak2 }
      }
    });

    setBounded(analysisCache, cacheKey, { data: fallbackData, timestamp: Date.now() });
    return respond(fallbackData);
  }
}
