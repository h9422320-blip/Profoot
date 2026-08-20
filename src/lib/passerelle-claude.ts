/**
 * PAR OÙ PASSE L'AGENT VIP POUR JOINDRE CLAUDE.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Dans la nuit du 20 août 2026, le crédit Anthropic s'est épuisé et la carte ne
 * pouvait pas être rechargée avant le lendemain matin. L'Agent VIP — vendu dans
 * les trois offres — était donc à l'arrêt pour tous les abonnés, alors qu'un
 * crédit OpenRouter dormait à côté.
 *
 * CE QUI REND LA BASCULE POSSIBLE SANS RIEN RÉÉCRIRE
 *
 * OpenRouter expose `/api/v1/messages`, c'est-à-dire le protocole Anthropic
 * lui-même, et non seulement le format OpenAI. Vérifié sur pièce : cette route
 * répond 401 sans clé, quand une route inexistante répond 404. Le SDK Anthropic
 * peut donc parler à OpenRouter en changeant sa seule adresse de base — la
 * boucle d'outils, le cache, les messages, tout reste identique.
 *
 * CE QUI DIFFÈRE QUAND MÊME
 *
 * La recherche web native (`web_search_20250305`) s'exécute sur les serveurs
 * d'Anthropic. Une passerelle tierce ne peut pas la fournir. Chaque passerelle
 * déclare donc si elle en dispose, et l'agent retire l'outil quand elle manque :
 * il perd la presse et les rumeurs, il garde toutes ses données football.
 *
 * L'ORDRE, ET POURQUOI
 *
 * Anthropic en premier tant qu'il a du crédit : c'est la source, sans
 * intermédiaire ni marge. OpenRouter ensuite, sur le MÊME modèle. Gemini en
 * dernier, parce qu'il change la nature de la réponse et doit rester un secours,
 * jamais un choix par défaut.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface Passerelle {
  /** Nom lisible, affiché dans l'administration et les journaux. */
  nom: string;
  /** Identifiant du modèle tel que cette passerelle l'attend. */
  modele: string;
  /** La recherche web native d'Anthropic est-elle disponible ici ? */
  rechercheWeb: boolean;
  /**
   * Les réglages fins d'Anthropic passent-ils ici ?
   *
   * `thinking: {type:'adaptive'}` et `output_config: {effort}` sont propres à la
   * plateforme Anthropic. Une passerelle tierce qui ne les connaît pas répond
   * 400 — et un 400 ne déclenche aucune bascule, puisqu'il signale d'ordinaire
   * une requête mal formée. L'agent échouait donc silencieusement au lieu de
   * basculer. On ne les envoie qu'à qui sait les lire.
   */
  parametresAvances: boolean;
  /** Construit le client prêt à l'emploi. */
  client: () => Anthropic;
}

/** Le modèle de référence de l'Agent VIP, chez Anthropic. */
export const MODELE_ANTHROPIC = 'claude-sonnet-5';

/** Le même modèle, tel qu'OpenRouter le nomme. */
export const MODELE_OPENROUTER = 'anthropic/claude-sonnet-5';

/**
 * Le secours quand plus aucun Claude n'est joignable.
 *
 * Ce n'est pas un équivalent : la réponse aura un autre ton et une autre façon
 * de raisonner. C'est un choix assumé — un abonné qui a payé préfère une
 * réponse imparfaite à un message d'erreur.
 */
export const MODELE_SECOURS = 'google/gemini-3.5-flash';

const URL_OPENROUTER = 'https://openrouter.ai/api/v1';

/**
 * Les passerelles utilisables, dans l'ordre où il faut les essayer.
 *
 * Une passerelle sans clé n'apparaît pas : inutile d'échouer pour découvrir
 * qu'elle n'était pas configurée.
 */
