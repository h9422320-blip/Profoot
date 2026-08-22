/**
 * CE QUE LA BOUTIQUE A ENCAISSÉ. LA SEULE RÉPONSE, POUR TOUTE L'APPLICATION.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Trois pages de l'administration affichaient de l'argent, et chacune le
 * comptait à sa façon :
 *
 *   • la vue d'ensemble additionnait les montants des abonnements ;
 *   • la page des partenaires appliquait le prix catalogue du jour ;
 *   • la boutique Chariow, elle, savait ce qui était réellement entré.
 *
 * Trois chiffres différents pour la même semaine, et c'est sur l'un d'eux
 * qu'on paie un partenaire. Le 22 août 2026 : 343 000 affichés côté
 * partenaires, 319 000 côté base, 325 000 réellement encaissés.
 *
 * La table des abonnements est un REFLET de la boutique, jamais la boutique.
 * Une vente payée dont le compte ne s'est pas créé n'y figure pas — il y en
 * avait trois sur cette seule semaine. Un abonnement modifié à la main y ment.
 *
 * Ce module interroge la caisse. Tout le reste le consulte.
 *
 * ── POURQUOI IL PORTE AUSSI LES TAUX DE CHANGE ────────────────────────────
 *
 * Ils vivaient dans `partenaires.ts`. Les remonter ici évite qu'un module qui
 * a besoin d'une conversion doive importer la page des partenaires — et évite
 * surtout qu'une deuxième table apparaisse un jour ailleurs. Deux tables de
 * taux finissent toujours par diverger, et c'est sur elles qu'on paie
 * quelqu'un.
 */

import { listSalesEncaissees } from './chariow';
import { lireReserve, ecrireReserve } from './api-football';

/**
 * Taux de conversion vers le franc CFA.
 *
 * L'euro est arrimé au franc CFA à une parité fixe et officielle. Le dollar
 * flotte : sa valeur est une approximation, affichée comme telle partout où
 * elle sert.
 */
export const TAUX_XOF: Record<string, number> = {
  XOF: 1,
  EUR: 655.957, // parité fixe
  USD: 600, // approximation
};

export function versXof(montant: number, devise: string): number {
  return Number(montant ?? 0) * (TAUX_XOF[devise] ?? 0);
}

/** Recette d'une journée : le montant encaissé et le nombre de ventes. */
export interface JourneeBoutique {
  xof: number;
  ventes: number;
}

/** Journée par journée, indexée AAAA-MM-JJ. */
export type RecettesParJour = Record<string, JourneeBoutique>;

/**
 * Dernier chiffre connu, gardé UNIQUEMENT pour les pannes.
 *
 * Il n'est jamais servi quand la boutique répond. Ce n'est pas un cache : un
 * cache aurait fait réapparaître le décalage qu'on vient de supprimer.
 */
const CLE_SECOURS = 'chariow:dernier-chiffre-connu';
const SECOURS_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * Les recettes de la boutique, jour par jour, depuis l'ouverture.
 *
 * ── LA CAISSE EST INTERROGÉE À CHAQUE AFFICHAGE ───────────────────────────
 *
 * Aucune mise en réserve sur le chemin normal. C'est un choix, et il vient
 * d'une erreur : la version précédente gardait le total cinq minutes, et deux
 * pages ouvertes à une minute d'intervalle lisaient deux instantanés
 * différents. Le 22 août 2026 à 12 h 16, la vue d'ensemble affichait
 * 368 000 FCFA et la page des partenaires 325 000, quand la caisse en avait
 * encaissé 375 200 et 336 000.
 *
 * Un chiffre en retard est un chiffre faux, et deux pages en désaccord font
 * douter des deux. Comme demander à la caisse ne coûte que deux requêtes et
 * moins d'une seconde (voir `listSalesEncaissees`), il n'y a plus aucune
 * raison de garder quoi que ce soit : chaque affichage repart de la source.
 *
 * ── CE QUE « ENCAISSÉ » VEUT DIRE ─────────────────────────────────────────
 *
 * Chariow marque une vente payée `completed` ou `settled`. Les autres —
 * `abandoned`, `failed`, `awaiting_payment` — n'ont rien rapporté. Au 22 août
 * 2026 : 1 163 ventes enregistrées, 115 encaissées. Compter les autres
 * multiplierait la recette par dix.
 *
 * ── LA DATE RETENUE EST CELLE DU PAIEMENT ─────────────────────────────────
 *
 * Une vente ouverte le 21 à 23 h 50 et payée le 22 appartient au 22. C'est la
 * date à laquelle l'argent est entré, donc celle qui décide du mois — et donc
 * du mois où elle compte pour un partenaire.
 *
 * Renvoie `null` si la boutique est injoignable et qu'aucun chiffre de secours
 * n'a jamais été enregistré. L'appelant décide alors quoi faire.
 */
