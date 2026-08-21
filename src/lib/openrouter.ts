/**
 * Passerelle OpenRouter.
 *
 * POURQUOI
 *
 * Google Cloud refuse les cartes bancaires locales, ce qui bloquait l'accès à
 * la formule payante de Gemini — et donc bridait l'application à une vingtaine
 * d'analyses par modèle et par jour. OpenRouter donne accès AUX MÊMES MODÈLES
 * Gemini, aux mêmes tarifs affichés, et accepte d'autres moyens de paiement.
 *
 * CE QUI NE CHANGE PAS
 *
 * Les modèles sont identiques : `google/gemini-3.5-flash` chez OpenRouter est
 * le modèle de Google, pas une imitation. Les prix relevés sur leur catalogue
 * sont au centime près ceux de Google en direct. La qualité d'analyse est donc
 * inchangée.
 *
 * CE QUE ÇA APPORTE EN PLUS
 *
 * Un seul compte donne accès à des modèles d'autres fournisseurs. On en place
 * deux en bout de chaîne : si les trois Gemini sont saturés en même temps —
 * ce qui s'est produit — l'analyse aboutit quand même.
 */

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Ordre d'appel.
 *
 * Les Gemini d'abord : ce sont eux qui produisent les analyses depuis le
 * début, et le prompt a été écrit pour eux. DeepSeek ferme la marche à titre
 * de filet — dix fois moins cher, mais un texte dont le style n'a pas été
 * réglé pour ProFoot ; on préfère l'utiliser rarement plutôt que d'échouer.
 */
export const MODELES_OPENROUTER = [
  'openai/gpt-oss-120b',
  'deepseek/deepseek-v4-flash',
  'qwen/qwen3.7-flash',
  'google/gemini-3.5-flash-lite',
  'google/gemini-3.5-flash',
];

/** Modèle le moins cher capable de produire l'aperçu gratuit. */
export const MODELE_ECONOMIQUE = 'openai/gpt-oss-120b';

/**
 * ── L'ORDRE VIENT D'UNE MESURE, PAS DU SEUL TARIF ─────────────────────────
 *
 * Chaque candidat a reçu trois vraies demandes d'analyse — Barcelone-Real,
 * Deportivo-Elche, Newcastle-Bournemouth — et sa réponse a été contrôlée
 * comme l'application le fait : JSON lisible, champs présents, probabilités
 * totalisant cent, et score cohérent avec l'issue la plus probable.
 * (Route `/api/diagnostic/modeles`, rejouable à tout moment.)
 *
 *     gpt-oss-120b            3/3   0,17 $   7 700 ms   <- retenu, premier
 *     gemini-3.5-flash-lite   3/3   2,50 $     619 ms   <- le plus rapide
 *     deepseek-v4-flash       2/3   0,17 $   8 300 ms   un dépassement de délai
 *     qwen3.7-flash           1/3   0,13 $   3 200 ms   deux refus du fournisseur
 *     gemini-3.5-flash        2/3   9,00 $   5 800 ms   s'est contredit
 *
 * QWEN ÉTAIT PREMIER, ET C'ÉTAIT UNE ERREUR. Le moins cher sur le papier
 * renvoyait « 429 Provider returned error » deux fois sur trois : un échec ne
 * coûte rien en jetons, mais il coûte l'attente de l'abonné avant de basculer.
 * Il reste dans la liste, en troisième, comme filet bon marché.
 *
 * GEMINI-3.5-FLASH, LUI, S'EST CONTREDIT : sur Deportivo-Elche il a annoncé
 * 1-1 en donnant la victoire au domicile comme issue la plus probable. C'est
 * exactement la faute qui discrédite une carte aux yeux d'un visiteur. Neuf
 * dollars le million de jetons pour ça — il ferme la marche.
 */

