import { NextResponse } from 'next/server';
import { requireUser, PLANS, PlanKey, normalizePlan } from '@/lib/subscription';
import { initCheckout } from '@/lib/chariow';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return guard.response;
    const { user, entitlements } = guard;

    const body = await req.json().catch(() => ({}));
    // Le plan demandé est validé contre la liste officielle : le client ne peut
    // pas inventer une offre, et les anciens libellés restent acceptés le temps
    // que les pages en cache se rafraîchissent.
    const plan = normalizePlan(body?.plan) as PlanKey | null;
    if (!plan) {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
    }

    // Un abonné VIP actif n'a rien de plus à acheter : c'est l'offre la plus
    // complète, lui revendre une offre inférieure n'aurait aucun sens.
    if (entitlements.plan === 'VIP' && plan === 'vip_yearly') {
      return NextResponse.json(
        { error: 'Votre abonnement VIP Annuel est déjà actif.', code: 'ALREADY_SUBSCRIBED' },
        { status: 409 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';

    const session = await initCheckout({
      plan,
      userId: user.id,
      email: user.email!,
      firstName: user.user_metadata?.first_name || 'Utilisateur',
      lastName: user.user_metadata?.last_name || 'ProFoot',
      phoneNumber: user.phone || user.user_metadata?.phone || undefined,
      phoneCountryCode: req.headers.get('x-vercel-ip-country') || 'GN',
      redirectUrl: `${baseUrl}/payment-success?plan=${plan}`,
    });

    if (session.step === 'already_purchased') {
      return NextResponse.json(
        { error: 'Ce produit a déjà été acheté avec ce compte.', code: 'ALREADY_PURCHASED' },
        { status: 409 }
      );
    }
    if (!session.checkoutUrl) {
      console.error('Réponse Chariow sans checkout_url:', session);
      return NextResponse.json({ error: 'Réponse invalide de Chariow.' }, { status: 502 });
    }

    // On enregistre QUI achète QUOI, avant même le paiement.
    //
    // Chariow ne conserve pas les métadonnées qu'on lui transmet : sans cette
    // trace, une vente payée revient sans aucun moyen de savoir à quel compte
    // l'attribuer, et le client se retrouve débité sans abonnement.
    if (session.saleId) {
      const { error } = await createAdminClient()
        .from('payment_intents')
        .upsert(
          {
            sale_id: session.saleId,
            user_id: user.id,
            plan,
            email: user.email,
            amount: PLANS[plan].amountXof,
          },
          { onConflict: 'sale_id' }
        );
      if (error) {
        // On n'interrompt pas l'achat : la réconciliation par e-mail reste
        // possible. Mais la trace doit être visible dans les journaux.
        console.error('Intention de paiement non enregistrée:', session.saleId, error.message);
      }
    } else {
      console.error('Chariow n\'a pas renvoyé d\'identifiant de vente au checkout.');
    }

    return NextResponse.json({
      checkoutUrl: session.checkoutUrl,
      plan,
      amount: PLANS[plan].amountXof,
      currency: 'XOF',
    });
  } catch (error: any) {
    console.error('Erreur checkout Chariow:', error);
    // La cause exacte est renvoyée au client : un message générique rend le
    // diagnostic impossible quand l'échec ne survient que sur certains comptes.
    return NextResponse.json(
      { error: `Paiement indisponible : ${error?.message || 'cause inconnue'}` },
      { status: 500 }
    );
  }
}
