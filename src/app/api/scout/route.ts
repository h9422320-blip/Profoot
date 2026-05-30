import { NextResponse } from "next/server";

const scoutCache = new Map<string, any>();

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
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query invalide" }, { status: 400 });
    }

    const cacheKey = `scout-${query.toLowerCase().trim()}`;
    if (scoutCache.has(cacheKey)) return NextResponse.json(scoutCache.get(cacheKey));

    // Try to search for a team
    let content = `### 🔍 Rapport de Scouting Officiel pour : **${query}**\n\n`;
    const searchRes = await fetchApiFootball(`/teams?search=${encodeURIComponent(query)}`);
    
    if (searchRes && searchRes.response && searchRes.response.length > 0) {
      const team = searchRes.response[0].team;
      content += `**Club identifié :** ${team.name} (${team.country})\n`;
      content += `**Fondation :** ${team.founded || 'N/A'}\n\n`;

      const fixtures = await fetchApiFootball(`/fixtures?team=${team.id}&next=3`);
      if (fixtures && fixtures.response) {
        content += `#### 🗓️ Prochains Matchs (Calendrier Officiel)\n`;
        fixtures.response.forEach((f: any) => {
          content += `- **${new Date(f.fixture.date).toLocaleDateString("fr-FR")}** : ${f.teams.home.name} vs ${f.teams.away.name} (${f.league.name})\n`;
        });
      }
    } else {
      content += `*Aucun club spécifique trouvé pour cette recherche dans la base de données certifiée. Veuillez réessayer avec un nom exact.*\n`;
    }

    content += `\n> *Rapport généré 100% via API-Football. Zéro invention algorithmique.*`;

    const result = {
      title: `Rapport Scout : ${query}`,
      content: content,
      sources: ["API-Football (Données Certifiées)"]
    };

    scoutCache.set(cacheKey, result);
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({ 
      title: "Erreur Serveur",
      content: "La connexion à l'API de base de données a échoué.",
      sources: ["Erreur Système"]
    });
  }
}
