/**
 * LA SANTÉ DES MODÈLES, RETENUE D'UNE ANALYSE À LA SUIVANTE.
 *
 * ── LE PROBLÈME QUE CECI RÉSOUT ──────────────────────────────────────────
 *
 * La cascade savait déjà changer de modèle : si le premier tombe, le suivant
 * prend le relais, et l'abonné reçoit son analyse. Ce qu'elle ne savait pas
 * faire, c'est s'en SOUVENIR.
 *
 * Le 21 août 2026, le journal de cascade a montré ceci, quinze fois de suite :
 *
 *     openai/gpt-oss-120b  : délai dépassé (36 001 ms)
 *     deepseek-v4-flash    : délai dépassé (14 614 ms)
 *
 * Quinze abonnés ont donc attendu trente-six secondes pour rien, chacun leur
 * tour, devant le même modèle en panne. Le remède existait — il fallait le
 * réappliquer à chaque fois, parce que la requête suivante repartait de la
 * liste d'origine, comme si rien ne s'était passé.
 *
 * ── CE QUI CHANGE ────────────────────────────────────────────────────────
 *
 * Chaque tentative est notée : réussie ou fautive. Un modèle qui échoue une
 * fois sur deux ou plus, sur au moins trois tentatives, passe EN FIN de liste.
 * Le suivant — un modèle qui, lui, répond — devient le premier appelé. La
 * personne d'après ne paie plus l'attente que la précédente a déjà payée.
 *
 * ── RIEN N'EST JAMAIS SUPPRIMÉ ───────────────────────────────────────────
 *
 * Un modèle déclassé reste dans la liste, à la fin. Si tous les autres
 * tombent, il sera quand même appelé : mieux vaut tenter un modèle douteux
 * que ne rien rendre à quelqu'un qui attend.
 *
 * ── ET IL RETROUVE SA PLACE TOUT SEUL ────────────────────────────────────
 *
 * Les compteurs ne portent que sur les six dernières heures. Une panne de
 * fournisseur dure rarement plus longtemps, et un modèle puni pour une nuit
 * difficile redevient candidat au matin sans que personne n'intervienne. Sans
 * cet oubli, la liste finirait par se vider par le bas, et le classement
 * refléterait un incident vieux de trois semaines.
 */

import { lireReserve, ecrireReserve } from './api-football';

export interface SanteModele {
  /** Tentatives abouties sur la fenêtre en cours. */
  ok: number;
  /** Tentatives fautives sur la fenêtre en cours. */
  ko: number;
  /** Début de la fenêtre — au-delà de six heures, tout repart de zéro. */
  depuis: string;
  dernierEchec?: string;
  derniereCause?: string;
}

export type Sante = Record<string, SanteModele>;

const CLE = 'sante-modeles';

/**
 * Six heures.
 *
 * Assez long pour qu'une panne de fournisseur soit vue plusieurs fois — donc
 * pour que le déclassement s'appuie sur autre chose qu'un hasard — et assez
 * court pour qu'un modèle rétabli reprenne sa place dans la demi-journée.
 */
const FENETRE_MS = 6 * 60 * 60 * 1000;

/**
 * Trois tentatives avant de juger.
 *
 * En dessous, on déclasserait sur un seul incident. Or un échec isolé arrive à
 * tout le monde : un délai réseau, une seconde de saturation chez le
 * fournisseur. Punir là-dessus reviendrait à réorganiser la cascade au hasard.
 */
const TENTATIVES_MINIMUM = 3;

/**
 * Une fois sur deux.
 *
 * Un modèle qui échoue la moitié du temps fait perdre, en moyenne, une
 * tentative complète à chaque personne qui l'attend — soit dix à trente-six
 * secondes prises sur un budget qui en compte soixante. Il n'a plus sa place
 * en tête.
 */
const PART_ECHEC_MAXIMALE = 0.5;

/** Le relevé garde une trace même après la fin de la fenêtre courante. */
const TTL_RESERVE = 7 * 24 * 60 * 60 * 1000;

// ── MÉMOIRE DE L'INSTANCE ───────────────────────────────────────────────────
//
// Relire la base à chaque analyse coûterait une requête pour un renseignement
// qui bouge lentement. On la garde une minute en mémoire : sur une plateforme
// qui réutilise ses instances, cela suffit à effacer presque tous les appels.
let memoire: Sante | null = null;
let luLe = 0;
let ecritLe = 0;
let aEcrire = false;

const TTL_MEMOIRE = 60 * 1000;
/** Un relevé sans incident n'a pas besoin d'être réécrit à chaque analyse. */
const ECRITURE_MINIMALE_MS = 5 * 60 * 1000;