export function passerellesDisponibles(): Passerelle[] {
  const liste: Passerelle[] = [];

  // ── ANTHROPIC EN DIRECT EST DÉSACTIVÉ ────────────────────────────────────
  //
  // Décision du 20 août 2026 : tout passe par OpenRouter, y compris Claude.
  //
  // Le compte Anthropic exigeait sa propre carte et son propre rechargement.
  // La nuit où son solde est tombé à zéro, l'Agent VIP s'est arrêté pour tous
  // les abonnés alors qu'un crédit OpenRouter dormait à côté et donnait accès
  // au MÊME modèle. Deux fournisseurs à surveiller, c'est deux fois plus
  // d'occasions de tomber en panne pour une raison qui n'a rien de technique.
  //
  // Un seul crédit à recharger, un seul solde à surveiller, les mêmes modèles.
  //
  // POUR REVENIR EN ARRIÈRE : régler ANTHROPIC_DIRECT=1 dans Vercel. Le code
  // reste là, entier — il n'y a rien à réécrire, seulement une variable à
  // poser.
  const cleAnthropic = process.env.ANTHROPIC_API_KEY;
  if (cleAnthropic && process.env.ANTHROPIC_DIRECT === '1') {
    liste.push({
      nom: 'Anthropic (direct)',
      modele: MODELE_ANTHROPIC,
      rechercheWeb: true,
      parametresAvances: true,
      client: () => new Anthropic({ apiKey: cleAnthropic }),
    });
  }

  const cleOpenRouter = process.env.OPENROUTER_API_KEY;
  if (cleOpenRouter) {
    // OpenRouter s'authentifie par « Authorization: Bearer », là où le SDK
    // envoie « x-api-key ». On fournit donc l'en-tête nous-mêmes ; `apiKey`
    // reste renseigné parce que le SDK refuse d'être construit sans.
    const construire = (modele: string, nom: string): Passerelle => ({
      nom,
      modele,
      rechercheWeb: false,
      parametresAvances: false,
      client: () =>
        new Anthropic({
          apiKey: cleOpenRouter,
          baseURL: URL_OPENROUTER,
          defaultHeaders: {
            Authorization: `Bearer ${cleOpenRouter}`,
            // Ces deux en-têtes ne sont pas décoratifs : OpenRouter s'en sert
            // pour attribuer la consommation, ce qui rend la facture lisible
            // quand plusieurs applications partagent la même clé.
            //
            // ── ASCII UNIQUEMENT, SANS EXCEPTION ────────────────────────────
            //
            // Ce titre contenait un tiret cadratin (—, code 8212). Un en-tête
            // HTTP ne transporte que des octets : tout caractère au-delà de 255
            // fait échouer la requête AVANT qu'elle parte, avec un TypeError
            // qui ne ressemble en rien à une erreur réseau.
            //
            // Résultat, le 20 août 2026 : l'Agent VIP répondait « le réseau
            // semble instable » à chaque question, sur les DEUX passerelles, en
            // neuf millisecondes — aucun appel n'atteignait jamais OpenRouter.
            // Le crédit était intact, la clé bonne, le modèle correct. Un seul
            // caractère de ponctuation bloquait tout.
            'HTTP-Referer': 'https://profootai.com',
            'X-Title': 'ProFoot AI - Agent VIP',
          },
        }),
    });

    liste.push(construire(MODELE_OPENROUTER, 'OpenRouter (Claude Sonnet 5)'));
    liste.push(construire(MODELE_SECOURS, 'OpenRouter (Gemini, secours)'));
  }

  return liste;
}

/**
 * Cette erreur justifie-t-elle d'essayer la passerelle suivante ?
 *
 * On bascule sur ce qui relève du FOURNISSEUR : plus de crédit, clé refusée,
 * limite de débit, panne, coupure réseau. On ne bascule pas sur une requête
 * mal formée — la suivante la refuserait de la même façon, et l'on aurait juste
 * payé deux fois pour découvrir la même erreur.
 */
export function meriteUneAutrePasserelle(e: any): boolean {
  const code = Number(e?.status ?? e?.statusCode ?? 0);
  const message = String(e?.message ?? e?.error?.message ?? '').toLowerCase();

  // ── LE CRÉDIT ÉPUISÉ SE PRÉSENTE COMME UNE ERREUR DE REQUÊTE ─────────────
  //
  // Anthropic ne répond pas 402 quand le solde est vide : il répond 400
  // `invalid_request_error`, avec « Your credit balance is too low to access
  // the Anthropic API » dans le message. Le code seul est donc trompeur — il
  // dit « votre requête est fautive » là où le vrai sens est « payez ».
  //
  // C'est ce qui a fait échouer la première version de cette cascade dans la
  // nuit du 20 août : le 400 était classé non rattrapable, l'agent renonçait
  // sans jamais essayer OpenRouter, et l'abonné lisait « réseau instable ».
  //
  // On regarde donc le TEXTE avant le code, toujours.
  const parleDArgent =
    message.includes('credit') ||
    message.includes('crédit') ||
    message.includes('balance') ||
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('insufficient') ||
    message.includes('payment') ||
    message.includes('afford');
  if (parleDArgent) return true;

  if (code === 401 || code === 402 || code === 403 || code === 429) return true;
  if (code >= 500) return true;

  // Un modèle inconnu ou un paramètre refusé par CETTE passerelle : la
  // suivante peut très bien l'accepter.
  if (
    message.includes('model') ||
    message.includes('not supported') ||
    message.includes('unsupported') ||
    message.includes('unknown parameter') ||
    message.includes('unexpected')
  )
    return true;

  if (code === 404 || code === 422) return true;
  if (code === 400) return false;

  // Sans code HTTP, c'est une panne de transport : la passerelle n'a pas
  // répondu du tout.
  return (
    !code ||
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('network')
  );
}

/**
 * Le solde OpenRouter, en dollars.
 *
 * Sert à l'alerte de solde bas. Renvoie `null` plutôt qu'une erreur : une
 * lecture de solde ne doit jamais empêcher une page de s'afficher.
 */
export async function soldeOpenRouter(): Promise<{
  restant: number;
  total: number;
  utilise: number;
} | null> {
  const cle = process.env.OPENROUTER_API_KEY;
  if (!cle) return null;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${cle}` },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json();
    const total = Number(j?.data?.total_credits ?? 0);
    const utilise = Number(j?.data?.total_usage ?? 0);
    if (!Number.isFinite(total) || !Number.isFinite(utilise)) return null;
    return { restant: total - utilise, total, utilise };
  } catch {
    return null;
  }
}
