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
      return new Response(JSON.stringify({ error: 'Clé API manquante' }), { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    // Convert messages array to Gemini history format (all except the last)
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);

    // Stream response in Vercel AI SDK data stream format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  } catch (error: any) {
    console.error('Erreur Chatbot API:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
