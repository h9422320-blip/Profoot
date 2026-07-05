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
    console.log(`[BRACKET_AI] Generating automatic background simulation for ${COMPETITION_NAMES[id]} via Gemini...`);

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Tu es le moteur IA en arrière-plan (Background Engine) de l'application ProFoot. Ton rôle est de GÉNÉRER AUTOMATIQUEMENT et SIMULER l'intégralité d'un tournoi s'il n'est pas encore terminé, ou de donner les vrais résultats s'il est fini.

CONSIGNES STRICTES :
1. SIMULATION INTELLIGENTE : Si la compétition (ex: Coupe du Monde 2026) n'a pas encore eu lieu ou n'est pas finie, invente/simule des résultats RÉALISTES pour tout le tournoi jusqu'à la finale. Ne laisse JAMAIS de cases vides.
2. COUPE DU MONDE 2026 (48 ÉQUIPES) : Le format comporte des Seizièmes de finale (r32) -> Huitièmes (r16) -> Quarts (qf) -> Demies (sf) -> Match 3ème place -> Finale.
3. LOGIQUE D'ÉLIMINATION : L'équipe gagnante d'un match (celle qui a le score le plus élevé) doit OBLIGATOIREMENT être l'une des deux équipes du tour suivant qui y correspond. (Ex: Le gagnant du Match 1 r32 et du Match 2 r32 s'affrontent dans le Match 1 r16).
4. TRADUIS OBLIGATOIREMENT TOUS LES NOMS EN FRANÇAIS (ex: "Brésil", "Maroc").
5. Format JSON exact requis :
{
  "r32": [
    {"t1": "Brésil", "t2": "Suisse", "s1": "2", "s2": "0", "status": "FT"},
    ... 16 matchs total
  ],
  "r16": [
    {"t1": "Brésil", "t2": "Mexique", "s1": "3", "s2": "1", "status": "FT"},
    ... 8 matchs total
  ],
  "qf": [ ... 4 matchs total ],
  "sf": [ ... 2 matchs total ],
  "third_place": {"t1": "...", "t2": "...", "s1": "...", "s2": "...", "status": "FT"},
  "final": {"t1": "...", "t2": "...", "s1": "...", "s2": "...", "status": "FT"}
}

IMPORTANT : Chaque tour doit avoir exactement le bon nombre de matchs (r32=16, r16=8, qf=4, sf=2).`
    });

    const prompt = `Génère l'arbre complet et simulé de la ${COMPETITION_NAMES[id]}. Remplis tout avec des scores logiques et réalistes. Retourne uniquement le JSON.`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    
    console.log(`[BRACKET_AI] Raw Gemini response length: ${rawText.length}`);

    let jsonStr = rawText;
    if (jsonStr.includes('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    }

    const bracket = JSON.parse(jsonStr);

    const emptyMatch = { t1: "À déterminer", t2: "À déterminer", s1: "-", s2: "-", status: "NS" };
    
    if (!bracket.r32 || !Array.isArray(bracket.r32)) bracket.r32 = [];
    if (!bracket.r16 || !Array.isArray(bracket.r16)) bracket.r16 = [];
    if (!bracket.qf || !Array.isArray(bracket.qf)) bracket.qf = [];
    if (!bracket.sf || !Array.isArray(bracket.sf)) bracket.sf = [];
    if (!bracket.third_place) bracket.third_place = emptyMatch;
    if (!bracket.final) bracket.final = emptyMatch;

    while (bracket.r32.length < 16) bracket.r32.push(emptyMatch);
    while (bracket.r16.length < 8) bracket.r16.push(emptyMatch);
    while (bracket.qf.length < 4) bracket.qf.push(emptyMatch);
    while (bracket.sf.length < 2) bracket.sf.push(emptyMatch);

    cachedBrackets[id] = { data: bracket, timestamp: Date.now() };

    return NextResponse.json(bracket);
  } catch (error) {
    console.error(`[BRACKET_AI] Error:`, error);
    return NextResponse.json({ error: 'Failed to generate bracket' }, { status: 500 });
  }
}
