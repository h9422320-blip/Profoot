/**
 * Point d'entrée unique pour demander une analyse au modèle.
 *
 * Deux passerelles possibles vers les MÊMES modèles Gemini :
 *
 *   — OpenRouter, dès qu'une clé est configurée. Mêmes modèles, mêmes tarifs,
 *     mais un moyen de paiement accessible, et deux modèles d'un autre
 *     fournisseur en bout de chaîne comme filets supplémentaires.
 *   — Google en direct, sinon.
 *
 * LE BASCULEMENT EST AUTOMATIQUE ET SANS COUPURE.
 *
 * Tant qu'aucune clé OpenRouter n'existe, l'application continue exactement
 * comme avant. Le jour où la clé est ajoutée, elle change de passerelle au
 * redémarrage suivant, sans modification de code ni interruption. C'est ce qui
 * permet de préparer la migration pendant que le compte se crée.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { avecBasculeDeModele } from './gemini-models';
import {
  MODELES_OPENROUTER,
  MODELE_ECONOMIQUE,
  appelerOpenRouter,
  openRouterDisponible,
} from './openrouter';

export interface ResultatModele {
  /** Le JSON brut renvoyé par le modèle. */
  texte: string;
  /** Le modèle qui a effectivement répondu — les autres ayant pu échouer. */
  modele: string;
  passerelle: 'openrouter' | 'google';
}

/**
 * Demande l'analyse en JSON, en essayant les modèles jusqu'à ce qu'un réponde.
 *
 * @param economique  Vrai pour un aperçu gratuit : on n'engage alors que le
 *                    modèle le moins cher. Le visiteur non abonné ne voit que
 *                    15 % du résultat, le reste étant flouté — payer le modèle
 *                    le plus coûteux pour du contenu masqué n'a pas de sens.
 *                    Le contenu de l'aperçu, lui, est identique.
 */
export async function genererAnalyseJSON(
  prompt: string,
  {
    budgetMs,
    economique = false,
    systeme,
  }: {
    budgetMs: number;
    economique?: boolean;
    /** Consigne système, pour les appelants qui en utilisent une. */
    systeme?: string;
  }
): Promise<ResultatModele> {
  if (openRouterDisponible()) {
    const modeles = economique
      ? [MODELE_ECONOMIQUE, ...MODELES_OPENROUTER.filter((m) => m !== MODELE_ECONOMIQUE)]
      : MODELES_OPENROUTER;

    let retenu = modeles[0];
    const texte = await avecBasculeDeModele(
      (modele, signal) => {
        retenu = modele;
        return appelerOpenRouter(modele, prompt, signal, systeme);
      },
      { budgetMs, modeles }
    );
    return { texte, modele: retenu, passerelle: 'openrouter' };
  }

  // Chemin historique : Google en direct.
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
  let retenu = '';
  const resultat = await avecBasculeDeModele(
    (modele, signal) => {
      retenu = modele;
      return genAI
        .getGenerativeModel({
          model: modele,
          systemInstruction: systeme,
          generationConfig: { responseMimeType: 'application/json' },
        })
        .generateContent(prompt, { signal } as any);
    },
    { budgetMs }
  );

  return { texte: resultat.response.text(), modele: retenu, passerelle: 'google' };
}
