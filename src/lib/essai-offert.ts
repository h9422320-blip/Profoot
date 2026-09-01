/**
 * UNE ANALYSE COMPLÈTE, OFFERTE UNE FOIS.
 *
 * ── LE CHIFFRE QUI A DÉCIDÉ DE CE FICHIER ─────────────────────────────────
 *
 * Au 1er septembre 2026, sur 5 052 personnes qui ont essayé l'application sans
 * jamais payer :
 *
 *     2 767 ont lancé UNE analyse et ne sont jamais revenues
 *
 * C'est la moitié d'entre elles. Le compte gratuit avait un quota de zéro :
 * dès la toute première analyse, on voyait 15 % du contenu et un mur de
 * paiement. La personne découvrait le prix avant d'avoir découvert la valeur.
 *
 * Ces 2 767 personnes n'ont jamais vu une analyse complète de leur vie. On leur
 * demandait d'acheter ce qu'elles n'avaient pas pu regarder.
 *
 * ── POURQUOI UNE SEULE, ET POUR TOUJOURS ──────────────────────────────────
 *
 * Une suffit à comprendre : scénarios, xG, score annoncé, indice de confiance.
 * C'est une démonstration, pas un abonnement déguisé.
 *
 * Elle n'est PAS mensuelle. Un cadeau qui revient tous les mois n'est plus un
 * cadeau, c'est une offre gratuite — et personne ne paie pour ce qu'il finit
 * par obtenir en attendant.
 *
 * ── POURQUOI LE MATCH EST MÉMORISÉ AVEC L'ESSAI ───────────────────────────
 *
 * Sans cela, recharger la page consommerait le cadeau une seconde fois et
 * afficherait l'aperçu à quelqu'un qui venait de recevoir l'analyse complète.
 * Le pire moment possible pour un mur de paiement : juste après avoir montré ce
 * qu'on retire.
 *
 * L'essai est donc lié à UNE rencontre. Tant qu'on revient sur celle-là, on la
 * revoit entière, autant de fois qu'on veut.
 *
 * ── POURQUOI LA TRACE VIT DANS `webhook_events` ───────────────────────────
 *
 * C'est le registre que l'application utilise déjà pour tout ce qui ne doit
 * arriver qu'une fois : livraisons, relances, rattachements. Sa colonne
 * `delivery_id` porte une contrainte d'unicité — vérifiée, pas supposée — et
 * c'est elle qui rend l'opération sûre quand deux analyses partent en même
 * temps. Créer une table pour une ligne par personne aurait ajouté une
 * migration sans rien apporter.
 *
 * ── CE FICHIER NE DÉCIDE JAMAIS « OUI » PAR ACCIDENT ──────────────────────
 *
 * Toute panne — base injoignable, lecture refusée, exception — rend `false`.
 * Refuser à tort un cadeau se rattrape ; offrir le contenu payant à tort, non.
 */

import { createAdminClient } from './supabase-admin';

/** Un identifiant par personne, pour toujours. C'est ce qui rend l'essai unique. */
const cleEssai = (userId: string) => `essai-offert-${userId}`;

export interface Essai {
  /** Cette rencontre-ci doit-elle être servie en entier ? */
  accorde: boolean;
  /** Vrai seulement au tout premier octroi — sert à l'afficher au visiteur. */
  premiereFois: boolean;
}

const REFUS: Essai = { accorde: false, premiereFois: false };

/**
 * Accorde — ou retrouve — l'analyse offerte pour cette rencontre.
 *
 * Trois issues :
 *   • la personne n'a jamais utilisé son essai  → on l'accorde ici, et on le
 *     lie définitivement à cette rencontre ;
 *   • elle l'a déjà utilisé SUR CETTE rencontre → on le lui rend, entier ;
 *   • elle l'a utilisé sur une autre            → aperçu, comme avant.
 *
 * Ne lève jamais.
 */
export async function essaiOffert(
  userId: string,
  matchKey: string,
  equipes?: { equipe1?: string | null; equipe2?: string | null }
): Promise<Essai> {
  if (!userId || !matchKey) return REFUS;

  try {
    const sb = createAdminClient();
    const cle = cleEssai(userId);

    // ── ON TENTE D'ÉCRIRE AVANT DE LIRE, ET C'EST VOLONTAIRE ─────────────
    //
    // Lire puis écrire laisse une fenêtre entre les deux : deux analyses
    // lancées dans la même seconde liraient toutes deux « aucun essai
    // utilisé » et repartiraient toutes deux avec le contenu complet.
    //
    // L'écriture d'abord fait trancher la base : la contrainte d'unicité sur
    // `delivery_id` n'en laisse passer qu'une. La seconde reçoit un 23505,
    // relit la ligne gagnante, et voit qu'elle porte un autre match.
    const { error } = await sb.from('webhook_events').insert({
      provider: 'essai',
      delivery_id: cle,
      event: 'essai_offert_accorde',
      payload: {
        match_key: matchKey,
        equipe1: equipes?.equipe1 ?? null,
        equipe2: equipes?.equipe2 ?? null,
      },
    });

    if (!error) return { accorde: true, premiereFois: true };

    // Autre chose qu'un doublon : panne réelle. On ne devine pas.
    if (error.code !== '23505') {
      console.warn('[ESSAI] Écriture impossible :', error.message);
      return REFUS;
    }

    // Doublon : l'essai existait déjà. Reste à savoir sur quelle rencontre.
    const { data, error: erreurLecture } = await sb
      .from('webhook_events')
      .select('payload')
      .eq('delivery_id', cle)
      .limit(1);

    if (erreurLecture || !data?.length) return REFUS;

    const dejaVu = (data[0] as { payload?: { match_key?: string } })?.payload?.match_key;
    return dejaVu === matchKey ? { accorde: true, premiereFois: false } : REFUS;
  } catch (e) {
    console.warn('[ESSAI] Erreur :', (e as Error)?.message);
    return REFUS;
  }
}

/**
 * L'essai est-il encore disponible ? Question posée SANS le consommer.
 *
 * Sert à l'affichage — annoncer « votre première analyse est offerte » avant
 * que la personne ne clique. Une lecture pure : elle ne décide de rien.
 */
export async function essaiEncoreDisponible(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await createAdminClient()
      .from('webhook_events')
      .select('id')
      .eq('delivery_id', cleEssai(userId))
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) === 0;
  } catch {
    return false;
  }
}
