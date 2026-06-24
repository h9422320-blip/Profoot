import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Autorise jusqu'à 60 secondes pour les requêtes de l'agent VIP
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const systemPrompt = `Tu es ProFoot Expert, l'agent IA VIP ultra-premium exclusif de l'application ProFoot. 
    
TES RÈGLES STRICTES :
1. Tu ne dois répondre QU'AUX questions liées au football (joueurs, équipes, tactiques, compétitions, actualités). 
2. Si un utilisateur pose une question hors-sujet (cuisine, politique, histoire générale, code, etc.), refuse poliment mais fermement en rappelant que tu es un expert dédié uniquement au football.
3. Ton ton doit être professionnel, respectueux, expert et premium. Tu tutoies ou vouvoies selon le choix de l'utilisateur, mais garde toujours une posture d'analyste de classe mondiale.
4. N'hésite pas à utiliser des termes tactiques précis (xG, PPDA, bloc bas) si on te pose des questions d'analyse.`;

    const result = streamText({
      model: google('gemini-2.5-flash', { useSearchGrounding: true }),
      system: systemPrompt,
      messages,
      temperature: 0.7,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("Erreur Chatbot API:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
