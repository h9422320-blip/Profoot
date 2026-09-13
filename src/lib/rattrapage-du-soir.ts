/**
 * ── LE RATTRAPAGE DU SOIR ──────────────────────────────────────────────────
 *
 * UNE COUCHE EN PLUS, ET RIEN D'ENLEVÉ.
 *
 * `entretien-quotidien.ts` fait tout le travail, une fois par jour : il repart
 * dès que le dernier passage a plus de vingt heures. Ce réglage n'est pas
 * touché ici — il est bon, et il a sorti le mur de l'immobilité.
 *
 * ── CE QUE VINGT HEURES NE PEUVENT PAS COUVRIR ────────────────────────────
 *
 * Le 12 septembre 2026, l'entretien a tourné à 18 h 40. Real Madrid — Rayo
 * Vallecano a débuté à 19 h 00 : vingt minutes trop tard. Le passage suivant
 * ne pouvait pas avoir lieu avant 14 h 40 le lendemain. Le match le plus
 * regardé de la journée — annoncé 4-1, terminé 4-1, score exact — est donc
 * resté absent du mur public pendant presque vingt heures, pendant que le
 * propriétaire le cherchait.
 *
 * Ce n'était pas une panne. C'est arithmétique : une fenêtre d'une fois par
 * jour tombe nécessairement, un jour sur deux, AVANT les matchs du soir. Or
 * les matchs du soir sont les plus suivis, et ce sont ceux dont la preuve
 * vaut le plus cher.
 *
 * ── LA RÉPONSE ────────────────────────────────────────────────────────────
 *
 * Un second déclencheur, indépendant, qui ne fait que deux choses : confronter
 * les pronostics aux résultats, puis reconstruire le mur. Ni paiements, ni
 * cotes, ni apprentissage — l'entretien quotidien s'en occupe déjà et garde sa
 * charge entière.
 *
 * Il a sa propre clé, son propre verrou, sa propre fenêtre. Les deux
 * mécanismes ne se voient pas et ne peuvent pas se gêner : au pire, une
 * vérification tourne deux fois, et elle est idempotente — une analyse déjà
 * confrontée n'est plus relue.
 *
 * ── POURQUOI LE SOIR SEULEMENT, ET TOUTES LES DEUX HEURES ────────────────
 *
 * Le quota du fournisseur de données est la ressource la plus rare du projet.
 * Un passage coûte environ vingt-cinq appels — les rencontres sont lues vingt
 * par appel. Borné à la tranche 16 h–02 h UTC, où se jouent et se terminent
 * les matchs européens, et à un passage toutes les deux heures, cela fait au
 * plus cinq passages par jour. C'est le prix d'un mur qui montre le match du
 * soir le soir même.
 */

import { lireReserve, ecrireReserve } from './api-football';

/** Clé du dernier passage, distincte de celle de l'entretien quotidien. */
const CLE_DERNIER = 'rattrapage-soir:dernier';

/** Clé du verrou, distincte elle aussi. */
const CLE_VERROU = 'rattrapage-soir:verrou';

/** Deux heures entre deux passages : assez pour qu'un match se termine. */
export const ENTRE_PASSAGES_MS = 2 * 60 * 60 * 1000;

/** Durée du verrou. Au-delà, on considère le passage précédent mort. */
const VERROU_MS = 5 * 60 * 1000;

/**
 * La tranche horaire, en heures UTC.
 *
 * De 16 h à 2 h du matin : les matchs européens commencent à 16 h 30 au plus
 * tôt et le dernier coup de sifflet tombe vers 23 h. Les deux heures qui
 * suivent laissent le fournisseur publier ses scores définitifs.
 */
export const HEURE_DEBUT = 16;
export const HEURE_FIN = 2;

/**
 * Le lot de vérification.
 *
 * Volontairement plus petit que les deux mille de l'entretien quotidien : ce
 * passage ne cherche pas à rattraper un arriéré, seulement les rencontres qui
 * viennent de se terminer. Les analyses les plus récentes passent en premier,
 * et ce sont précisément celles des matchs du jour.
 */
export const LOT = 1200;

/** L'heure est-elle dans la tranche du soir ? */
export function dansLaTrancheDuSoir(quand: Date = new Date()): boolean {
  const h = quand.getUTCHours();
  // La tranche franchit minuit : 16..23 d'un côté, 0..1 de l'autre.
  return h >= HEURE_DEBUT || h < HEURE_FIN;
}

