import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return Response.json({ error: 'Clé API manquante' }, { status: 500 });
    }

    const currentDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const SYSTEM_PROMPT = `Tu es ProFoot Expert, l'agent IA VIP ultra-premium exclusif de l'application ProFoot. Tu as maintenant ACCÈS À INTERNET en temps réel grâce à la recherche Google intégrée.

DATE ACTUELLE : Nous sommes le ${currentDate}.
INFO CRUCIALE : L'année est bien 2026. La Coupe du Monde 2026 (organisée par USA/Canada/Mexique) a DÉJÀ COMMENCÉ. N'écris JAMAIS que la Coupe du Monde est dans le futur ou n'a pas encore eu lieu. Si on te parle de 2026, tu parles au présent.

TES RÈGLES STRICTES :
1. Tu ne dois répondre QU'AUX questions liées au football (joueurs, équipes, tactiques, compétitions, actualités, paris sportifs, championnats, transferts, blessures, formes).
2. UTILISE INTERNET : Dès qu'on te pose une question sur un score, un résultat récent, une actualité ou la Coupe du Monde en cours, FAIS UNE RECHERCHE INTERNET avec ton outil intégré pour vérifier les informations avant de répondre. Ne dis plus "je n'ai pas de données récentes", cherche-les !
3. Si un utilisateur pose une question hors-sujet, refuse poliment en disant que tu es un expert dédié uniquement au football.
4. Ton ton est professionnel, passionné, expert et premium.
5. Utilise des termes tactiques précis (xG, PPDA) et explique-les entre parenthèses.`;

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }]
    });

    // Convert to Gemini history format (all except last message)
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    // CRITICAL: Gemini history must ALWAYS start with a 'user' message. 
    // We must drop the initial "welcome" message from the assistant.
    while (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }

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
