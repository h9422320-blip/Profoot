/**
 * D'UN ENCAISSEMENT PAWAPAY À UN ACCÈS OUVERT.
 *
 * ── LA RÈGLE QUI TIENT TOUT LE RESTE ──────────────────────────────────────
 *
 * On n'ouvre JAMAIS un accès sur la foi d'un message reçu. L'adresse de rappel
 * est publique : n'importe qui peut y envoyer un JSON disant « COMPLETED ».
 * Le message ne sert donc qu'à une chose — savoir QU'IL S'EST PASSÉ QUELQUE
 * CHOSE. Le statut, lui, est relu chez PawaPay avec notre propre jeton.
 *
 * PawaPay propose des signatures (RFC-9421, ECDSA P-256). Elles sont
 * facultatives et vérifiables ; on contrôle l'empreinte du corps quand elle
 * est fournie. Mais même une signature parfaite ne remplacerait pas la
 * relecture : elle prouve l'origine du message, pas l'état réel du paiement au
 * moment où on ouvre l'accès.
 *
 * ── POURQUOI LA TABLE DES ABONNEMENTS EST RÉUTILISÉE ──────────────────────
 *
 * Elle porte déjà la contrainte qui compte : `chariow_sale_id` est UNIQUE, et
 * l'écriture passe par un `ON CONFLICT DO NOTHING`. Rejouer dix fois le même
 * encaissement — réessai de PawaPay, rappel manuel, double clic — ne crédite
 * qu'une fois. Recréer cette garantie ailleurs serait la refaire à moitié.
 *
 * Le nom de colonne est hérité, et il est trompeur. Le renommer casserait le
 * chemin de l'autre passerelle, en production, pour un gain cosmétique. Le
 * champ `provider` distingue les deux : « chariow » ou « pawapay ».
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PLANS, type PlanKey } from './subscription';
import { lireStatutDepot } from './pawapay';

export type ResultatActivation =
  | { ouvert: true; plan: PlanKey; expireLe: string }
  | { ouvert: false; motif: string; statut?: string };

/**
 * Ouvre l'accès si — et seulement si — PawaPay confirme l'encaissement.
 *
 * @param admin      Client de service : l'écriture d'un abonnement l'exige.
 * @param depositId  L'identifiant de l'encaissement, notre clé d'idempotence.
 */
export async function ouvrirAccesSiPaye(
  admin: SupabaseClient,
  depositId: string
): Promise<ResultatActivation> {
  // ── ÉTAPE 1 — LA VÉRITÉ VIENT DE PAWAPAY, PAS DU MESSAGE REÇU ─────────
  const lu = await lireStatutDepot(depositId);
  if (!lu.trouve) {
    return { ouvert: false, motif: 'Encaissement introuvable chez PawaPay.' };
  }
  if (lu.statut !== 'COMPLETED') {
    return {
      ouvert: false,
      statut: lu.statut,
      motif:
        lu.statut === 'FAILED'
          ? `Paiement refusé (${lu.codeEchec ?? 'sans code'}).`
          : `Paiement encore en cours (${lu.statut}).`,
    };
  }

  // ── ÉTAPE 2 — RETROUVER QUI A PAYÉ, ET POUR QUELLE OFFRE ──────────────
  //
  // `clientReferenceId` est notre propre identifiant, posé à l'initiation.
  // Sans lui on ne saurait pas à quel compte rattacher l'encaissement — et un
  // paiement sans destinataire est exactement le cas qui a laissé onze clients
  // sans accès le 26 août.
  const reference = lu.reference;
  if (!reference) {
    return { ouvert: false, motif: 'Encaissement sans référence : impossible à rattacher.' };
  }

  const { data: intention } = await admin
    .from('payment_intents')
    .select('user_id, plan, email')
    .eq('sale_id', reference)
    .maybeSingle();

  if (!intention?.user_id) {
    return { ouvert: false, motif: `Aucune intention de paiement pour la référence ${reference}.` };
  }

  const plan = intention.plan as PlanKey;
  const config = PLANS[plan];
  if (!config) {
    return { ouvert: false, motif: `Offre inconnue : ${intention.plan}.` };
  }

  // ── ÉTAPE 3 — LE MONTANT PAYÉ DOIT CORRESPONDRE À L'OFFRE ─────────────
  //
  // Sans ce contrôle, quelqu'un qui initierait un encaissement de cent francs
  // en référençant l'offre VIP obtiendrait un an d'accès. La demande vient de
  // notre serveur, mais l'identifiant de référence circule.
  const paye = Number(lu.montant ?? 0);
  const attendu = config.amountXof;
  const toleres = [attendu, ...(config.montantsPrecedents as readonly number[])];
  if (!toleres.includes(paye)) {
    return {
      ouvert: false,
      motif: `Montant payé (${paye}) incompatible avec l'offre ${plan} (${attendu}).`,
    };
  }

  // ── ÉTAPE 4 — LE TEMPS RESTANT N'EST JAMAIS PERDU ─────────────────────
  const { data: courant } = await admin
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', intention.user_id)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1);

  const finActuelle = courant?.[0]?.expires_at ? Date.parse(courant[0].expires_at) : 0;
  const depart = Math.max(Date.now(), finActuelle);
  const expireLe = new Date(depart + config.durationDays * 86_400_000).toISOString();

  // ── ÉTAPE 5 — CRÉDITER UNE FOIS, ET UNE SEULE ─────────────────────────
  const { data, error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: intention.user_id,
        plan,
        status: 'active',
        provider: 'pawapay',
        chariow_sale_id: depositId,
        amount: paye || attendu,
        currency: lu.devise ?? 'XOF',
        expires_at: expireLe,
      },
      { onConflict: 'chariow_sale_id', ignoreDuplicates: true }
    )
    .select('id');

  if (error) {
    console.error('[PAWAPAY] Écriture de l’accès impossible :', error.message);
    return { ouvert: false, motif: 'Erreur base de données.' };
  }
  if (!data?.length) {
    return { ouvert: false, motif: 'Encaissement déjà crédité.' };
  }

  // L'intention est marquée honorée : c'est ce qui empêche les outils de
  // rattrapage de la reprendre indéfiniment.
  await admin
    .from('payment_intents')
    .update({ consumed_at: new Date().toISOString(), statut_boutique: 'completed' })
    .eq('sale_id', reference);

  console.log(`[PAWAPAY] Accès ${plan} ouvert jusqu'au ${expireLe.slice(0, 10)} (dépôt ${depositId}).`);
  return { ouvert: true, plan, expireLe };
}

/**
 * Note l'issue d'un encaissement sur l'intention correspondante.
 *
 * Appelée pour les statuts NON finaux et pour les échecs : sans elle, on
 * réapprendrait la même chose à chaque rappel, et surtout on n'aurait aucune
 * trace de POURQUOI un paiement a échoué. C'est exactement l'aveuglement qui a
 * laissé 2 106 ventes sans diagnostic chez l'autre passerelle.
 */
export async function noterIssue(
  admin: SupabaseClient,
  reference: string | undefined,
  statut: string,
  codeEchec?: string,
  messageEchec?: string
): Promise<void> {
  if (!reference) return;
  try {
    await admin
      .from('payment_intents')
      .update({
        statut_boutique: statut.toLowerCase(),
        cause_echec: codeEchec ?? null,
        message_echec: messageEchec ?? null,
        releve_le: new Date().toISOString(),
      })
      .eq('sale_id', reference);
  } catch (e: any) {
    console.warn('[PAWAPAY] Note d’issue impossible :', e?.message);
  }
}
