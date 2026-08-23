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
 *
 * ── LA FENÊTRE EST GLISSANTE, ET C'EST DÉLIBÉRÉ ───────────────────────────
 *
 * La première version remettait le compte à zéro à minuit en temps universel.
 * C'était une supposition, et elle était fausse : le 23 août 2026 à 01 h 50
 * UTC, Clarity refusait toujours avec « Exceeded daily limit ». Microsoft ne
 * documente pas l'heure de sa remise à zéro.
 *
 * Une fenêtre glissante de vingt-quatre heures ne suppose rien. Elle est au
 * moins aussi stricte que n'importe quel découpage réel, quel qu'il soit.
 *
 * ── LE VERROU APRÈS UN REFUS ──────────────────────────────────────────────
 *
 * Un refus de Microsoft — code 429 — est probablement compté par lui comme un
 * appel. Réessayer en boucle après un refus, c'est donc creuser le trou. Dès
 * qu'un 429 arrive, plus rien ne part pendant trois heures.
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
  /** Horodatage de chaque appel des dernières vingt-quatre heures. */
  appels: number[];
  /** Tant que cet instant n'est pas passé, plus rien ne part. */
  bloqueJusqua?: number;
}

const FENETRE_MS = 24 * 60 * 60 * 1000;

/** Après un refus de Microsoft, on cesse d'insister pendant ce temps. */
const VERROU_MS = 3 * 60 * 60 * 1000;

async function lireCompte(): Promise<Compte> {
  const enBase = await lireReserve<Compte>(CLE);
  const c = enBase?.contenu;
  if (!c || !Array.isArray(c.appels)) return { appels: [] };
  const limite = Date.now() - FENETRE_MS;
  return { appels: c.appels.filter((t) => t > limite), bloqueJusqua: c.bloqueJusqua };
}

async function ecrireCompte(c: Compte): Promise<void> {
  await ecrireReserve(CLE, c, 26 * 60 * 60 * 1000);
}

/**
 * Enregistre un refus de Microsoft, et ferme le robinet.
 *
 * Appelé quand Clarity répond « Exceeded daily limit ». Sans ce verrou, chaque
 * affichage de page relançait une requête que Microsoft comptait tout en la
 * refusant : on s'enfonçait à chaque tentative.
 */
export async function signalerRefus(): Promise<void> {
  const c = await lireCompte();
  await ecrireCompte({
    // Le compte est porté au plafond : Microsoft nous dit lui-même qu'il n'en
    // reste plus, quelle que soit notre propre estimation.
    appels: Array.from({ length: PLAFOND_QUOTIDIEN }, () => Date.now()),
    bloqueJusqua: Date.now() + VERROU_MS,
  });
}

/** Combien d'appels restent avant notre plafond. */
export async function appelsRestants(): Promise<number> {
  const c = await lireCompte();
  if (c.bloqueJusqua && Date.now() < c.bloqueJusqua) return 0;
  return Math.max(0, PLAFOND_QUOTIDIEN - c.appels.length);
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
  if (c.bloqueJusqua && Date.now() < c.bloqueJusqua) return false;
  if (c.appels.length >= PLAFOND_QUOTIDIEN) return false;

  await ecrireCompte({ appels: [...c.appels, Date.now()], bloqueJusqua: undefined });
  return true;
}

/** Le décompte du jour, pour l'afficher sans le modifier. */
export async function etatQuota(): Promise<{
  utilises: number;
  plafond: number;
  restants: number;
  /** Quand le verrou posé après un refus se lèvera, s'il est actif. */
  bloqueJusqua: string | null;
}> {
  const c = await lireCompte();
  const bloque = !!(c.bloqueJusqua && Date.now() < c.bloqueJusqua);
  return {
    utilises: bloque ? PLAFOND_QUOTIDIEN : c.appels.length,
    plafond: PLAFOND_QUOTIDIEN,
    restants: bloque ? 0 : Math.max(0, PLAFOND_QUOTIDIEN - c.appels.length),
    bloqueJusqua: bloque ? new Date(c.bloqueJusqua!).toISOString() : null,
  };
}
