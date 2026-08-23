/**
 * LE COMPTEUR D'APPELS À CLARITY.
 *
 * ── CE QUI S'EST PASSÉ LE 23 AOÛT 2026 ────────────────────────────────────
 *
 * Microsoft autorise DIX appels par jour et par projet. La page d'audience en
 * faisait trois par lecture, la page « Comportement » un de plus. Chaque fois
 * que la réserve de trois heures était périmée, ouvrir ces deux pages coûtait
 * quatre appels.
 *
 * Le propriétaire les a ouvertes quelques fois de suite, un soir, pour
 * regarder ce que ça donnait. Résultat : « Exceeded daily limit », et plus
 * aucune donnée jusqu'au lendemain — y compris pour la route de diagnostic
 * qui devait justement servir à comprendre le problème.
 *
 * ── CE QUE CE MODULE EMPÊCHE ──────────────────────────────────────────────
 *
 * Il compte les appels de la journée et REFUSE de dépasser le plafond qu'on
 * s'est fixé — délibérément inférieur à celui de Microsoft, pour garder
 * quelques appels en réserve le jour où l'on doit diagnostiquer quelque chose.
 *
 * Un appel refusé ici ne coûte rien et n'apparaît pas dans le décompte de
 * Microsoft. C'est toute la différence : avant, on découvrait le plafond en le
 * heurtant ; maintenant on s'arrête avant.
 *
 * ── POURQUOI LE COMPTE VIT EN BASE ────────────────────────────────────────
 *
 * Le serveur redémarre plusieurs fois par heure et tourne en plusieurs
 * exemplaires. Un compteur gardé en mémoire repartirait de zéro à chaque
 * redémarrage, ce qui reviendrait à ne rien compter du tout.
 */

import { lireReserve, ecrireReserve } from './api-football';

/**
 * Notre plafond, volontairement sous celui de Microsoft.
 *
 * Deux appels sont gardés de côté : le jour où un chiffre paraît faux, il faut
 * pouvoir interroger la source pour comprendre. Un diagnostic impossible parce
 * que l'affichage a tout consommé, c'est exactement ce qui est arrivé.
 */
export const PLAFOND_QUOTIDIEN = 8;

/** Ce que Microsoft autorise réellement — affiché pour situer le nôtre. */
export const PLAFOND_MICROSOFT = 10;

const CLE = 'clarity:appels-du-jour';

interface Compte {
  /** Jour concerné, AAAA-MM-JJ en temps universel — comme Microsoft compte. */
  jour: string;
  appels: number;
}

const jourActuel = () => new Date().toISOString().slice(0, 10);

async function lireCompte(): Promise<Compte> {
  const enBase = await lireReserve<Compte>(CLE);
  const aujourdhui = jourActuel();
  if (enBase?.contenu?.jour === aujourdhui) return enBase.contenu;
  return { jour: aujourdhui, appels: 0 };
}

/** Combien d'appels restent avant notre plafond. */
export async function appelsRestants(): Promise<number> {
  const c = await lireCompte();
  return Math.max(0, PLAFOND_QUOTIDIEN - c.appels);
}

/**
 * Réserve un appel, ou refuse.
 *
 * La réservation se fait AVANT l'appel, jamais après : si le réseau coupe au
 * milieu, Microsoft a tout de même reçu la requête et l'a comptée. Compter
 * après coup laisserait passer les appels qui échouent — c'est-à-dire
 * précisément ceux qu'on fait en rafale quand quelque chose ne va pas.
 */
export async function reserverAppel(): Promise<boolean> {
  const c = await lireCompte();
  if (c.appels >= PLAFOND_QUOTIDIEN) return false;

  // Vingt-six heures : la note doit survivre au changement de jour pour que
  // le contrôle de date la trouve et la remette à zéro proprement.
  await ecrireReserve(CLE, { jour: c.jour, appels: c.appels + 1 }, 26 * 60 * 60 * 1000);
  return true;
}

/** Le décompte du jour, pour l'afficher sans le modifier. */
export async function etatQuota(): Promise<{ utilises: number; plafond: number; restants: number }> {
  const c = await lireCompte();
  return {
    utilises: c.appels,
    plafond: PLAFOND_QUOTIDIEN,
    restants: Math.max(0, PLAFOND_QUOTIDIEN - c.appels),
  };
}
