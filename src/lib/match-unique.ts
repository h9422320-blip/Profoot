/**
 * Débloquer un match à l'unité.
 *
 * POURQUOI CETTE OFFRE EXISTE
 *
 * Le plus petit achat possible était un abonnement mensuel. Pour quelqu'un qui
 * découvre l'application, c'est un engagement — et 88 % du trafic vient de
 * comptes qui n'ont jamais payé. Un match à 500 FCFA capte l'impulsion « je
 * veux le pronostic complet de CE match, maintenant », fait entrer le mobile
 * money une première fois, et sert de tremplin vers l'abonnement.
 *
 * CE QUE L'ACHAT DONNE
 *
 * Exactement le même contenu qu'un abonné, pour ce match, et définitivement.
 * Pas de quota consommé : celui-ci reste l'affaire des abonnements.
 */

import { createAdminClient } from './supabase-admin';

/**
 * Prix du déblocage, en francs CFA.
 *
 * Une seule ligne à changer ici, mais le produit doit être modifié EN PARALLÈLE
 * dans la boutique : c'est elle qui encaisse. Un écart entre les deux est
 * détecté par l'audit, qui compare les tarifs publiés à ceux du code.
 */
export const PRIX_MATCH_UNIQUE = 600;

export const LIBELLE_MATCH_UNIQUE = 'Débloquer ce match';

/** Identifiant du produit dans la boutique. */
export const produitMatchUnique = () => process.env.CHARIOW_PRODUCT_ID_MATCH ?? '';

/**
 * L'OFFRE EST ÉTEINTE.
 *
 * Un acheteur a payé et n'a jamais vu son analyse : elle vivait dans l'état de
 * son navigateur, perdu au moment de partir vers la page de paiement. Le
 * parcours de retour a été réparé, mais tant qu'il n'a pas été éprouvé sur un
 * vrai paiement, personne ne doit pouvoir tomber sur cette offre. Encaisser
 * sans livrer coûte infiniment plus cher que de ne pas vendre.
 *
 * Le code reste entier derrière ce commutateur : déblocage, webhook,
 * réconciliation, suivi en administration. Pour rallumer l'offre, il suffira
 * d'ajouter `ACHAT_MATCH_ACTIF=true` — aucune modification de code.
 *
 * Le produit doit AUSSI être configuré : les deux conditions, jamais une seule.
 */
export const matchUniqueDisponible = () =>
  process.env.ACHAT_MATCH_ACTIF === 'true' && !!produitMatchUnique();

/**
 * Identité d'un match, SANS LA DATE.
 *
 * La clé du quota (`buildMatchKey`) contient le jour, ce qui est juste pour un
 * décompte mensuel. Ce serait un piège ici : on vend « ce match », il se joue
 * le lendemain, et l'utilisateur devrait repayer pour relire ce qu'il a déjà
 * acheté. L'ordre est normalisé pour que « PSG vs OM » et « OM vs PSG »
 * désignent la même rencontre.
 */
export function cleMatchDebloque(equipe1Id: string, equipe2Id: string): string {
  const [a, b] = [String(equipe1Id), String(equipe2Id)].sort();
  return `${a}__${b}`;
}

/** Ce compte a-t-il déjà payé pour ce match ? */
export async function matchDebloque(
  userId: string,
  equipe1Id: string,
  equipe2Id: string
): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from('matchs_debloques')
      .select('id')
      .eq('user_id', userId)
      .eq('match_key', cleMatchDebloque(equipe1Id, equipe2Id))
      .limit(1);

    // En cas d'erreur (table absente, base injoignable), on ne débloque pas :
    // le paywall reste en place. Refuser à tort est rattrapable, offrir le
    // contenu payant à tort ne l'est pas.
    if (error) {
      console.warn('[MATCH UNIQUE] Vérification impossible :', error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Enregistre le déblocage après un paiement confirmé.
 *
 * Idempotent par deux verrous : `sale_id` unique empêche qu'un réessai du
 * webhook crédite deux fois, et l'index unique (user_id, match_key) empêche
 * qu'un même compte paie deux fois le même match.
 */
export async function debloquerMatch(params: {
  userId: string;
  matchKey: string;
  saleId: string;
  equipe1Nom?: string | null;
  equipe2Nom?: string | null;
  montant?: number | null;
  devise?: string | null;
}): Promise<{ debloque: boolean; raison?: string }> {
  const { error } = await createAdminClient()
    .from('matchs_debloques')
    .upsert(
      {
        user_id: params.userId,
        match_key: params.matchKey,
        sale_id: params.saleId,
        equipe1_nom: params.equipe1Nom ?? null,
        equipe2_nom: params.equipe2Nom ?? null,
        montant: params.montant ?? PRIX_MATCH_UNIQUE,
        devise: params.devise ?? 'XOF',
      },
      { onConflict: 'sale_id', ignoreDuplicates: true }
    );

  if (error) {
    // Le second verrou : le compte possédait déjà ce match. Ce n'est pas une
    // panne, c'est le comportement voulu.
    if (error.code === '23505') return { debloque: true, raison: 'déjà débloqué' };
    console.error('[MATCH UNIQUE] Déblocage impossible :', error.message);
    return { debloque: false, raison: error.message };
  }

  return { debloque: true };
}

export interface RevenusMatchsUniques {
  nombre: number;
  totalXof: number;
  /** Comptes ayant acheté au moins un match sans jamais s'abonner. */
  acheteursSansAbonnement: number;
  recents: {
    email: string | null;
    userId: string;
    equipes: string;
    montant: number;
    date: string;
  }[];
}

/**
 * Ce que rapportent les achats à l'unité, séparément des abonnements.
 *
 * Les mélanger masquerait précisément ce qu'on cherche à mesurer : est-ce que
 * la petite porte fait entrer des gens qui n'auraient jamais pris d'abonnement ?
 */
export async function getRevenusMatchsUniques(): Promise<RevenusMatchsUniques> {
  const vide: RevenusMatchsUniques = {
    nombre: 0,
    totalXof: 0,
    acheteursSansAbonnement: 0,
    recents: [],
  };

  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('matchs_debloques')
      .select('user_id, equipe1_nom, equipe2_nom, montant, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data?.length) return vide;

    const { data: abos } = await sb
      .from('subscriptions')
      .select('user_id')
      .in('status', ['active', 'trialing']);
    const abonnes = new Set((abos ?? []).map((a: any) => a.user_id));

    const acheteurs = new Set((data as any[]).map((m) => m.user_id));
    const sansAbonnement = [...acheteurs].filter((u) => !abonnes.has(u)).length;

    return {
      nombre: data.length,
      totalXof: (data as any[]).reduce((t, m) => t + (Number(m.montant) || 0), 0),
      acheteursSansAbonnement: sansAbonnement,
      recents: (data as any[]).slice(0, 20).map((m) => ({
        email: null,
        userId: m.user_id,
        equipes:
          m.equipe1_nom && m.equipe2_nom ? `${m.equipe1_nom} — ${m.equipe2_nom}` : 'Match',
        montant: Number(m.montant) || 0,
        date: m.created_at,
      })),
    };
  } catch {
    return vide;
  }
}

/** Variante par clé, pour la page de retour après paiement. */
export async function matchDebloqueParCle(userId: string, matchKey: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from('matchs_debloques')
      .select('id')
      .eq('user_id', userId)
      .eq('match_key', matchKey)
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