export interface ResultatRattrapage {
  lance: boolean;
  raison: string;
  verifiees: number;
  matchs: number;
  reussites: number;
  dureeMs: number;
}

/**
 * Confronte les pronostics et reconstruit le mur, si le moment s'y prête.
 *
 * `forcer` court-circuite la tranche horaire et le délai entre passages — pour
 * un appel à la main, quand on sait pourquoi on le fait.
 */
export async function rattraperLeSoir(forcer = false): Promise<ResultatRattrapage> {
  const debut = Date.now();
  const rien = (raison: string): ResultatRattrapage => ({
    lance: false,
    raison,
    verifiees: 0,
    matchs: 0,
    reussites: 0,
    dureeMs: Date.now() - debut,
  });

  // ── JAMAIS PENDANT UN BUILD ─────────────────────────────────────────────
  //
  // La page du mur est prérendue à la construction, et `after` s'exécute alors
  // pour de vrai. Constaté le 13 septembre 2026 : une construction est tombée
  // parce que l'entretien quotidien, déclenché à ce moment-là, a dépassé le
  // temps imparti sur les cotes — « Failed to build /preuves after 3
  // attempts ». Une mise en ligne peut donc échouer au hasard de l'heure.
  //
  // Cette couche refuse donc de travailler pendant la construction. Elle n'a
  // rien à y faire : aucun visiteur n'attend, et le premier qui ouvrira la page
  // la déclenchera.
  if (process.env.NEXT_PHASE === 'phase-production-build')
    return rien('construction en cours');

  if (!forcer) {
    if (!dansLaTrancheDuSoir()) return rien('hors de la tranche du soir');

    const dernier = await lireReserve<string>(CLE_DERNIER).catch(() => null);
    const quand = dernier?.contenu ? new Date(dernier.contenu) : null;
    if (quand && !isNaN(quand.getTime()) && Date.now() - quand.getTime() < ENTRE_PASSAGES_MS)
      return rien(`passage il y a ${Math.round((Date.now() - quand.getTime()) / 60000)} min`);

    // Le verrou n'est qu'une politesse : `lireReserve` abandonne au bout d'une
    // seconde et demie, il peut donc rendre « rien » alors qu'un passage est en
    // cours. Ce n'est pas grave — les deux étapes sont idempotentes.
    const verrou = await lireReserve<string>(CLE_VERROU).catch(() => null);
    if (verrou?.contenu && !verrou.expiree) return rien('déjà en cours');
  }

  await ecrireReserve(CLE_VERROU, new Date().toISOString(), VERROU_MS);

  let verifiees = 0;
  let matchs = 0;
  let reussites = 0;
  const soucis: string[] = [];

  // Les deux étapes sont isolées : un mur qui ne se reconstruit pas ne doit pas
  // effacer le bénéfice d'une vérification qui a réussi.
  try {
    const { verifierPronostics } = await import('./precision-reelle');
    const r = await verifierPronostics(LOT);
    verifiees = r?.verifiees ?? 0;
  } catch (e: any) {
    soucis.push(`vérification : ${String(e?.message ?? e).slice(0, 120)}`);
  }

  try {
    const { construirePreuves } = await import('./preuves');
    const p: any = await construirePreuves();
    matchs = p?.matchs ?? 0;
    reussites = p?.reussites ?? 0;
  } catch (e: any) {
    soucis.push(`mur : ${String(e?.message ?? e).slice(0, 120)}`);
  }

  // La marque du passage n'est posée qu'à la fin : coupé en chemin, le
  // prochain visiteur reprend le travail au lieu d'attendre deux heures.
  await ecrireReserve(CLE_DERNIER, new Date().toISOString(), 7 * 24 * 3600 * 1000);

  const resultat: ResultatRattrapage = {
    lance: true,
    raison: soucis.length ? soucis.join(' ; ') : 'fait',
    verifiees,
    matchs,
    reussites,
    dureeMs: Date.now() - debut,
  };
  console.log(
    `[RATTRAPAGE] ${verifiees} analyse(s) confrontée(s), mur à ${matchs} match(s) dont ${reussites} réussite(s)` +
      ` en ${resultat.dureeMs} ms${soucis.length ? ` — ${resultat.raison}` : ''}`
  );
  return resultat;
}
