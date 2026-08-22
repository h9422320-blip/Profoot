import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { ChariowSale } from '@/lib/chariow';
import { debloquerMatch } from '@/lib/match-unique';
import { activateSubscriptionFromSale } from '@/lib/subscription-activation';
import { trouverAcheteur, marquerIntentionHonoree, intentionMatch } from '@/lib/payment-intents';
import { oublierRecettes } from '@/lib/recettes-boutique';

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

    // ── L'ADMINISTRATION APPREND LA VENTE MAINTENANT ─────────────────────────
    //
    // Les recettes affichées dans l'administration sont lues chez Chariow et
    // gardées quelques minutes en réserve, sinon chaque affichage coûterait une
    // douzaine d'appels. On efface cette réserve dès qu'une vente est encaissée :
    // le prochain affichage repart de la caisse et montre la commande.
    //
    // C'EST ICI, ET PAS PLUS BAS, POUR UNE RAISON PRÉCISE. La suite de cette
    // route s'arrête net quand l'acheteur n'est pas identifiable — un achat fait
    // directement sur la boutique, sans passer par l'application. Ces ventes-là
    // sont pourtant de l'argent reçu : il y en avait trois sur la seule semaine
    // du 16 août 2026, et ce sont exactement celles que la base ne voit pas.
    // Placé après le `return`, l'effacement les aurait manquées.
    //
    // Une réserve qu'on n'arrive pas à effacer ne doit pas faire échouer un
    // paiement : au pire, le chiffre s'actualise cinq minutes plus tard.
    if (sale.status === 'completed' || sale.status === 'settled') {
      await oublierRecettes().catch((e) =>
        console.warn('[WEBHOOK] Réserve des recettes non effacée :', e?.message)
      );
    }

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

      const resultat = await debloquerMatch({
        userId: acheteur.userId,
        matchKey: achatMatch.matchKey,
        saleId: sale.id,
        equipe1Nom: achatMatch.equipe1Nom,
        equipe2Nom: achatMatch.equipe2Nom,
        montant: sale.amount?.value ?? null,
        devise: sale.amount?.currency ?? 'XOF',
      });

      if (!resultat.debloque) {
        console.error(`Match non débloqué pour la vente ${sale.id} : ${resultat.raison}`);
        return NextResponse.json({ error: resultat.raison }, { status: 422 });
      }

      await marquerIntentionHonoree(admin, sale.id);
      return NextResponse.json({ received: true, status: 'match_debloque' });
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
