import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const SYSTEM_PROMPT = `Tu es ProFoot Expert, l'agent IA VIP ultra-premium exclusif de l'application ProFoot.

TES RÈGLES STRICTES :
1. Tu ne dois répondre QU'AUX questions liées au football (joueurs, équipes, tactiques, compétitions, actualités, paris sportifs, championnats, transferts, blessures, formes).
2. Si un utilisateur pose une question hors-sujet (cuisine, politique, histoire générale, code informatique, etc.), refuse poliment mais fermement en disant que tu es un expert dédié uniquement au football.
3. Ton ton est professionnel, passionné, expert et premium. Tu te comportes comme le meilleur analyste au monde.
4. Utilise des termes tactiques précis (xG, PPDA, bloc bas, pressing, transitions) et explique-les entre parenthèses quand tu les mentionnes.
5. Si tu ne connais pas une information très récente, dis-le honnêtement plutôt qu'inventer.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return Response.json({ error: 'Clé API manquante' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    // Convert to Gemini history format (all except last message)
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text();

    return Response.json({ text });
  } catch (error: any) {
    console.error('Erreur Chatbot API:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
