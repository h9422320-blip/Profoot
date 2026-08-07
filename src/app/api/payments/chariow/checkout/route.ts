import { NextResponse } from 'next/server';
import { requireUser, PLANS, PlanKey } from '@/lib/subscription';
import { initCheckout } from '@/lib/chariow';

export async function POST(req: Request) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return guard.response;
    const { user, entitlements } = guard;

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan as PlanKey;
    if (plan !== 'monthly' && plan !== 'yearly') {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
    }

    // Un abonné annuel actif n'a rien de plus à acheter.
    if (entitlements.plan === 'YEARLY' && plan === 'yearly') {
      return NextResponse.json(
        { error: 'Votre abonnement Annuel est déjà actif.', code: 'ALREADY_SUBSCRIBED' },
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
