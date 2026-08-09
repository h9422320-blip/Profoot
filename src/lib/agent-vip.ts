/**
 * L'Agent VIP : Claude Opus 5, branché sur les données réelles.
 *
 * La logique vit ici plutôt que dans la route pour rester vérifiable : on peut
 * l'exécuter directement, avec de vraies questions, sans passer par
 * l'authentification et le réseau. Une route qui contient sa propre logique ne
 * se teste qu'en production — c'est trop tard.
 */

import Anthropic from '@anthropic-ai/sdk';
import { OUTILS_FOOTBALL, executerOutil } from './outils-football';

const MODELE = 'claude-opus-5';
const JETONS_MAX = 16000;

// Nombre d'allers-retours d'outils autorisés. L'agent enchaîne souvent
// « chercher l'équipe → sa fiche → ses blessés → ses derniers matchs » : il lui
// faut de la marge. La borne existe pour qu'une boucle imprévue ne consomme pas
// tout le temps de la requête.
const TOURS_MAX = 6;

// Vercel coupe la requête à 60 s.
//
// Mesures successives sur un pronostic (le cas le plus lourd) : budget à 45 s
// → 68 s, tronqué en production ; à 26 s → 60,3 s, encore trop juste ; à 18 s
// → coupure après un seul tour, l'agent n'avait plus rien à dire et renvoyait
// une réponse vide.
//
// Le vrai coût n'est pas la collecte — une douzaine d'outils s'exécutent en
// parallèle en quelques secondes — mais la rédaction finale. On borne donc
// celle-ci (JETONS_SYNTHESE) et on garantit à l'agent au moins deux tours de
// collecte avant de l'interrompre.
const BUDGET_MS = 24_000;
const TOURS_MIN_AVANT_COUPURE = 2;

// Longueur maximale de la synthèse quand le temps presse. Assez large pour une
// analyse complète, assez serrée pour que la rédaction reste sous les 20 s.
const JETONS_SYNTHESE = 4000;

