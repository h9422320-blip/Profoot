import { NextResponse } from 'next/server';
import { genererAnalyseJSON } from '@/lib/analyse-modele';
import { openRouterDisponible } from '@/lib/openrouter';

// Appel Gemini : dépasse les 10 s accordées par défaut à une fonction serverless.
export const maxDuration = 60;

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// Cache the bracket data for 30 minutes to avoid hammering Gemini
let cachedBrackets: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const COMPETITION_NAMES: Record<string, string> = {
  "ucl": "Ligue des Champions UEFA 2026-2027",
  "can": "Coupe d'Afrique des Nations CAN 2025 (Maroc)",
};

export async function GET(request: Request) {
  // Lecture publique : cette route ne renvoie que des données de football
  // librement consultables — classements, leaders, matchs joués. Aucun contenu
  // payant, aucune donnée de compte. Elle alimente une page désormais indexée
  // par Google, et exiger un compte y rendait la page vide pour un visiteur.

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

  // Une passerelle suffit : OpenRouter si sa clé existe, Google sinon. Exiger
  // la clé Google aurait coupé cette page le jour où elle sera retirée.
  if (!openRouterDisponible() && !GEMINI_KEY) {
    return NextResponse.json({ error: 'Aucune passerelle IA configurée' }, { status: 500 });
  }

  try {
    console.log(`[BRACKET_AI] Generating automatic background simulation for ${COMPETITION_NAMES[id]}...`);

    const systeme = `Tu es le moteur IA en arrière-plan (Background Engine) de l'application ProFoot.
Le contexte ACTUEL est que nous sommes le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. La Coupe du Monde 2026 est terminée ; le focus est la saison 2026-2027 des championnats et coupes.

CONSIGNES STRICTES ET ABSOLUES :
1. CHRONOLOGIE (TRÈS IMPORTANT) : Base-toi sur le calendrier réel de la compétition demandée par rapport à la date actuelle. Les tours déjà joués à cette date sont TERMINÉS ; les tours à venir N'ONT PAS COMMENCÉ.
2. Pour les tours à venir : mets les équipes qualifiées si elles sont connues, mais LEURS SCORES DOIVENT ÊTRE "-" et le status "NS". Ne simule AUCUN score pour un match non joué.
3. Pour les tours dont les équipes ne sont pas encore connues, utilise des placeholders (ex: "Vainqueur Quart 1") avec des scores à "-".
4. SIMULATION RÉALISTE POUR LE PASSÉ : Invente des scores réalistes et logiques UNIQUEMENT pour les tours déjà joués.
5. TRADUIS OBLIGATOIREMENT TOUS LES NOMS EN FRANÇAIS (ex: "Brésil", "Maroc").
6. Format JSON exact requis :
{
  "r32": [
    {"t1": "Brésil", "t2": "Suisse", "s1": "2", "s2": "0", "status": "FT"},
    ... 16 matchs total avec scores
  ],
  "r16": [
    {"t1": "Brésil", "t2": "Mexique", "s1": "3", "s2": "1", "status": "FT"},
    ... 8 matchs total avec scores
  ],
  "qf": [
    {"t1": "Brésil", "t2": "France", "s1": "-", "s2": "-", "status": "NS"},
    ... 4 matchs total SANS SCORES
  ],
  "sf": [ ... 2 matchs SANS SCORES, t1/t2 = "Vainqueur Quart X" ],
  "third_place": {"t1": "Perdant Demie 1", "t2": "Perdant Demie 2", "s1": "-", "s2": "-", "status": "NS"},
  "final": {"t1": "Vainqueur Demie 1", "t2": "Vainqueur Demie 2", "s1": "-", "s2": "-", "status": "NS"}
}

IMPORTANT : Ne génère AUCUN score de match après les Huitièmes de finale.`;

    const prompt = `Génère l'arbre complet de la ${COMPETITION_NAMES[id]}. N'oublie pas : nous sommes le 5 Juillet 2026, les Quarts de finale n'ont pas encore été joués. Retourne uniquement le JSON.`;

    // Passe par la même chaîne de bascule que l'analyse : un modèle saturé ou
    // à court de quota ne fait plus échouer la page, le suivant prend le
    // relais. Le budget reste sous la limite de la plateforme (60 s).
    const result = await genererAnalyseJSON(prompt, { budgetMs: 45000, systeme });
    const rawText = result.texte.trim();

    console.log(
      `[BRACKET_AI] Réponse de ${result.modele} via ${result.passerelle} — ${rawText.length} caractères.`
    );

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