/**
 * PRIX RELEVÉS LE 20 AOÛT 2026, PAR MILLION DE JETONS SORTANTS.
 *
 * C'est la SORTIE qui coûte : une analyse lit peu et écrit beaucoup.
 *
 *     qwen3.7-flash            0,13 $     <- premier appelé
 *     deepseek-v4-flash        0,17 $
 *     gpt-oss-120b             0,17 $
 *     gemini-3.5-flash-lite    2,50 $
 *     gemini-3.5-flash         9,00 $     <- ce qui était appelé en premier
 *
 * Sur sept jours, 13,07 $ des 15,02 $ facturés sont partis dans le seul
 * gemini-3.5-flash — 87 % de la facture pour le modèle le plus cher de la
 * liste, appelé systématiquement en premier alors que quatre modèles capables
 * attendaient derrière lui.
 *
 * CE QUE CE CHANGEMENT COÛTE VRAIMENT
 *
 * Rien sur la fiabilité : la cascade est inchangée, si le premier échoue le
 * suivant prend le relais, et Gemini reste au bout de la chaîne.
 *
 * En revanche le STYLE change. Le prompt a été écrit et affiné pour les
 * Gemini ; un autre modèle rendra un texte correct mais tourné autrement. La
 * structure JSON, elle, est imposée par le prompt et vérifiée à la lecture —
 * une réponse mal formée fait passer au modèle suivant, elle n'atteint jamais
 * l'abonné.
 */

/**
 * Longueur maximale d'une réponse, en jetons.
 *
 * POURQUOI CE NOMBRE DOIT ÊTRE ÉCRIT NOIR SUR BLANC
 *
 * Sans ce champ, OpenRouter retient le maximum du modèle — 65 536 jetons — et
 * exige que le solde du compte puisse couvrir ce maximum. Peu importe que la
 * réponse n'en consomme réellement que deux mille : c'est la RÉSERVATION qui
 * est refusée.
 *
 * Le 19 août 2026, l'application entière s'est arrêtée là-dessus : « vous
 * demandez 65 536 jetons, vous ne pouvez en payer que 51 819 ». Cent cinquante
 * analyses perdues en trois heures, sur le Real Madrid comme sur un club de
 * quatrième division allemande, et l'abonné ne lisait qu'« erreur de connexion
 * au modèle d'intelligence artificielle ».
 *
 * COMMENT LA VALEUR EST CHOISIE
 *
 * Une analyse complète rendue en JSON — scénarios, probabilités, comparaisons,
 * forces et faiblesses — pèse deux à trois mille jetons. Huit mille laissent
 * donc trois fois la marge nécessaire, tout en divisant la réservation par
 * huit. Une réponse tronquée serait pire qu'une réponse absente : elle
 * produirait un JSON illisible.
 */
/**
 * ── MESURÉ, PAS SUPPOSÉ ───────────────────────────────────────────────────
 *
 * Sur 119 analyses complètes réellement produites et conservées en base :
 *
 *     la plus courte ....  1 460 caractères  ~  365 jetons
 *     la médiane .......   2 094 caractères  ~  524 jetons
 *     la plus longue ...   5 288 caractères  ~ 1 322 jetons
 *
 * On réservait 8 000 jetons — quinze fois ce qui est réellement écrit.
 *
 * Cette réservation n'est pas gratuite : OpenRouter bloque le crédit
 * correspondant AVANT d'envoyer la requête, et refuse dès que le solde ne le
 * couvre plus. C'est ce qui a produit les « can only afford N » du 19 août,
 * cent cinquante analyses perdues en trois heures.
 *
 * ── CETTE MESURE ÉTAIT FAUSSE, ET ELLE A COÛTÉ CHER ──────────────────────
 *
 * Le 21 août à 12 h 30, cette valeur a été ramenée à 2 500 sur la foi des
 * chiffres ci-dessus. Trois heures plus tard, un abonné PRO ELITE recevait un
 * « Scénario #1 » réduit à un mot : « Beti ». Le modèle était coupé en pleine
 * phrase, et tous ceux qui avaient payé ce jour-là ont reçu cela.
 *
 * L'erreur de méthode : les tailles mesurées venaient d'`analysis_data`, la
 * version CONSERVÉE de l'analyse — réduite, allégée, débarrassée de ce qui ne
 * sert plus après coup. La réponse BRUTE du modèle est bien plus volumineuse :
 * elle contient sept sections détaillées, trois scénarios complets, les
 * comparaisons et les métriques, dont l'essentiel est consommé puis jeté.
 *
 * Mesurer la sortie d'un tuyau pour en déduire ce qui entre dedans ne pouvait
 * pas marcher.
 *
 * On revient donc à 8 000, la valeur qui n'a jamais tronqué personne. Le
 * gaspillage de crédit qu'elle représente est réel, mais il est mille fois
 * préférable à une analyse coupée servie à quelqu'un qui vient de payer.
 *
 * Toute réduction future devra être mesurée sur la réponse BRUTE du modèle —
 * `result.texte` avant décodage — et sur plusieurs centaines de cas.
 */