export function construireInstructions(maintenant: Date = new Date()): string {
  const dateDuJour = maintenant.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Tu es ProFoot Expert, l'agent d'analyse football de ProFoot. Les abonnés paient un abonnement annuel pour te consulter.

Date du jour : ${dateDuJour}.

# Ce qui te distingue
Tu n'analyses jamais de mémoire. Tu disposes d'outils branchés en direct sur API-Football (données officielles : entraîneurs, effectifs, blessés, transferts, scores, classements, statistiques) et d'une recherche web pour l'actualité et la presse. Ta mémoire d'entraînement est ancienne et le football change chaque semaine — les outils sont ta seule source fiable sur le présent.

# Aller chercher l'information
Dès qu'une question porte sur un fait actuel — qui entraîne, où joue un joueur, quel est le score, qui est blessé, quel est le classement — appelle l'outil correspondant. Un club se résout d'abord avec chercher_equipe, qui te donne l'identifiant dont les autres outils ont besoin.

Quand plusieurs informations sont nécessaires, demande-les dans le même tour plutôt qu'une par une : c'est plus rapide pour l'abonné.

Pour une analyse de match ou un pronostic, la base de travail est : la forme récente des deux équipes, les absents, les confrontations directes, et le classement. Un pronostic sans ces éléments n'a pas de valeur.

Utilise la recherche web pour ce qu'API-Football ne couvre pas : rumeurs de mercato, déclarations, conférences de presse, contexte de vestiaire, tensions internes, analyses de la presse spécialisée.

# Annoncer tes sources — c'est ce que l'abonné paie
Chaque affirmation doit être rattachée à son niveau de certitude, en une formule naturelle intégrée à la phrase, jamais un préfixe mécanique.

**Fait vérifié** — donnée renvoyée par API-Football. Assume-la pleinement et dis d'où elle vient : « Les données officielles le donnent en poste depuis le 1er juillet 2026 », « Sur ses 8 derniers matchs : 5 victoires, 2 nuls, 1 défaite ». L'abonné doit sentir que le chiffre est réel, pas estimé.

**Information de presse** — issue de la recherche web. Nomme la source et la date : « Selon Marca cette semaine… ». Une information de presse n'est pas un fait officiel, et tu le fais comprendre sans l'écrire lourdement.

**Rumeur** — dis-le franchement : « C'est une rumeur, rien n'est officialisé. » Ne présente jamais une rumeur avec le ton d'un fait. Un transfert n'est officiel que s'il apparaît dans transferts_club.

**Ton analyse** — ta lecture tactique, ta projection, ton pronostic. Assume-la comme un avis d'expert : « Je vois ce match tourner en faveur de… parce que… ». Elle doit s'appuyer sur les chiffres que tu viens de citer, jamais flotter au-dessus.

**Ce que tu ignores** — si un outil ne renvoie rien, dis-le simplement et continue sur ce que tu maîtrises. Reconnaître une limite renforce ta crédibilité ; inventer la détruit. N'affirme jamais un entraîneur, un club ou un effectif qu'un outil ne t'a pas confirmé.

# Expliquer, sans écraser
L'abonné doit repartir en ayant compris, pas seulement en ayant lu une conclusion. Quand tu avances un verdict, montre le raisonnement : le chiffre qui t'a convaincu, le déséquilibre tactique que tu vois, l'absence qui change tout. Explique les termes techniques que tu emploies (xG, bloc médian, PPDA) en quelques mots, sans faire un cours.

Quand plusieurs issues sont crédibles, expose-les et dis laquelle a ta préférence et pourquoi. Un expert tranche ; il n'énumère pas des possibilités pour se couvrir.

# Ton
Direct, sûr de toi, passionné, jamais arrogant. Des phrases courtes. Pas de remplissage, pas de langue de bois, pas de flatterie. Tu parles comme un directeur sportif qui aurait le talent d'un grand journaliste tactique.

Structure tes réponses avec des paragraphes courts et des listes quand elles clarifient. Les emojis servent à structurer, avec parcimonie (⚽ 📊 🔍 💡 ⚠️) — jamais à décorer.

Garde tes réponses au format que la question appelle. Une question simple mérite une réponse directe en quelques phrases, pas un dossier. Une demande d'analyse mérite le développement. Ne rallonge pas pour donner l'impression de valeur : la valeur est dans la justesse des données et la qualité du raisonnement.

# Périmètre
Tu ne traites que le football. Sur tout autre sujet, décline en une phrase et ramène la conversation vers ton domaine.`;
}

/**
 * Convertit l'historique du navigateur au format attendu par l'API.
 *
 * La conversation doit commencer par un message de l'utilisateur et ne
 * contenir aucun message vide, sans quoi la requête est rejetée.
 */
export function preparerHistorique(messages: any[]): Anthropic.MessageParam[] {
  const historique: Anthropic.MessageParam[] = [];

  for (const m of (messages ?? []).slice(-30)) {
    const texte = typeof m?.content === 'string' ? m.content.trim() : '';
    if (!texte) continue;
    const role = m.role === 'user' ? 'user' : 'assistant';
    if (!historique.length && role === 'assistant') continue;
    historique.push({ role, content: texte });
  }

  return historique;
}

export interface ResultatAgent {
  texte: string;
  outilsAppeles: string[];
  jetonsEntrants: number;
  jetonsSortants: number;
  jetonsLusEnCache: number;
  dureeMs: number;
  motifArret: string | null;
}

/**
 * Interroge l'agent et renvoie sa réponse.
 *
 * Lève une erreur en cas d'échec : c'est à l'appelant de décider quoi montrer
 * à l'utilisateur.
 */
export async function interrogerAgentVip(messages: any[]): Promise<ResultatAgent> {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) throw new Error('ANTHROPIC_API_KEY absente de la configuration.');

  const historique = preparerHistorique(messages);
  if (!historique.length) throw new Error('Aucune question reçue.');

  const client = new Anthropic({ apiKey: cle });
  const debut = Date.now();
  const outilsAppeles: string[] = [];

  // Le point de cache est posé sur les instructions : outils et instructions
  // sont identiques d'une requête à l'autre et sont alors facturés au dixième
  // du prix, en plus d'être traités plus vite. Seule la conversation, qui vient
  // après, est relue intégralement.
  const instructions: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: construireInstructions(),
      cache_control: { type: 'ephemeral' },
    },
  ];

  const outils = [
    ...OUTILS_FOOTBALL,
    // Recherche web native : elle couvre la presse, les rumeurs et le contexte
    // éditorial, hors du périmètre d'API-Football.
    //
    // Volontairement la variante simple, et non `web_search_20260209`. Cette
    // dernière filtre ses résultats en exécutant du code dans un conteneur
    // serveur ; or l'agent lance très souvent une recherche web EN MÊME TEMPS
    // qu'un de nos outils. L'exécution de code reste alors en attente pendant
    // qu'on répond à notre outil, et l'API refuse la suite de la conversation :
    // « container_id is required when there are pending tool uses generated by
    // code execution ». L'identifiant en question n'est jamais renvoyé dans ce
    // cas — vérifié sur la réponse brute. La variante simple résout la
    // recherche entièrement côté serveur, sans conteneur, et laisse donc les
    // appels parallèles fonctionner.
    { type: 'web_search_20250305', name: 'web_search', max_uses: 4 },
  ] as Anthropic.ToolUnion[];

  let entrants = 0;
  let sortants = 0;
  let cache = 0;

  const demander = (messages: Anthropic.MessageParam[], sansOutils = false) =>
    client.messages
      .stream({
        model: MODELE,
        max_tokens: sansOutils ? JETONS_SYNTHESE : JETONS_MAX,
        thinking: { type: 'adaptive' },
        // « medium » plutôt que « high » : sur ce modèle, l'écart de qualité est
        // mince pour ce type de tâche alors que l'écart de temps ne l'est pas —
        // et le plafond de 60 s de la plateforme est la vraie contrainte.
        output_config: { effort: 'medium' },
        system: instructions,
        tools: outils,
        messages,
        ...(sansOutils ? { tool_choice: { type: 'none' as const } } : {}),
      })
      .finalMessage();

  /** Cumule la consommation de chaque appel pour la trace de la route. */
  const enregistrer = (m: Anthropic.Message) => {
    entrants += m.usage.input_tokens;
    sortants += m.usage.output_tokens;
    cache += m.usage.cache_read_input_tokens ?? 0;
    return m;
  };

  let reponse = enregistrer(await demander(historique));

  // ── Boucle d'outils ──
  // L'agent demande des données, on les lui fournit, il affine, et ainsi de
  // suite jusqu'à ce qu'il ait de quoi répondre.
  for (let tour = 0; tour < TOURS_MAX; tour++) {
    if (reponse.stop_reason === 'pause_turn') {
      // La recherche web a atteint sa limite d'itérations côté serveur : on
      // relance, le traitement reprend où il s'était arrêté.
      historique.push({ role: 'assistant', content: reponse.content });
      reponse = enregistrer(await demander(historique));
      continue;
    }

    if (reponse.stop_reason !== 'tool_use') break;

    const demandes = reponse.content.filter(
      (bloc): bloc is Anthropic.ToolUseBlock => bloc.type === 'tool_use'
    );
    if (!demandes.length) break;

    // Exécution en parallèle : l'agent demande volontiers la forme des deux
    // équipes et leurs blessés en même temps. Les enchaîner tripleraient
    // l'attente pour l'abonné.
    const resultats = await Promise.all(
      demandes.map(async (d) => {
        outilsAppeles.push(d.name);
        return {
          type: 'tool_result' as const,
          tool_use_id: d.id,
          content: await executerOutil(d.name, d.input as Record<string, any>),
        };
      })
    );

    historique.push({ role: 'assistant', content: reponse.content });
    historique.push({ role: 'user', content: resultats });

    // Budget de temps dépassé : on ferme l'accès aux outils pour que l'agent
    // conclue avec ce qu'il a, plutôt qu'il entame une collecte qu'il n'aura
    // pas le temps de terminer.
    // Le temps écoulé inclut la réflexion du modèle, qui consomme l'essentiel
    // du premier tour : couper là-dessus priverait l'agent de toute donnée.
    const dernierTour =
      (tour + 1 >= TOURS_MIN_AVANT_COUPURE && Date.now() - debut > BUDGET_MS) ||
      tour === TOURS_MAX - 1;

    reponse = enregistrer(await demander(historique, dernierTour));

    if (dernierTour) break;
  }

  const extraireTexte = (m: Anthropic.Message) =>
    m.content
      .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
      .map((bloc) => bloc.text)
      .join('\n')
      .trim();

  let texte = extraireTexte(reponse);

  // Dernier filet : l'agent peut terminer un tour sans avoir rédigé (il voulait
  // encore appeler un outil au moment où on lui a coupé l'accès). L'abonné
  // recevrait alors une réponse vide. On lui redemande une fois de conclure.
  if (!texte && reponse.stop_reason !== 'refusal') {
    console.warn('[AGENT VIP] Aucun texte produit — relance de la synthèse.');
    historique.push({ role: 'assistant', content: reponse.content });
    historique.push({
      role: 'user',
      content:
        "Réponds maintenant à ma question avec les données déjà recueillies. Si certaines te manquent, dis-le simplement et donne-moi ce que tu peux.",
    });
    reponse = enregistrer(await demander(historique, true));
    texte = extraireTexte(reponse);
  }

  return {
    texte,
    outilsAppeles,
    jetonsEntrants: entrants,
    jetonsSortants: sortants,
    jetonsLusEnCache: cache,
    dureeMs: Date.now() - debut,
    motifArret: reponse.stop_reason,
  };
}
