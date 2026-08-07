import { GoogleGenerativeAI } from '@google/generative-ai';
import { isRateLimited, clientIp } from "@/lib/rateLimit";
import { requireVip } from "@/lib/subscription";

export const maxDuration = 60;

export async function POST(req: Request) {
  // --- PERMISSIONS : l'Agent IA est réservé aux abonnés Annuels (VIP) ---
  const guard = await requireVip();
  if (!guard.ok) return guard.response;

  // --- BOUCLIER ANTI-SPAM (10 requêtes par minute pour l'agent IA) ---
  // Clé = identifiant du compte (non renouvelable, contrairement à l'IP).
  const ip = guard.user.id;
  if (isRateLimited(ip, 'agent', 10, 60 * 1000)) {
    console.warn(`[ANTI-SPAM] Compte ${ip} bloqué pour abus du chat IA.`);
    return Response.json({ error: "Trop de requêtes à l'Agent IA. Veuillez patienter une minute." }, { status: 429 });
  }
  // -------------------------------------------------------------------

  try {
    const { messages } = await req.json();
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return Response.json({ error: 'Clé API manquante' }, { status: 500 });
    }

    const currentDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    // Le prompt doit décrire les capacités RÉELLEMENT disponibles : demander à
    // l'IA d'utiliser un outil de recherche qu'on ne lui fournit pas la fait
    // échouer sur un appel de fonction invalide et renvoyer un texte vide.
    const buildSystemPrompt = (withSearch: boolean) => `Tu es ProFoot Expert — l'intelligence artificielle football la plus pointue et la plus premium du marché.${withSearch ? ' Tu es connecté en temps réel à internet via Google Search.' : ''}

DATE ACTUELLE : ${currentDate}. Nous sommes en 2026. La Coupe du Monde 2026 est terminée (finale jouée le 19 juillet 2026) — n'en parle que si on te pose la question. Le focus actuel : la préparation et le début de la saison 2026-2027 des grands championnats (Premier League, Liga, Serie A, Bundesliga, Ligue 1, coupes d'Europe).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TON IDENTITÉ PREMIUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tu parles comme un directeur sportif de haut niveau croisé avec un grand journaliste tactique. Tes analyses ont de la substance, du style et de l'impact. Les utilisateurs paient cher pour accéder à toi — chaque réponse doit le valoir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ RÈGLES D'OR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SUJET UNIQUE : Tu es 100% dédié au football. Joueurs, équipes, tactiques, transferts, matchs, compétitions, blessures, paris. Si on te parle d'autre chose, tu refuses avec élégance.

2. ${withSearch
  ? `INTERNET EN TEMPS RÉEL : Dès qu'une question porte sur un score, une actualité ou un événement récent → utilise immédiatement ton outil de recherche Google. Ne dis jamais "je n'ai pas accès aux données récentes", cherche-les.`
  : `CONNAISSANCES PROPRES : Tu n'as PAS d'outil de recherche disponible dans cet échange — n'essaie jamais d'en appeler un. Réponds à partir de ta vaste connaissance du football. Sur un résultat de tout dernière minute, dis simplement que le score en direct est à confirmer, puis apporte quand même ton analyse.`}

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

    // La recherche Google en temps réel dispose d'un quota distinct, bien plus
    // restreint, du modèle lui-même. Quand il est épuisé, on répond quand même
    // — sans temps réel plutôt que pas du tout : l'Agent VIP est un produit
    // payant, il ne doit jamais rester muet.
    const buildModel = (withSearch: boolean) =>
      genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        systemInstruction: buildSystemPrompt(withSearch),
        ...(withSearch ? { tools: [{ googleSearch: {} } as any] } : {}),
      });
    let model = buildModel(true);

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
    let text = '';
    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      text = result.response.text();
    } catch (searchError: any) {
      const quotaExceeded =
        searchError?.message?.includes('429') ||
        searchError?.message?.includes('quota') ||
        searchError?.message?.includes('RESOURCE_EXHAUSTED');
      if (!quotaExceeded) throw searchError;
      console.warn('[AGENT VIP] Quota de recherche Google épuisé — bascule sans temps réel.');
    }

    // Une réponse vide compte aussi comme un échec : le modèle peut terminer
    // sans erreur mais sans texte (appel d'outil invalide, filtre déclenché).
    if (!text.trim()) {
      model = buildModel(false);
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      text = result.response.text();
    }

    if (!text.trim()) {
      return Response.json(
        { error: "L'Agent IA n'a pas pu formuler de réponse. Reformulez votre question." },
        { status: 502 }
      );
    }

    return Response.json({ text });
  } catch (error: any) {
    console.error('Erreur Chatbot API:', error);
    // Message lisible pour l'utilisateur, détails techniques dans les logs.
    return Response.json(
      { error: "L'Agent IA est momentanément indisponible. Réessayez dans quelques instants." },
      { status: 503 }
    );
  }
}
