/**
 * Offres modifiables depuis l'administration.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Les prix et les quotas vivaient dans le code : chaque essai tarifaire
 * demandait une modification, une relecture et un redéploiement, pour changer
 * un nombre. Un lancement se règle en tâtonnant.
 *
 * CE QUI EST ÉDITABLE, ET CE QUI NE L'EST PAS
 *
 * Éditables : le prix, le nombre d'analyses, l'accès à l'Agent VIP.
 * Figés dans le code : la durée, le niveau, et les montants historiques.
 *
 * Cette séparation n'est pas arbitraire. Les montants historiques servent à
 * reconnaître les paiements déjà encaissés : un abonné ayant payé 3 000 FCFA
 * doit continuer d'être reconnu après le passage à 2 000. Une faute de frappe
 * sur une durée casserait des abonnements en cours ; une faute de frappe sur un
 * prix ne fait que changer un prix.
 */

import { createAdminClient } from './supabase-admin';
import { PLANS, PlanKey, UNLIMITED } from './subscription';

export interface OffreEditable {
  cle: PlanKey;
  libelle: string;
  prixXof: number;
  /** `UNLIMITED` pour une offre sans limite. */
  limiteAnalyses: number;
  agentVip: boolean;
  /** Durée en jours — non modifiable, elle gouverne les abonnements en cours. */
  dureeJours: number;
  modifieeLe: string | null;
  modifieePar: string | null;
}

/**
 * Valeurs de repli, identiques à celles du code.
 *
 * Servent quand la table n'existe pas encore ou qu'elle est injoignable :
 * l'application doit continuer à vendre, jamais s'arrêter parce qu'une lecture
 * a échoué.
 */
function depuisLeCode(cle: PlanKey): OffreEditable {
  const p = PLANS[cle];
  return {
    cle,
    libelle: p.label,
    prixXof: p.amountXof,
    limiteAnalyses: p.analysisLimit,
    agentVip: p.vip,
    dureeJours: p.durationDays,
    modifieeLe: null,
    modifieePar: null,
  };
}

export const CLES_OFFRES = Object.keys(PLANS) as PlanKey[];

/**
 * Cache mémoire court.
 *
 * Les offres sont lues à chaque analyse, à chaque affichage de tarif et à
 * chaque validation de paiement. Une requête à chaque fois serait du gaspillage
 * pur — mais un cache long ferait attendre plusieurs minutes avant qu'un
 * changement de prix ne se voie, alors que c'est précisément ce qu'on veut
 * pouvoir faire vite. Trente secondes : le changement se voit presque
 * immédiatement, la charge reste nulle.
 */
const DUREE_CACHE_MS = 30_000;
let cache: { valeurs: Record<PlanKey, OffreEditable>; expire: number } | null = null;

/** Vide le cache — appelé après une modification depuis l'administration. */
export function invaliderCacheOffres() {
  cache = null;
}

export async function lireOffres(): Promise<Record<PlanKey, OffreEditable>> {
  if (cache && Date.now() < cache.expire) return cache.valeurs;

  const valeurs = Object.fromEntries(
    CLES_OFFRES.map((c) => [c, depuisLeCode(c)])
  ) as Record<PlanKey, OffreEditable>;

  try {
    const { data, error } = await createAdminClient().from('offres').select('*');
    if (error) throw new Error(error.message);

    for (const ligne of data ?? []) {
      const cle = ligne.cle as PlanKey;
      if (!valeurs[cle]) continue; // Offre inconnue du code : ignorée.
      valeurs[cle] = {
        ...valeurs[cle],
        prixXof: Number(ligne.prix_xof) || valeurs[cle].prixXof,
        limiteAnalyses: Number(ligne.limite_analyses) === -1 ? UNLIMITED : Number(ligne.limite_analyses),
        agentVip: !!ligne.agent_vip,
        modifieeLe: ligne.modifiee_le ?? null,
        modifieePar: ligne.modifiee_par ?? null,
      };
    }
  } catch (e: any) {
    // La table n'existe pas encore, ou la base ne répond pas. On sert les
    // valeurs du code plutôt que de bloquer la vente.
    console.warn('[OFFRES] Lecture impossible, valeurs du code utilisées :', e?.message);
  }

  cache = { valeurs, expire: Date.now() + DUREE_CACHE_MS };
  return valeurs;
}

/** Une offre précise, avec repli sur le code. */
export async function lireOffre(cle: PlanKey): Promise<OffreEditable> {
  return (await lireOffres())[cle] ?? depuisLeCode(cle);
}

export interface ModificationOffre {
  cle: PlanKey;
  prixXof: number;
  limiteAnalyses: number; // -1 pour illimité
  agentVip: boolean;
}

/**
 * Enregistre les offres modifiées.
 *
 * Les valeurs sont contrôlées ici et pas seulement dans le formulaire : une
 * action serveur est une adresse appelable directement. Un prix négatif ou un
 * quota aberrant ne doit pas pouvoir entrer en base.
 */
export async function ecrireOffres(
  modifications: ModificationOffre[],
  parQui: string
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  for (const m of modifications) {
    if (!CLES_OFFRES.includes(m.cle)) return { ok: false, erreur: `Offre inconnue : ${m.cle}` };
    if (!Number.isFinite(m.prixXof) || m.prixXof <= 0)
      return { ok: false, erreur: `Prix invalide pour ${PLANS[m.cle].label}.` };
    if (!Number.isFinite(m.limiteAnalyses) || (m.limiteAnalyses < 0 && m.limiteAnalyses !== -1))
      return { ok: false, erreur: `Nombre d'analyses invalide pour ${PLANS[m.cle].label}.` };
  }

  const { error } = await createAdminClient().from('offres').upsert(
    modifications.map((m) => ({
      cle: m.cle,
      prix_xof: Math.round(m.prixXof),
      limite_analyses: Math.round(m.limiteAnalyses),
      agent_vip: m.agentVip,
      modifiee_le: new Date().toISOString(),
      modifiee_par: parQui,
    })),
    { onConflict: 'cle' }
  );

  if (error) {
    const manquante = /relation .*offres.* does not exist|schema cache/i.test(error.message);
    return {
      ok: false,
      erreur: manquante
        ? "La table des offres n'existe pas encore. Exécutez le script SQL fourni dans Supabase."
        : error.message,
    };
  }

  invaliderCacheOffres();
  return { ok: true };
}
