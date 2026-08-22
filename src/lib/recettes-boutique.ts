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

import { listRecentSales, STATUTS_ENCAISSES } from './chariow';
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

const CLE = 'chariow:recettes-jour';

/**
 * Durée de vie de la réserve.
 *
 * ── POURQUOI SI COURT, ET POURQUOI ÇA NE COÛTE RIEN ───────────────────────
 *
 * Lire toute la boutique demande une douzaine d'appels à Chariow. Les refaire
 * à chaque affichage rendrait la page lente pour rien.
 *
 * Mais la réserve est VIDÉE à chaque vente encaissée, par le webhook (voir
 * `oublierRecettes`). Ces cinq minutes ne sont donc pas le délai normal de
 * mise à jour — c'est le filet du jour où un webhook se perdrait. En marche
 * normale, une commande apparaît à l'écran au rechargement suivant.
 */
const TTL = 5 * 60 * 1000;

/**
 * Efface le chiffre en réserve.
 *
 * Appelé par le webhook Chariow dès qu'une vente est encaissée : la lecture
 * suivante repart de la caisse, et l'administration montre la commande sans
 * attendre. C'est ce qui remplace une attente par une mise à jour.
 */
export async function oublierRecettes(): Promise<void> {
  await ecrireReserve(CLE, {}, 1);
}

/**
 * Les recettes de la boutique, jour par jour, depuis l'ouverture.
 *
 * ── CE QUE « ENCAISSÉ » VEUT DIRE ─────────────────────────────────────────
 *
 * Chariow marque une vente payée `completed` ou `settled`. Les autres —
 * `abandoned`, `failed`, `awaiting_payment` — n'ont rien rapporté. Sur la
 * semaine du 16 août : 1 141 ventes au total, 110 encaissées. Compter les
 * autres multiplierait la recette par dix.
 *
 * ── LA DATE RETENUE EST CELLE DU PAIEMENT ─────────────────────────────────
 *
 * Une vente ouverte le 21 à 23 h 50 et payée le 22 appartient au 22. C'est la
 * date à laquelle l'argent est entré, donc celle qui décide du mois — et donc
 * du mois où elle compte pour un partenaire.
 *
 * Renvoie `null` quand la boutique est injoignable ET qu'aucune réserve,
 * même périmée, n'existe. L'appelant décide alors quoi faire.
 */
export async function recettesParJour(): Promise<RecettesParJour | null> {
  const enReserve = await lireReserve<RecettesParJour>(CLE);
  if (enReserve && !enReserve.expiree && Object.keys(enReserve.contenu ?? {}).length)
    return enReserve.contenu;

  try {
    const parJour: RecettesParJour = {};

    for (const v of await listRecentSales()) {
      if (!STATUTS_ENCAISSES.includes(String(v.status))) continue;

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

    void ecrireReserve(CLE, parJour, TTL);
    return parJour;
  } catch (e: any) {
    console.warn('[BOUTIQUE] Injoignable :', e?.message);
    // Une réserve périmée reste une réserve : elle vient de la caisse, ce que
    // la base ne peut pas dire d'elle-même. Mieux vaut un chiffre d'il y a une
    // heure qu'un chiffre calculé autrement.
    if (enReserve && Object.keys(enReserve.contenu ?? {}).length) {
      console.warn('[BOUTIQUE] Chiffre resservi depuis la réserve périmée.');
      return enReserve.contenu;
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
