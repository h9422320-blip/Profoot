import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { ChariowSale } from '@/lib/chariow';
import { activateSubscriptionFromSale } from '@/lib/subscription-activation';

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

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

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

    const userId = sale.custom_metadata?.user_id;
    if (!userId) {
      // Vente hors application (achat direct sur la boutique) : sera rattachée
      // par la route de réconciliation quand l'utilisateur se connectera.
      console.warn(`Vente Chariow ${sale.id} sans user_id — en attente de réconciliation.`);
      return NextResponse.json({ received: true, status: 'unmatched' });
    }

    const result = await activateSubscriptionFromSale(admin, sale, userId);
    if (!result.activated) {
      console.error(`Vente ${sale.id} non activée : ${result.reason}`);
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }

    return NextResponse.json({ received: true, status: 'activated', plan: result.plan });
  } catch (error) {
    console.error('Erreur webhook Chariow:', error);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}
