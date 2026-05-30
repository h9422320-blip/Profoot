import { NextResponse } from "next/server";

const searchCache = new Map<string, any>();

async function fetchApiFootball(endpoint: string) {
  const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_FOOTBALL_KEY || API_FOOTBALL_KEY === "MA_CLE_API" || API_FOOTBALL_KEY === "") return null;
  const url = `https://v3.football.api-sports.io${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { "x-apisports-key": API_FOOTBALL_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch (e: any) {
    return null;
  }
}

export async function POST(req: Request) {
  let reqPayload: any = {};
  try {
    reqPayload = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, filter } = reqPayload;
  if (!query) return NextResponse.json({ error: "Requête manquante" }, { status: 400 });

  const cacheKey = `${filter || "all"}-${query.toLowerCase().trim()}`;
  if (searchCache.has(cacheKey)) return NextResponse.json(searchCache.get(cacheKey));

  // 1. Search API-Football directly instead of using AI
  let answerMarkdown = `### 📊 Résultats de recherche certifiés pour **"${query}"**\n\n`;
  let foundSomething = false;
  
  // Try to search teams
  const teamSearch = await fetchApiFootball(`/teams?search=${encodeURIComponent(query)}`);
  
  if (teamSearch && teamSearch.response && teamSearch.response.length > 0) {
    foundSomething = true;
    const team = teamSearch.response[0].team;
    const venue = teamSearch.response[0].venue;
    
    answerMarkdown += `**🏢 Détails du Club : ${team.name}**\n`;
    answerMarkdown += `- **Pays :** ${team.country}\n`;
    answerMarkdown += `- **Fondation :** ${team.founded || 'N/A'}\n`;
    answerMarkdown += `- **Stade :** ${venue.name} (${venue.capacity} places, ${venue.city})\n\n`;

    // Fetch recent matches
    const currentSeason = new Date().getMonth() + 1 >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const fixturesRes = await fetchApiFootball(`/fixtures?team=${team.id}&season=${currentSeason}`);
    if (fixturesRes && fixturesRes.response && fixturesRes.response.length > 0) {
      const allMatches = fixturesRes.response.filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
      allMatches.sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
      const recentMatches = allMatches.slice(0, 5);
      
      if (recentMatches.length > 0) {
        answerMarkdown += `**🔥 Derniers Résultats (Certifiés en temps réel) :**\n`;
        recentMatches.forEach((f: any) => {
          const d = new Date(f.fixture.date).toLocaleDateString("fr-FR");
          const gh = f.goals.home ?? '-';
          const ga = f.goals.away ?? '-';
          answerMarkdown += `- *${d}* : ${f.teams.home.name} **${gh} - ${ga}** ${f.teams.away.name} (${f.league.name})\n`;
        });
        answerMarkdown += `\n`;
      }
    }
  } else {
    // Maybe search player
    const playerSearch = await fetchApiFootball(`/players?search=${encodeURIComponent(query)}`);
    if (playerSearch && playerSearch.response && playerSearch.response.length > 0) {
      foundSomething = true;
      const p = playerSearch.response[0].player;
      const stat = playerSearch.response[0].statistics[0];
      answerMarkdown += `**👤 Profil du Joueur : ${p.name}**\n`;
      answerMarkdown += `- **Âge :** ${p.age} ans\n`;
      answerMarkdown += `- **Nationalité :** ${p.nationality}\n`;
      answerMarkdown += `- **Club Actuel :** ${stat?.team?.name || 'Inconnu'}\n`;
      answerMarkdown += `- **Position :** ${stat?.games?.position || 'N/A'}\n\n`;
    }
  }

  if (!foundSomething) {
    answerMarkdown += `*Aucune donnée officielle trouvée dans la base API-Football pour cette requête.* Veuillez vérifier l'orthographe du club ou du joueur.\n`;
  } else {
    answerMarkdown += `\n> *Les données ci-dessus sont extraites directement de notre base certifiée API-Football. Zéro hallucination, 100% de réalité mathématique.*`;
  }

  const resultJson = {
    answer: answerMarkdown,
    sources: [
      { title: "Base de Données API-Football", url: "https://www.api-football.com", domain: "api-football.com", snippet: "Source officielle des données statistiques en temps réel." }
    ],
    relatedQuestions: [
      `Voir les statistiques avancées de ${query}`,
      `Quels sont les prochains matchs de ${query} ?`,
      `Classement actuel impliquant ${query}`
    ],
    timestamp: new Date().toISOString()
  };

  searchCache.set(cacheKey, resultJson);
  return NextResponse.json(resultJson);
}
