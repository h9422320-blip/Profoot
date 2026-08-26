/**
 * L'ACCÈS S'OUVRE AU MOMENT OÙ LE CLIENT S'EN APERÇOIT.
 *
 * ── LE 26 AOÛT 2026, KEVINE NDEMBO ────────────────────────────────────────
 *
 *     12h22   il paie 2 000 FCFA par MTN MoMo — la boutique dit « completed »
 *             rien ne s'ouvre
 *     13h50   il réessaie, n'achève pas : il a compris qu'il paierait deux fois
 *     14h15   il écrit au propriétaire
 *     15h16   un humain ouvre son accès à la main
 *
 * Pendant ces trois heures, l'application lui servait l'aperçu gratuit — 15 %
 * de l'analyse. Il voyait donc le produit marcher sans y avoir droit, après
 * avoir payé. C'est le pire des cas : ce n'est pas une panne visible, c'est
 * l'application qui lui dit calmement qu'il n'est pas client.
 *
 * ── POURQUOI LES DEUX FILETS EXISTANTS NE L'ONT PAS ATTRAPÉ ───────────────
 *
 * Le passage normal est la notification de la boutique, et il marche : mesuré
 * sur 98 abonnements, 90 % s'ouvrent en moins de deux minutes, médiane 45
 * secondes. Kevine est tombé dans les 10 % restants.
 *
 * Le second filet — le rattrapage complet — ne s'exécute qu'une fois par nuit,
 * dans la tâche planifiée. Et cette tâche ne se déclenchait pas tous les jours :
 * sur douze jours, elle n'est allée au bout que cinq fois.
 *
 * Deux défaillances rares se sont additionnées sur le dos du même client.
 *
 * ── CE QUE FAIT CE FICHIER, ET QUAND ──────────────────────────────────────
 *
 * Il se place à l'endroit exact où le tort se produit : le calcul des droits,
 * juste avant de conclure « cette personne est gratuite ». Si elle a payé, la
 * conclusion est fausse, et c'est LÀ qu'il faut le savoir — pas douze heures
 * plus tard.
 *
 * Il ne remplace aucun des deux filets. Il les complète par le seul angle
 * qu'ils n'ont pas : l'instant où quelqu'un regarde son écran et ne comprend
 * pas.
 *
 * ── CE QUI L'EMPÊCHE DE COÛTER CHER ───────────────────────────────────────
 *
 * Interroger la boutique pour chaque visiteur gratuit serait ruineux : ils sont
 * plus de cinq mille. Deux verrous, dans cet ordre :
 *
 *   1. une lecture en base d'abord — a-t-elle seulement CLIQUÉ sur payer ces
 *      quatorze derniers jours ? La quasi-totalité des gratuits s'arrête ici,
 *      sans qu'aucun appel externe ne parte ;
 *   2. une mémoire courte ensuite : une même personne n'est pas revérifiée
 *      avant plusieurs minutes, même si elle recharge dix fois.
 *
 * Et un délai enveloppe le tout : si la boutique tarde, on rend la main et la
 * personne garde l'aperçu — c'est ce qu'elle avait de toute façon. Un filet ne
 * doit jamais devenir la raison pour laquelle la page ne s'affiche pas.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { avecDelai, DELAIS } from './delai-securite';

/** Au-delà, une intention non honorée n'est plus un incident mais un abandon. */
const FENETRE_JOURS = 14;

/** Une même personne n'est pas réinterrogée plus souvent que ça. */
const MEMOIRE_MS = 5 * 60_000;

/**
 * Qui a déjà été vérifié récemment, et quand.
 *
 * Mémoire d'instance, volontairement : elle meurt avec le serveur, ce qui n'a
 * aucune conséquence — au pire on revérifie une fois de plus. Une table en base
 * coûterait une écriture par visiteur pour économiser un appel rare.
 */
const dejaVu = new Map<string, number>();

/** Empêche la carte de grossir indéfiniment sur une instance de longue vie. */
function oublierLesVieux(maintenant: number) {
  if (dejaVu.size < 5000) return;
  for (const [cle, quand] of dejaVu) {
    if (maintenant - quand > MEMOIRE_MS) dejaVu.delete(cle);
  }
}

