import Anthropic from '@anthropic-ai/sdk';
import { interrogerAgentVip } from '@/lib/agent-vip';
import { isRateLimited } from '@/lib/rateLimit';
import { requireVip } from '@/lib/subscription';

export const maxDuration = 60;

export async function POST(req: Request) {
  // --- PERMISSIONS : l'Agent IA est réservé aux abonnés Annuels (VIP) ---
  const guard = await requireVip();
  if (!guard.ok) return guard.response;

  // --- BOUCLIER ANTI-SPAM (10 requêtes par minute pour l'agent IA) ---
  // Clé = identifiant du compte (non renouvelable, contrairement à l'IP).
  const compte = guard.user.id;
  if (isRateLimited(compte, 'agent', 10, 60 * 1000)) {
    console.warn(`[ANTI-SPAM] Compte ${compte} bloqué pour abus du chat IA.`);
    return Response.json(
      { error: "Trop de requêtes à l'Agent IA. Veuillez patienter une minute." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[AGENT VIP] ANTHROPIC_API_KEY absente de la configuration.');
    return Response.json(
      { error: "L'Agent IA n'est pas configuré. Contactez le support." },
      { status: 500 }
    );
  }

  try {
    const { messages } = await req.json();
    const resultat = await interrogerAgentVip(Array.isArray(messages) ? messages : []);

    if (resultat.motifArret === 'refusal') {
      return Response.json(
        { error: "L'Agent IA ne peut pas traiter cette demande. Reformulez votre question." },
        { status: 400 }
      );
    }

    if (!resultat.texte) {
      console.warn(`[AGENT VIP] Réponse vide (arrêt : ${resultat.motifArret}).`);
      return Response.json(
        { error: "L'Agent IA n'a pas pu formuler de réponse. Reformulez votre question." },
        { status: 502 }
      );
    }

    // La trace journalise le nombre de recherches web : c'est la seule preuve
    // qu'une réponse s'appuie sur l'actualité et non sur la mémoire du modèle.
    // Une réponse à zéro recherche doit être considérée comme suspecte.
    console.log(
      `[AGENT VIP] ${resultat.dureeMs} ms — ${resultat.recherchesWeb} recherche(s) web — ` +
        `outils : ${resultat.outilsAppeles.join(', ') || 'aucun'} — ` +
        `${resultat.jetonsEntrants} jetons entrants (${resultat.jetonsLusEnCache} lus en cache), ` +
        `${resultat.jetonsSortants} sortants.`
    );
    if (resultat.recherchesWeb === 0) {
      console.warn('[AGENT VIP] ALERTE : réponse produite sans aucune recherche web.');
    }

    return Response.json({ text: resultat.texte });
  } catch (erreur: any) {
    console.error('[AGENT VIP] Erreur :', erreur?.status, erreur?.message);

    if (erreur instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "L'Agent IA est très sollicité en ce moment. Réessayez dans quelques instants." },
        { status: 429 }
      );
    }
    if (erreur instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "L'Agent IA n'est pas correctement configuré. Contactez le support." },
        { status: 500 }
      );
    }
    if (erreur?.message === 'Aucune question reçue.') {
      return Response.json({ error: 'Aucune question reçue.' }, { status: 400 });
    }

    return Response.json(
      { error: "L'Agent IA est momentanément indisponible. Réessayez dans quelques instants." },
      { status: 503 }
    );
  }
}
