import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// Cache the bracket data for 30 minutes to avoid hammering Gemini
let cachedBrackets: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const COMPETITION_NAMES: Record<string, string> = {
  "wc": "Coupe du Monde FIFA 2026 (USA/Canada/Mexique)",
  "ucl": "Ligue des Champions UEFA 2025-2026",
  "euro": "Euro 2024 (Allemagne)",
  "can": "Coupe d'Afrique des Nations CAN 2025 (Maroc)",
  "copa": "Copa América 2024"
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !COMPETITION_NAMES[id]) {
    return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
  }

  // Check cache first
  const cached = cachedBrackets[id];
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[BRACKET_AI] Serving cached bracket for ${id}`);
    return NextResponse.json(cached.data);
  }

  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'API key missing' }, { status: 500 });
  }

  try {
    console.log(`[BRACKET_AI] Fetching real bracket data for ${COMPETITION_NAMES[id]} via Gemini + Google Search...`);

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Tu es un expert football connecté au web via Google Search. Tu dois rechercher les VRAIS résultats de la phase éliminatoire d'une compétition de football.

CONSIGNES STRICTES :
1. Recherche sur le web les VRAIS matchs qui se sont joués ou qui sont programmés.
2. Réponds UNIQUEMENT en JSON valide. Aucun texte avant ou après le JSON.
3. Si un match n'a pas encore eu lieu, mets les scores à "-" et le statut "NS" (Not Started).
4. Si un match est terminé, mets les vrais scores et le statut "FT" (Full Time).
5. Si le tirage au sort d'un tour n'a pas encore eu lieu, mets "À déterminer" pour les équipes.

FORMAT JSON EXACT (pas de markdown, pas de backticks, juste le JSON brut) :
{
  "r16": [
    {"t1": "Équipe1", "t2": "Équipe2", "s1": "2", "s2": "1", "status": "FT"},
    ...8 matchs total
  ],
  "qf": [
    {"t1": "Équipe1", "t2": "Équipe2", "s1": "-", "s2": "-", "status": "NS"},
    ...4 matchs total
  ],
  "sf": [
    ...2 matchs total
  ],
  "final": {"t1": "Équipe1", "t2": "Équipe2", "s1": "-", "s2": "-", "status": "NS"}
}

IMPORTANT : Chaque tour doit avoir exactement le bon nombre de matchs (r16=8, qf=4, sf=2, final=1). S'il manque des matchs non encore décidés, complète avec "À déterminer" vs "À déterminer".`,
      tools: [{ googleSearch: {} } as any]
    });

    const prompt = `Recherche les vrais résultats de la phase éliminatoire (huitièmes de finale, quarts de finale, demi-finales, finale) de la ${COMPETITION_NAMES[id]}. Donne-moi les vrais matchs avec les vrais scores en JSON.`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    
    console.log(`[BRACKET_AI] Raw Gemini response length: ${rawText.length}`);

    // Extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = rawText;
    // Remove markdown code blocks if present
    if (jsonStr.includes('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }
    // Try to find JSON object boundaries
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    }

    const bracket = JSON.parse(jsonStr);

    // Validate and pad the bracket structure
    const emptyMatch = { t1: "À déterminer", t2: "À déterminer", s1: "-", s2: "-", status: "NS" };
    
    if (!bracket.r16 || !Array.isArray(bracket.r16)) bracket.r16 = [];
    if (!bracket.qf || !Array.isArray(bracket.qf)) bracket.qf = [];
    if (!bracket.sf || !Array.isArray(bracket.sf)) bracket.sf = [];
    if (!bracket.final) bracket.final = emptyMatch;

    while (bracket.r16.length < 8) bracket.r16.push(emptyMatch);
    while (bracket.qf.length < 4) bracket.qf.push(emptyMatch);
    while (bracket.sf.length < 2) bracket.sf.push(emptyMatch);

    // Cache the result
    cachedBrackets[id] = { data: bracket, timestamp: Date.now() };

    console.log(`[BRACKET_AI] Successfully parsed bracket for ${id}: R16=${bracket.r16.length}, QF=${bracket.qf.length}, SF=${bracket.sf.length}`);
    return NextResponse.json(bracket);

  } catch (error) {
    console.error(`[BRACKET_AI] Error:`, error);
    
    // Return empty bracket on error
    const emptyMatch = { t1: "À déterminer", t2: "À déterminer", s1: "-", s2: "-", status: "NS" };
    return NextResponse.json({
      r16: Array(8).fill(emptyMatch),
      qf: Array(4).fill(emptyMatch),
      sf: Array(2).fill(emptyMatch),
      final: emptyMatch,
      _error: "Failed to fetch live data"
    });
  }
}