export interface ResultatOuverture {
  ouvert: boolean;
  plan?: string;
  saleId?: string;
}

/**
 * Ouvre l'accès d'une personne qui a payé, si elle a payé.
 *
 * Ne lève jamais : appelée depuis le calcul des droits, une exception ici
 * priverait d'analyse quelqu'un qui n'a rien demandé.
 *
 * @param admin  Client de service — l'écriture d'un abonnement l'exige.
 * @param user   L'utilisateur dont les droits viennent d'être jugés « gratuit ».
 */
export async function ouvrirAccesPayeSiBesoin(
  admin: SupabaseClient,
  user: User
): Promise<ResultatOuverture> {
  const email = user.email?.toLowerCase().trim();
  if (!email) return { ouvert: false };

  const maintenant = Date.now();
  const vu = dejaVu.get(user.id);
  if (vu && maintenant - vu < MEMOIRE_MS) return { ouvert: false };

  try {
    // ── VERROU 1 — a-t-elle seulement essayé de payer ? ──────────────────
    //
    // Une lecture indexée sur `user_id`. Pour l'immense majorité des visiteurs
    // gratuits, la réponse est « aucune ligne » et tout s'arrête ici.
    const depuis = new Date(maintenant - FENETRE_JOURS * 86_400_000).toISOString();
    const { data: intentions } = await avecDelai<any>(
      admin
        .from('payment_intents')
        .select('sale_id, created_at')
        .eq('user_id', user.id)
        .is('consumed_at', null)
        .gt('created_at', depuis)
        .limit(1),
      DELAIS.secondaire,
      { data: null },
      'intentions de paiement'
    );

    // On note le passage DANS TOUS LES CAS : sans ligne à vérifier, la réponse
    // ne changera pas dans les cinq minutes qui viennent.
    dejaVu.set(user.id, maintenant);
    oublierLesVieux(maintenant);

    if (!intentions?.length) return { ouvert: false };

    // ── VERROU 2 — la boutique confirme-t-elle un encaissement ? ─────────
    const { listCompletedSalesByEmail } = await import('./chariow');
    const ventes = await avecDelai(
      listCompletedSalesByEmail(email),
      DELAIS.page,
      [],
      'ventes encaissées de l’acheteur'
    );
    if (!ventes.length) return { ouvert: false };

    // Ce qui a déjà été servi ne se resert pas : `activateSubscriptionFromSale`
    // le refuserait, mais autant ne pas l'appeler pour rien.
    const { data: abos } = await avecDelai<any>(
      admin.from('subscriptions').select('chariow_sale_id').eq('user_id', user.id),
      DELAIS.secondaire,
      { data: [] },
      'abonnements existants'
    );
    const servies = new Set((abos ?? []).map((a: any) => a.chariow_sale_id).filter(Boolean));

    const { activateSubscriptionFromSale } = await import('./subscription-activation');

    // La plus récente d'abord : c'est celle que la personne vient de payer et
    // dont elle attend l'effet devant son écran.
    const aOuvrir = ventes
      .filter((v: any) => !servies.has(v.id))
      .sort(
        (a: any, b: any) =>
          Date.parse(b.completed_at ?? b.created_at ?? 0) -
          Date.parse(a.completed_at ?? a.created_at ?? 0)
      );

    for (const vente of aOuvrir) {
      const r = await activateSubscriptionFromSale(admin, vente as any, user.id);
      if (r.activated) {
        console.warn(
          `[ACCÈS IMMÉDIAT] ${email} : accès ${r.plan} ouvert à la volée (vente ${(vente as any).id}). ` +
            `La notification de la boutique ne nous est pas parvenue.`
        );
        // La mémoire est levée : la personne a maintenant un abonnement, et le
        // prochain calcul de droits le verra sans repasser par ici.
        dejaVu.delete(user.id);
        return { ouvert: true, plan: r.plan, saleId: (vente as any).id };
      }
    }
  } catch (e: any) {
    // Un filet qui tombe ne doit pas emporter la page avec lui.
    console.warn('[ACCÈS IMMÉDIAT] Vérification impossible :', e?.message);
  }

  return { ouvert: false };
}
