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
      systemInstruction: `Tu es un expert football connecté au web via Google Search et un analyste IA de pointe. Ton rôle est de fournir l'arbre d'un tournoi (huitièmes, quarts, demies, finale).

CONSIGNES STRICTES :
1. Recherche sur le web l'état actuel de la compétition.
2. Si un match n'a pas encore eu lieu ou si l'adversaire n'est pas encore connu, TU DOIS PRÉDIRE le vainqueur et le score exact en te basant sur des statistiques réelles. Ne mets JAMAIS "À déterminer" ni "Vainqueur X/Y". Choisis toujours une équipe précise.
3. TRADUIS OBLIGATOIREMENT TOUS LES NOMS D'ÉQUIPES EN FRANÇAIS (ex: "Brésil", "Maroc", "États-Unis", "Pays-Bas", "Angleterre"). C'est CRITIQUE pour que les logos s'affichent correctement.
4. Réponds UNIQUEMENT en JSON valide.
5. Format JSON exact requis :
{
  "r16": [
    {"t1": "France", "t2": "Sénégal", "s1": "2", "s2": "1", "status": "FT"},
    ... 8 matchs total
  ],
  "qf": [
    {"t1": "France", "t2": "Brésil", "s1": "1", "s2": "0", "status": "NS"},
    ... 4 matchs total
  ],
  "sf": [
    ... 2 matchs total
  ],
  "final": {"t1": "Équipe1", "t2": "Équipe2", "s1": "3", "s2": "2", "status": "NS"}
}

IMPORTANT : Chaque tour doit avoir exactement le bon nombre de matchs (r16=8, qf=4, sf=2, final=1) avec des VRAIES équipes en FRANÇAIS, et des vrais scores ou des scores PRÉDITS. Ne laisse aucun trou.`,
      tools: [{ googleSearch: {} } as any]
    });

    const prompt = `Génère l'arbre complet de la phase éliminatoire de la ${COMPETITION_NAMES[id]}. Traduis tous les noms en français. Remplis TOUS les matchs (même les quarts, demies et finale) avec de vraies équipes et de vrais scores (ou des prédictions si le match n'a pas encore eu lieu). Retourne uniquement le JSON.`;

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