export const JETONS_REPONSE = 8000;

/**
 * Lit le nombre de jetons réellement finançables dans un refus de paiement.
 *
 * OpenRouter le dit en toutes lettres : « you can only afford 51819 ». Plutôt
 * que d'abandonner, on relance immédiatement en dessous de ce plafond. Le solde
 * peut ainsi descendre très bas sans que l'abonné voie jamais une erreur.
 */
function jetonsFinancables(detail: string): number | null {
  const m = detail.match(/afford\s+(\d+)/i);
  if (!m) return null;
  const finançables = Number(m[1]);
  if (!Number.isFinite(finançables) || finançables < 600) return null;
  // Une marge de sécurité : le solde bouge entre le refus et la relance.
  return Math.max(600, Math.floor(finançables * 0.8));
}

export const openRouterDisponible = () => !!process.env.OPENROUTER_API_KEY;

/**
 * Erreur portant le code HTTP, pour que `modeleIndisponible()` reconnaisse un
 * 429 ou un 503 sans avoir à lire le texte du message.
 */
class ErreurModele extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ErreurModele';
  }
}

/**
 * Demande une réponse JSON à un modèle, via OpenRouter.
 *
 * `response_format: json_object` est accepté par les cinq modèles retenus —
 * vérifié sur leur catalogue, champ `supported_parameters`. Sans lui, le
 * modèle enroberait le JSON de texte et l'analyse échouerait au décodage.
 */
export async function appelerOpenRouter(
  modele: string,
  prompt: string,
  signal: AbortSignal,
  /** Consigne système, quand l'appelant en fournit une. */
  systeme?: string
): Promise<string> {
  const envoyer = (jetons: number) =>
    fetch(OPENROUTER, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        // Renseignés dans le classement public d'OpenRouter, et utiles pour
        // retrouver la consommation de l'application dans leur tableau de bord.
        'HTTP-Referer': 'https://profootai.com',
        'X-Title': 'ProFoot AI',
      },
      body: JSON.stringify({
        model: modele,
        messages: systeme
          ? [
              { role: 'system', content: systeme },
              { role: 'user', content: prompt },
            ]
          : [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        // Voir `JETONS_REPONSE` : sans ce champ, OpenRouter réserve le maximum
        // du modèle et refuse la requête dès que le solde ne le couvre plus.
        max_tokens: jetons,
      }),
    });

  let reponse = await envoyer(JETONS_REPONSE);

  // ── UN SOLDE JUSTE NE DOIT PAS ARRÊTER L'APPLICATION ──────────────────────
  //
  // Quand le crédit ne couvre plus la réservation demandée, OpenRouter répond
  // 402 en indiquant combien il peut financer. On relance aussitôt sous ce
  // plafond plutôt que d'abandonner : l'abonné obtient son analyse, et le
  // fondateur découvre le problème dans ses journaux, pas par un client fâché.
  if (reponse.status === 402) {
    const detail = await reponse.clone().text().catch(() => '');
    const repli = jetonsFinancables(detail);
    if (repli && repli < JETONS_REPONSE) {
      console.warn(
        `[OpenRouter] Crédit juste sur ${modele} : réservation ramenée de ${JETONS_REPONSE} à ${repli} jetons. ` +
          `Le solde du compte OpenRouter mérite d'être rechargé.`
      );
      reponse = await envoyer(repli);
    }
  }

  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => '');
    throw new ErreurModele(
      reponse.status,
      `[OpenRouter ${reponse.status}] ${modele} — ${detail.slice(0, 200)}`
    );
  }

  const data = await reponse.json();

  // OpenRouter renvoie 200 avec une erreur dans le corps quand le fournisseur
  // en amont a flanché. Sans ce contrôle, l'échec passerait pour une réponse
  // vide et aucune bascule ne serait déclenchée.
  if (data?.error) {
    throw new ErreurModele(
      Number(data.error.code) || 502,
      `[OpenRouter] ${modele} — ${data.error.message ?? 'erreur du fournisseur'}`
    );
  }

  const texte = data?.choices?.[0]?.message?.content;
  if (!texte) throw new ErreurModele(502, `[OpenRouter] ${modele} — réponse vide`);

  return texte;
}
