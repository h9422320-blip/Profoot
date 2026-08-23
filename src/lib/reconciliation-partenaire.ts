/**
 * LA PAGE VÉRIFIE SON PROPRE CALCUL CONTRE LA CAISSE.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Le 23 août 2026, le propriétaire a signalé trois fois en une journée que la
 * page des partenaires « ne collait pas ». Chaque fois, la vérification a
 * montré que le chiffre était juste :
 *
 *   • 596 200 contre 557 000 — deux périodes différentes : depuis le lancement
 *     d'un côté, depuis le début du partenariat de l'autre ;
 *   • 557 000 devenu 574 000 — dix-sept mille francs de ventes tombées entre
 *     la capture d'écran et la vérification ;
 *   • « 121 000 hier » contre 117 000 — un autre écran, pas une erreur.
 *
 * Le calcul n'a jamais été faux. Ce qui manquait, c'est de quoi le VÉRIFIER
 * sans ouvrir un terminal. Trois écrans montraient trois montants exacts, et
 * rien ne disait lequel répondait à quelle question.
 *
 * ── CE QUE CE MODULE CALCULE ──────────────────────────────────────────────
 *
 * Le même total, par deux chemins indépendants :
 *
 *   1. Ce que la page a additionné, mois par mois, pour le partenaire.
 *   2. Le total lu directement dans la caisse sur la même période.
 *
 * S'ils divergent, c'est un défaut réel — et il devient visible à l'écran, à
 * l'instant où il apparaît, au lieu d'être découvert par le propriétaire des
 * semaines plus tard.
 *
 * ── ET IL EXPLIQUE L'ÉCART NORMAL ────────────────────────────────────────
 *
 * Il y en a un, légitime : les ventes antérieures au début du partenariat.
 * Elles ne reviennent pas au partenaire, et c'est exactement la différence
 * entre le chiffre de la vue d'ensemble et celui de cette page. Le dire
 * supprime la question avant qu'elle se pose.
 */

import { recettesParJour, totalEntre } from './recettes-boutique';
import type { PartenaireEnrichi } from './partenaires';

export interface Reconciliation {
  /** Premier jour compté pour le partenaire, AAAA-MM-JJ. */
  debut: string;
  /** Ce que la page a additionné pour le partenaire. */
  calculeXof: number;
  /** Ce que la caisse rend sur la même période. */
  caisseXof: number;
  /** Nombre de ventes encaissées sur la période. */
  ventes: number;
  /** Tout ce que la boutique a encaissé, toutes dates confondues. */
  totalBoutiqueXof: number;
  /** Ventes d'avant le partenariat : l'écart légitime avec la vue d'ensemble. */
  avantPartenariatXof: number;
  /** Écart entre les deux chemins de calcul. Doit valoir zéro. */
  ecartXof: number;
  /** Heure de lecture, en heure de Conakry. */
  luA: string;
  /** Vrai quand la caisse n'a pas répondu : le contrôle n'a pas pu se faire. */
  indisponible?: boolean;
}

/**
 * Confronte le calcul de la page à la caisse.
 *
 * Renvoie `indisponible` plutôt qu'une erreur si la boutique ne répond pas :
 * un contrôle impossible ne doit pas empêcher la page de s'afficher, mais il
 * ne doit pas non plus se faire passer pour un contrôle réussi.
 */
export async function reconcilier(
  partenaire: PartenaireEnrichi | undefined,
  aujourdhui = new Date()
): Promise<Reconciliation | null> {
  if (!partenaire) return null;

  const jour = (d: Date) => d.toISOString().slice(0, 10);
  const debut = partenaire.remuneration_depuis
    ? String(partenaire.remuneration_depuis).slice(0, 10)
    : jour(new Date(partenaire.created_at));

  const luA = aujourdhui.toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Conakry',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Chemin 1 : ce que la page a additionné, mois par mois.
  const calculeXof = partenaire.mois.reduce((s, m) => s + m.recettesXof, 0);

  const parJour = await recettesParJour();
  if (!parJour) {
    return {
      debut,
      calculeXof,
      caisseXof: 0,
      ventes: 0,
      totalBoutiqueXof: 0,
      avantPartenariatXof: 0,
      ecartXof: 0,
      luA,
      indisponible: true,
    };
  }

  // Chemin 2 : la caisse, lue directement sur la même période.
  const surPeriode = totalEntre(parJour, debut, null);
  const tout = totalEntre(parJour, null, null);

  return {
    debut,
    calculeXof,
    caisseXof: surPeriode.xof,
    ventes: surPeriode.ventes,
    totalBoutiqueXof: tout.xof,
    avantPartenariatXof: tout.xof - surPeriode.xof,
    ecartXof: calculeXof - surPeriode.xof,
    luA,
  };
}

/** Le jour, écrit comme on le lit — « 16 août ». */
export function jourEnClair(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
