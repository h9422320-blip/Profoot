import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { ChariowSale } from '@/lib/chariow';
import { activateSubscriptionFromSale } from '@/lib/subscription-activation';
import { trouverAcheteur, marquerIntentionHonoree, intentionMatch } from '@/lib/payment-intents';

/**
 * Webhook Chariow (Pulse). Point d'entrée principal de l'activation
 * automatique des abonnements.
 *
 * Sécurité, dans l'ordre :
 *  1. Signature HMAC-SHA256 du corps brut (x-chariow-signature) — rejette
 *     toute requête qui ne vient pas de Chariow.
 *  2. Idempotence sur x-pulse-delivery-id — un réessai Chariow ne retraite rien.
 *  3. user_id lu depuis custom_metadata, écrit par NOTRE serveur au checkout —
 *     le client ne peut pas le falsifier.
 *  4. resolvePaidPlan croise produit + métadonnées + montant XOF.
 */

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CHARIOW_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const received = signatureHeader.replace(/^sha256=/, '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  const a = Buffer.from(received, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * CETTE PORTE NE S'OUVRE PLUS.
 *
 * ── POURQUOI ELLE N'EST PAS SIMPLEMENT SUPPRIMÉE ──────────────────────────
 *
 * C'est l'adresse que l'ancienne boutique prévenait quand une vente
 * aboutissait. Elle est fermée depuis le 27 août 2026 et la vente passe par
 * MakeTou : plus aucun message légitime ne peut arriver ici.
 *
 * Or une adresse qui ouvre des accès et que plus personne de confiance
 * n'utilise est un risque pur : elle ne peut plus rien apporter, et n'importe
 * qui peut encore y frapper. On la garde — rien ne se supprime — mais elle
 * n'ouvre plus rien.
 *
 * Elle répond 200 : un refus franc apprendrait à un curieux que l'adresse
 * existe et qu'elle a compté.
 */
const PORTE_FERMEE = true;

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    if (PORTE_FERMEE) {
      console.warn(
        `[CHARIOW] Message reçu sur le webhook fermé (${rawBody.length} octets) — ignoré. ` +
          `La vente passe par MakeTou depuis le 28 août 2026.`
      );
      return NextResponse.json({ received: true });
    }

    if (!verifySignature(rawBody, req.headers.get('x-chariow-signature'))) {
      return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventName: string = req.headers.get('x-pulse-event') || event?.event || '';

    // Seule la vente réussie déclenche une activation ; on accuse réception du
    // reste pour éviter des réessais inutiles côté Chariow.
    if (eventName !== 'successful.sale') {
      return NextResponse.json({ received: true, status: 'ignored' });
    }

    const admin = createAdminClient();

    // Idempotence : première insertion gagne, les réessais s'arrêtent ici.
    const deliveryId = req.headers.get('x-pulse-delivery-id') || `no-delivery-id:${event?.sale?.id}`;
    const { error: dedupeError } = await admin
      .from('webhook_events')
      .insert({ provider: 'chariow', delivery_id: deliveryId, event: eventName, payload: event });
    if (dedupeError) {
      if (dedupeError.code === '23505') {
        return NextResponse.json({ received: true, status: 'duplicate' });
      }
      console.error('Erreur journalisation webhook:', dedupeError);
      // On continue : l'activation reste idempotente via chariow_sale_id.
    }

    const sale: ChariowSale | undefined = event?.sale;
    if (!sale?.id) {
      return NextResponse.json({ error: 'Payload sans vente.' }, { status: 400 });
    }
    if (sale.custom_metadata?.app && sale.custom_metadata.app !== 'profoot') {
      return NextResponse.json({ received: true, status: 'ignored' });
    }
    sale.product = sale.product ?? event?.product;

    // ── L'ADMINISTRATION N'A RIEN À APPRENDRE ICI ──────────────────────────
    //
    // Les recettes affichées dans l'administration interrogent la caisse Chariow
    // à chaque affichage — deux requêtes, moins d'une seconde. Une vente
    // encaissée y apparaît donc au rechargement suivant, sans que ce webhook ait
    // à prévenir qui que ce soit.
    //
    // Une version précédente effaçait ici un cache de cinq minutes. Le cache a
    // disparu, et cette ligne avec : il n'y a plus de décalage à rattraper.

    const acheteur = await trouverAcheteur(admin, sale);
    if (!acheteur) {
      // Achat direct sur la boutique Chariow, sans passer par l'application :
      // aucune intention n'a été enregistrée. Sera rattaché par la route de
      // réconciliation quand l'utilisateur se connectera.
      console.warn(`Vente Chariow ${sale.id} sans acheteur identifiable — en attente de réconciliation.`);
      return NextResponse.json({ received: true, status: 'unmatched' });
    }

    // ── ACHAT D'UN MATCH À L'UNITÉ ────────────────────────────────────────────
    //
    // Aiguillage AVANT l'activation d'abonnement, et sur notre propre trace
    // plutôt que sur le produit annoncé par la boutique : c'est nous qui avons
    // écrit `match_key` au moment du checkout, personne ne peut la falsifier.
    // Sans cette bifurcation, `resolvePaidPlan` ne reconnaîtrait pas le produit
    // et renverrait 422 — le client serait débité sans rien recevoir.
    const achatMatch = await intentionMatch(admin, sale.id);
    if (achatMatch) {
      if (sale.status !== 'completed' && sale.status !== 'settled') {
        return NextResponse.json({ received: true, status: 'pending' });
      }

      // ── UNE VENTE À L'UNITÉ NE DEVIENT JAMAIS UN ABONNEMENT ────────────
      //
      // L'achat à l'unité a été retiré du catalogue le 2 septembre 2026 : plus
      // aucune intention de ce type ne peut être créée. Mais la RECONNAISSANCE
      // reste, et elle est indispensable.
      //
      // Sans elle, une vieille vente à 600 FCFA arrivant en retard tomberait
      // dans l activation d abonnement et ouvrirait un abonnement de
      // trente jours : 2 000 FCFA de service offerts contre 600 encaissés, sur
      // une rencontre jouée depuis des semaines.
      //
      // On la reconnaît, on la marque honorée, et on accuse réception — sans
      // quoi la boutique réessaierait pendant des heures.
      await marquerIntentionHonoree(admin, sale.id);
      return NextResponse.json({ received: true, status: 'match_unique_retire' });
    }

    const result = await activateSubscriptionFromSale(admin, sale, acheteur.userId);
    if (result.activated) await marquerIntentionHonoree(admin, sale.id);
    if (!result.activated) {
      // Vente déjà créditée : accusé de réception normal, sinon Chariow
      // réessaierait pendant des heures pour rien.
      if (result.reason === 'Vente déjà créditée.') {
        return NextResponse.json({ received: true, status: 'already_credited' });
      }
      console.error(`Vente ${sale.id} non activée : ${result.reason}`);
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }

    return NextResponse.json({ received: true, status: 'activated', plan: result.plan });
  } catch (error) {
    console.error('Erreur webhook Chariow:', error);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}
