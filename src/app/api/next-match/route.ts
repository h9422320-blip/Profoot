import { NextResponse } from 'next/server';
import { clubs } from '@/lib/data';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

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
    
    const availableTeamsList = Object.entries(clubs).map(([key, c]) => `${key}="${c.name}"`).join(', ');

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Tu es un expert en football connecté au web via Google Search. Recherche le vrai prochain adversaire officiel de l'équipe demandée.
Voici la liste des équipes disponibles dans notre base (Format: ID="Nom") :
[ ${availableTeamsList} ]

Consignes STRICTES :
1. Recherche l'information exacte sur le web.
2. Identifie l'ID correspondant à l'adversaire dans la liste fournie.
3. Réponds UNIQUEMENT avec l'ID exact. Aucun autre mot, aucune phrase.
4. Si l'adversaire n'est pas dans la liste ou si aucun match n'est prévu, réponds EXACTEMENT "null".`,
      tools: [{ googleSearch: {} } as any]
    });

    const result = await model.generateContent(`Quel est l'ID du prochain adversaire de : ${team.name} ?`);
    const aiOpponentId = result.response.text().trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    console.log(`[NEXT_MATCH_AI] Gemini answered ID: ${aiOpponentId}`);

    if (aiOpponentId !== 'null' && clubs[aiOpponentId]) {
      console.log(`[NEXT_MATCH_AI] Valid opponent found: ${clubs[aiOpponentId].name}`);
      return NextResponse.json({ nextTeamId: aiOpponentId });
    } else {
      console.warn(`[NEXT_MATCH_AI] AI returned null or invalid ID: ${aiOpponentId}`);
      return NextResponse.json({ nextTeamId: null, aiRaw: aiOpponentId });
    }

  } catch (error) {
    console.error('[NEXT_MATCH_AI] Error fetching from Gemini:', error);
    return NextResponse.json({ error: 'Failed to fetch next match via AI' }, { status: 500 });
  }
}