/** Remet à zéro un compteur dont la fenêtre est écoulée. */
function rafraichir(s: SanteModele | undefined, maintenant: number): SanteModele {
  const neuf = (): SanteModele => ({ ok: 0, ko: 0, depuis: new Date(maintenant).toISOString() });
  if (!s) return neuf();
  const debut = new Date(s.depuis).getTime();
  if (!Number.isFinite(debut) || maintenant - debut > FENETRE_MS) return neuf();
  return s;
}

async function lire(): Promise<Sante> {
  const maintenant = Date.now();
  if (memoire && maintenant - luLe < TTL_MEMOIRE) return memoire;

  const enBase = await lireReserve<Sante>(CLE).catch(() => null);
  memoire = enBase?.contenu && typeof enBase.contenu === 'object' ? { ...enBase.contenu } : {};
  luLe = maintenant;
  return memoire;
}

/**
 * Ce modèle a-t-il assez fauté, récemment, pour perdre sa place ?
 */
export function estDeclasse(s: SanteModele | undefined): boolean {
  if (!s) return false;
  const fraiche = rafraichir(s, Date.now());
  const total = fraiche.ok + fraiche.ko;
  if (total < TENTATIVES_MINIMUM) return false;
  return fraiche.ko / total >= PART_ECHEC_MAXIMALE;
}

/**
 * Réordonne la cascade : les modèles en bonne santé d'abord, les autres après.
 *
 * L'ordre RELATIF est conservé de part et d'autre. Le classement d'origine —
 * établi sur des mesures de prix et de vitesse — reste donc la règle ; la santé
 * ne fait que déplacer en fin de liste ceux qui ne répondent plus.
 *
 * Si tout le monde est déclassé, la liste revient à son ordre d'origine : il
 * n'y a plus de « meilleur », autant garder celui qu'on a choisi à froid.
 */
export function classer(base: string[], sante: Sante): string[] {
  const sains = base.filter((m) => !estDeclasse(sante[m]));
  const punis = base.filter((m) => estDeclasse(sante[m]));
  return [...sains, ...punis];
}

export async function ordonnerModeles(base: string[]): Promise<string[]> {
  try {
    return classer(base, await lire());
  } catch {
    // Un classement indisponible ne doit jamais empêcher une analyse : on
    // repart de l'ordre d'origine, exactement comme avant cette fonction.
    return base;
  }
}

function noter(modele: string, reussi: boolean, cause?: string): void {
  if (!modele) return;
  const maintenant = Date.now();
  const table = memoire ?? (memoire = {});
  const s = rafraichir(table[modele], maintenant);

  if (reussi) s.ok += 1;
  else {
    s.ko += 1;
    s.dernierEchec = new Date(maintenant).toISOString();
    if (cause) s.derniereCause = cause.slice(0, 160);
  }

  table[modele] = s;
  aEcrire = true;
}

export const noterSucces = (modele: string) => noter(modele, true);
export const noterEchec = (modele: string, cause?: string) => noter(modele, false, cause);

/**
 * Écrit le relevé en base, pour que l'instance suivante en profite.
 *
 * Un relevé qui ne vit qu'en mémoire ne sert à rien : chaque requête peut
 * démarrer sur une instance neuve, et le modèle en panne redeviendrait le
 * premier appelé. C'est exactement le défaut que ce fichier corrige.
 *
 * On n'écrit pas à chaque analyse : seulement quand un échec vient d'être noté
 * — c'est là que le classement peut changer — ou toutes les cinq minutes pour
 * que les réussites finissent par compter elles aussi.
 */
export async function enregistrerSante(forcer = false): Promise<void> {
  if (!aEcrire || !memoire) return;
  const maintenant = Date.now();
  if (!forcer && maintenant - ecritLe < ECRITURE_MINIMALE_MS) return;

  aEcrire = false;
  ecritLe = maintenant;
  await ecrireReserve(CLE, memoire, TTL_RESERVE).catch(() => {});
}

/** Le relevé complet, pour l'administration. */
export async function bilanSante(): Promise<
  { modele: string; ok: number; ko: number; declasse: boolean; derniereCause?: string }[]
> {
  const sante = await lire().catch(() => ({} as Sante));
  const maintenant = Date.now();
  return Object.entries(sante)
    .map(([modele, s]) => {
      const f = rafraichir(s, maintenant);
      return {
        modele,
        ok: f.ok,
        ko: f.ko,
        declasse: estDeclasse(s),
        derniereCause: f.derniereCause,
      };
    })
    .filter((e) => e.ok + e.ko > 0)
    .sort((a, b) => b.ko - a.ko);
}

/** Uniquement pour les tests : repart d'un relevé vierge. */
export function _reinitialiser(): void {
  memoire = null;
  luLe = 0;
  ecritLe = 0;
  aEcrire = false;
}
