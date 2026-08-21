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
/**
 * La réponse est-elle du JSON exploitable ?
 *
 * Lève une erreur reconnue par la cascade comme un défaut DU MODÈLE — au même
 * titre qu'un délai dépassé ou un refus — pour que le suivant prenne le relais.
 *
 * On extrait d'abord le premier objet accolade-à-accolade, exactement comme le
 * fait l'appelant : le contrôle doit porter sur ce qui sera réellement décodé,
 * pas sur une version plus permissive qui laisserait passer ce qui cassera
 * ensuite.
 */
function verifierJson(brut: string, modele: string): void {
  const texte = String(brut ?? '');
  const bloc = texte.match(/\{[\s\S]*\}/)?.[0] ?? texte;

  try {
    JSON.parse(bloc);
  } catch (e: any) {
    const position = String(e?.message ?? '').match(/position (\d+)/)?.[1];
    const erreur: any = new Error(
      `${modele} a rendu un JSON illisible` +
        (position ? ` (coupé à la position ${position} sur ${bloc.length})` : '') +
        ` — ${String(e?.message ?? e).slice(0, 100)}`
    );
    // Marqué comme un défaut de modèle : c'est ce qui autorise la bascule.
    erreur.jsonInvalide = true;
    erreur.status = 502;
    throw erreur;
  }
}

export async function genererAnalyseJSON(
  prompt: string,
  {
    budgetMs,
    economique = false,
    systeme,
    surEchec,
  }: {
    budgetMs: number;
    economique?: boolean;
    /** Consigne système, pour les appelants qui en utilisent une. */
    systeme?: string;
    /**
     * Appelé pour CHAQUE modèle qui échoue, avant de passer au suivant.
     *
     * Sans lui, seule l'erreur du dernier modèle remontait, et l'on
     * diagnostiquait la cascade par son maillon final — celui qui a le moins
     * de chances d'expliquer quoi que ce soit.
     */
    surEchec?: (modele: string, erreur: any, dureeMs: number, expire: boolean) => void;
  }
): Promise<ResultatModele> {
  if (openRouterDisponible()) {
    const modeles = economique
      ? [MODELE_ECONOMIQUE, ...MODELES_OPENROUTER.filter((m) => m !== MODELE_ECONOMIQUE)]
      : MODELES_OPENROUTER;

    let retenu = modeles[0];
    const texte = await avecBasculeDeModele(
      async (modele, signal) => {
        retenu = modele;
        const brut = await appelerOpenRouter(modele, prompt, signal, systeme);

        // ── UNE RÉPONSE ILLISIBLE EST UN ÉCHEC DE CE MODÈLE ────────────────
        //
        // Le décodage se faisait chez l'appelant, APRÈS la cascade. Un modèle
        // qui rendait du JSON invalide faisait donc échouer toute l'analyse,
        // alors que quatre modèles attendaient encore derrière lui.
        //
        // Mesuré sur vingt-quatre heures : 36 % des échecs venaient de là, et
        // ce n'était pas une troncature — durée médiane avant l'erreur,
        // 1 625 ms ; certains cassaient dès le 439ᵉ millisecond, à la position
        // deux. Le modèle n'a pas manqué de temps : il a rendu du charabia,
        // et personne n'a redemandé à un autre.
        //
        // Contrôler ici coûte un décodage supplémentaire — quelques
        // millisecondes — et rend le JSON illisible rattrapable comme
        // n'importe quelle autre panne.
        verifierJson(brut, modele);
        return brut;
      },
      { budgetMs, modeles, surEchec }
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
    { budgetMs, surEchec }
  );

  return { texte: resultat.response.text(), modele: retenu, passerelle: 'google' };
}
