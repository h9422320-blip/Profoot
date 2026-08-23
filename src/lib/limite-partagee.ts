/**
 * UNE LIMITE DE DÉBIT QUI SURVIT AU REDÉMARRAGE ET AUX INSTANCES.
 *
 * ── POURQUOI CELLE EN MÉMOIRE NE SUFFIT PAS ───────────────────────────────
 *
 * `rateLimit.ts` garde ses compteurs dans un `Map`, en mémoire. Sur Vercel,
 * chaque requête peut atterrir sur une instance différente, et chaque instance
 * a sa propre mémoire. Une limite de « dix par minute » devient donc dix par
 * minute PAR INSTANCE : avec dix instances éveillées, cent par minute.
 *
 * Le serveur redémarre aussi plusieurs fois par heure. Un compteur en mémoire
 * repart alors de zéro — précisément au moment où quelqu'un insiste.
 *
 * Ce module compte en base. Le décompte est le même pour tout le monde, quelle
 * que soit l'instance qui répond, et il survit aux redémarrages.
 *
 * ── CE QU'IL NE PROMET PAS ────────────────────────────────────────────────
 *
 * L'incrément n'est pas atomique : on lit, on ajoute, on écrit. Deux requêtes
 * simultanées peuvent donc lire le même compte et passer toutes les deux. Sur
 * une limite de huit, cela laisse au pire passer neuf ou dix tentatives — pas
 * huit cents.
 *
 * C'est un compromis assumé : rendre l'opération atomique demanderait une
 * fonction SQL à installer en base, donc une manipulation manuelle de plus.
 * Le gain réel — passer de « limite multipliée par le nombre d'instances » à
 * « limite quasi exacte » — ne le justifie pas.
 *
 * ── ET SI LA BASE NE RÉPOND PAS ? ─────────────────────────────────────────
 *
 * On laisse passer. Une base injoignable ne doit pas empêcher les gens de se
 * connecter : le remède serait pire que le mal. L'incident est journalisé.
 */

import { lireReserve, ecrireReserve } from './api-football';

export interface Verdict {
  /** Vrai quand la tentative est refusée. */
  bloque: boolean;
  /** Combien de tentatives restent avant blocage. */
  restantes: number;
  /** Secondes à attendre avant de pouvoir réessayer. */
  attendreSecondes: number;
}

interface Compteur {
  /** Horodatage de chaque tentative encore dans la fenêtre. */
  coups: number[];
}

const cle = (domaine: string, identifiant: string) =>
  `limite:${domaine}:${identifiant.toLowerCase().trim().slice(0, 120)}`;

/**
 * Compte une tentative et dit si elle doit être refusée.
 *
 * @param domaine     À quoi sert la limite — « connexion », « analyse »…
 * @param identifiant Ce qu'on limite : une adresse e-mail, un compte, une IP.
 * @param maximum     Nombre de tentatives autorisées dans la fenêtre.
 * @param fenetreMs   Durée de la fenêtre glissante.
 *
 * La fenêtre est GLISSANTE et non par tranche fixe. Une tranche fixe autorise
 * le double à cheval sur deux tranches : huit à la fin de l'une, huit au début
 * de la suivante, soit seize en quelques secondes.
 */
export async function compterTentative(
  domaine: string,
  identifiant: string,
  maximum: number,
  fenetreMs: number
): Promise<Verdict> {
  const k = cle(domaine, identifiant);

  try {
    const enBase = await lireReserve<Compteur>(k);
    const limite = Date.now() - fenetreMs;
    const coups = (enBase?.contenu?.coups ?? []).filter((t) => t > limite);

    if (coups.length >= maximum) {
      // La plus ancienne tentative encore comptée détermine la sortie de
      // blocage : c'est elle qui quittera la fenêtre en premier.
      const attendre = Math.ceil((coups[0] + fenetreMs - Date.now()) / 1000);
      return { bloque: true, restantes: 0, attendreSecondes: Math.max(1, attendre) };
    }

    const nouveaux = [...coups, Date.now()];
    // La note vit un peu plus longtemps que la fenêtre : sans cette marge, elle
    // pourrait disparaître juste avant la dernière tentative comptée.
    await ecrireReserve(k, { coups: nouveaux }, fenetreMs + 60_000);

    return {
      bloque: false,
      restantes: Math.max(0, maximum - nouveaux.length),
      attendreSecondes: 0,
    };
  } catch (e: any) {
    console.warn(`[LIMITE] Comptage impossible (${domaine}) : ${e?.message}`);
    return { bloque: false, restantes: maximum, attendreSecondes: 0 };
  }
}

/**
 * Efface le compteur.
 *
 * Appelé après une réussite : quelqu'un qui finit par entrer avec le bon mot
 * de passe ne doit pas rester puni pour ses fautes de frappe précédentes.
 * Sans cet effacement, trois erreurs le matin et cinq le soir bloqueraient un
 * client légitime.
 */
export async function effacerTentatives(domaine: string, identifiant: string): Promise<void> {
  try {
    await ecrireReserve(cle(domaine, identifiant), { coups: [] }, 1);
  } catch {
    // Sans conséquence : au pire le compteur expire tout seul.
  }
}

/** Le message montré à quelqu'un qu'on fait patienter. */
export function messageAttente(secondes: number): string {
  if (secondes <= 90) return `Réessayez dans ${Math.max(1, Math.round(secondes))} secondes.`;
  return `Réessayez dans ${Math.round(secondes / 60)} minutes.`;
}