export async function recettesParJour(): Promise<RecettesParJour | null> {
  try {
    const parJour: RecettesParJour = {};

    for (const v of await listSalesEncaissees()) {
      const jour = String((v as any).completed_at ?? v.created_at ?? '').slice(0, 10);
      if (!jour) continue;

      const devise = v.amount?.currency ?? 'XOF';
      if (devise !== 'XOF')
        console.warn(`[BOUTIQUE] Vente ${v.id} en ${devise} : convertie au taux affiché.`);

      const poste = parJour[jour] ?? { xof: 0, ventes: 0 };
      poste.xof += Math.round(versXof(Number(v.amount?.value ?? 0), devise));
      poste.ventes += 1;
      parJour[jour] = poste;
    }

    // Écrit APRÈS coup, et jamais relu tant que la boutique répond : c'est un
    // filet, pas une source.
    void ecrireReserve(CLE_SECOURS, parJour, SECOURS_TTL);
    return parJour;
  } catch (e: any) {
    console.warn('[BOUTIQUE] Injoignable :', e?.message);
    const secours = await lireReserve<RecettesParJour>(CLE_SECOURS);
    if (secours && Object.keys(secours.contenu ?? {}).length) {
      console.warn('[BOUTIQUE] Dernier chiffre connu resservi — il peut être daté.');
      return secours.contenu;
    }
    return null;
  }
}

/**
 * Le total encaissé entre deux dates incluses, au format AAAA-MM-JJ.
 *
 * Les bornes sont comparées comme du texte : `'2026-08-16' <= '2026-08-22'`.
 * Aucune conversion de fuseau horaire n'intervient, donc aucune vente ne peut
 * glisser d'un jour à l'autre selon l'endroit d'où la page est consultée.
 */
export function totalEntre(
  parJour: RecettesParJour,
  du?: string | null,
  au?: string | null
): JourneeBoutique {
  let xof = 0;
  let ventes = 0;
  for (const [jour, poste] of Object.entries(parJour)) {
    if (du && jour < du) continue;
    if (au && jour > au) continue;
    xof += poste.xof;
    ventes += poste.ventes;
  }
  return { xof, ventes };
}

/**
 * L'heure de lecture, telle qu'elle doit être écrite sous un chiffre d'argent.
 *
 * ── POURQUOI UN CHIFFRE D'ARGENT DOIT PORTER SON HEURE ────────────────────
 *
 * Le 22 août 2026, la page affichait 325 000 FCFA et la boutique 336 000. Les
 * deux étaient exacts : ils avaient simplement été lus à vingt minutes
 * d'intervalle, et rien à l'écran ne permettait de s'en apercevoir. On a donc
 * cherché une erreur de calcul là où il n'y avait qu'un écart d'horloge.
 *
 * Un montant sans heure ne peut pas être confronté à quoi que ce soit. Avec
 * son heure, la comparaison avec le tableau de bord Chariow devient immédiate
 * et sans ambiguïté : mêmes secondes, mêmes francs.
 *
 * L'heure est celle de Conakry, celle du propriétaire — pas celle du serveur,
 * qui tourne en Europe.
 */
export function heureDeLecture(): string {
  return new Date().toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Conakry',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Regroupe les journées par mois, indexé AAAA-MM. */
export function parMois(
  parJour: RecettesParJour,
  depuis?: string | null
): Map<string, JourneeBoutique> {
  const mois = new Map<string, JourneeBoutique>();
  for (const [jour, poste] of Object.entries(parJour)) {
    if (depuis && jour < depuis) continue;
    const cle = jour.slice(0, 7);
    const cumul = mois.get(cle) ?? { xof: 0, ventes: 0 };
    cumul.xof += poste.xof;
    cumul.ventes += poste.ventes;
    mois.set(cle, cumul);
  }
  return mois;
}
