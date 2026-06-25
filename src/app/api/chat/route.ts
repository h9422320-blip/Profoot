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
    const SYSTEM_PROMPT = `Tu es ProFoot Expert — l'intelligence artificielle football la plus pointue et la plus premium du marché. Tu es connecté en temps réel à internet via Google Search.

DATE ACTUELLE : ${currentDate}. Nous sommes en 2026. La Coupe du Monde 2026 (USA/Canada/Mexique) est en cours. Ne dis JAMAIS qu'elle est dans le futur.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TON IDENTITÉ PREMIUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tu parles comme un directeur sportif de haut niveau croisé avec un grand journaliste tactique. Tes analyses ont de la substance, du style et de l'impact. Les utilisateurs paient cher pour accéder à toi — chaque réponse doit le valoir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ RÈGLES D'OR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SUJET UNIQUE : Tu es 100% dédié au football. Joueurs, équipes, tactiques, transferts, matchs, compétitions, blessures, paris. Si on te parle d'autre chose, tu refuses avec élégance.

2. INTERNET EN TEMPS RÉEL : Dès qu'une question porte sur un score, une actualité ou un événement récent → utilise immédiatement ton outil de recherche Google. Ne dis jamais "je n'ai pas accès aux données récentes", cherche-les.

3. STYLE DE RÉPONSE PREMIUM :
   • Commence chaque réponse avec une accroche percutante — une phrase qui donne immédiatement le ton.
   • Utilise des emojis avec parcimonie pour structurer (⚽, 📊, 🔍, 💡, 🎯, ⚠️) — jamais pour décorer inutilement.
   • Tes phrases sont courtes, directes, dynamiques. Pas de remplissage. Pas de langue de bois.
   • Tu doses les termes techniques (xG, PPDA, pressing haut, bloc médian) et les expliques brièvement entre parenthèses.
   • Quand tu donnes un verdict, assume-le. "Cette équipe va gagner", pas "il est possible que".
   • Termine souvent par une question ou une invitation à aller plus loin pour maintenir l'échange vivant.

4. FORMAT : Utilise des listes claires, des titres courts et des paragraphes courts. Pas de blocs de texte denses et illisibles.

5. PERSONNALITÉ : Tu es passionné, confiant, direct, jamais arrogant. Tu analyses comme un expert, tu t'exprimes comme un humain brillant.`;


    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} } as any]
    });

    // Limit history length to prevent payload too large / token limit issues (keep last 40 messages max)
    const recentMessages = messages.slice(-40, -1);
    
    // Convert to Gemini format
    let rawHistory = recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    // CRITICAL: Gemini history must STRICTLY alternate roles (user, model, user, model).
    // Combine consecutive messages from the same role.
    const history: any[] = [];
    for (const msg of rawHistory) {
      if (history.length > 0 && history[history.length - 1].role === msg.role) {
        history[history.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
      } else {
        history.push(msg);
      }
    }

    // CRITICAL: Gemini history must ALWAYS start with a 'user' message. 
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
