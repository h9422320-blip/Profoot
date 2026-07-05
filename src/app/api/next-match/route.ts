import { NextResponse } from 'next/server';
import { clubs } from '@/lib/data';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// Helper for approximate matching (fuzzy search) since AI might return "L'Égypte", "Egypte", "Egypt", etc.
function findBestMatchId(aiResponse: string): string | null {
  const normalized = aiResponse.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  
  if (normalized.length < 3) return null; // Avoid tiny matches

  // 1. Direct key match (e.g. "egypt" -> "egypt")
  for (const key in clubs) {
    if (key.toLowerCase().includes(normalized) || normalized.includes(key.toLowerCase())) return key;
  }

  // 2. Name match (e.g. "Égypte" -> "Egypt")
  for (const key in clubs) {
    const club = clubs[key];
    const internalNames = [
      club.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""),
      club.shortName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
    ];

    if (internalNames.some(name => normalized.includes(name) || name.includes(normalized))) {
      return key;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');

  if (!teamId) {
    return NextResponse.json({ error: 'Missing teamId' }, { status: 400 });
  }

  const team = clubs[teamId];
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  try {
    console.log(`[NEXT_MATCH_AI] Asking Gemini for next opponent of ${team.name}...`);
    
    // We use the exact same technology as the Agent IA
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: "Tu es un expert en football connecté au web. Cherche le prochain adversaire officiel de l'équipe demandée. Réponds UNIQUEMENT avec le nom court de l'équipe adverse en anglais ou français, sans aucun autre mot, ni ponctuation.",
      tools: [{ googleSearch: {} } as any]
    });

    const result = await model.generateContent(`Quel est le prochain adversaire de l'équipe nationale ou du club de football : ${team.name} ?`);
    const aiOpponentName = result.response.text().trim();
    
    console.log(`[NEXT_MATCH_AI] Gemini found: ${aiOpponentName}`);

    // Map the plain text response (e.g., "Egypte") to our internal ID (e.g., "egypt")
    const matchedId = findBestMatchId(aiOpponentName);

    if (matchedId) {
      console.log(`[NEXT_MATCH_AI] Matched ID: ${matchedId}`);
      return NextResponse.json({ nextTeamId: matchedId });
    } else {
      console.warn(`[NEXT_MATCH_AI] No database match for AI response: ${aiOpponentName}`);
      return NextResponse.json({ nextTeamId: null, aiRaw: aiOpponentName });
    }

  } catch (error) {
    console.error('[NEXT_MATCH_AI] Error fetching from Gemini:', error);
    return NextResponse.json({ error: 'Failed to fetch next match via AI' }, { status: 500 });
  }
}
