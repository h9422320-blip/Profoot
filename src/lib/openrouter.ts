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
  'google/gemini-3.5-flash',
  'google/gemini-3.6-flash',
  'google/gemini-3.5-flash-lite',
  'deepseek/deepseek-v3.2',
  'deepseek/deepseek-v4-flash-0731',
];

/** Modèle le moins cher capable de produire l'aperçu gratuit. */
export const MODELE_ECONOMIQUE = 'google/gemini-3.5-flash-lite';

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
  const reponse = await fetch(OPENROUTER, {
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
    }),
  });

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
