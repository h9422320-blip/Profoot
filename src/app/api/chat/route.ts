import Anthropic from '@anthropic-ai/sdk';
import { MODELE as MODELE_AGENT, interrogerAgentVip } from '@/lib/agent-vip';
import { enregistrerEchange } from '@/lib/conversations-vip';
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

  // Anthropic n'est plus la seule route possible : l'agent sait aussi passer
  // par OpenRouter, qui donne accès au même modèle Claude. Exiger la clé
  // Anthropic ici bloquerait l'agent alors qu'il a de quoi répondre — c'est
  // exactement ce qui s'est produit la nuit du 20 août 2026, crédit Anthropic
  // épuisé et crédit OpenRouter intact.
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[AGENT VIP] OPENROUTER_API_KEY absente : aucune passerelle disponible.');
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

    // Enregistrement de l'échange. Rien n'était conservé jusqu'ici : chaque
    // conversation disparaissait à la fermeture de l'onglet, et il était donc
    // impossible de savoir ce qu'on demande à l'agent ni comment il répond.
    // L'écriture ne peut pas faire échouer la réponse : elle est encapsulée.
    const derniere = Array.isArray(messages) ? messages[messages.length - 1] : null;
    await enregistrerEchange({
      userId: guard.user.id,
      question: typeof derniere?.content === 'string' ? derniere.content : '',
      reponse: resultat.texte,
      recherchesWeb: resultat.recherchesWeb,
      outilsAppeles: resultat.outilsAppeles,
      modele: MODELE_AGENT,
      dureeMs: resultat.dureeMs,
      jetonsEntrants: resultat.jetonsEntrants,
      jetonsSortants: resultat.jetonsSortants,
      jetonsCache: resultat.jetonsLusEnCache,
      motifArret: resultat.motifArret,
    });

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
