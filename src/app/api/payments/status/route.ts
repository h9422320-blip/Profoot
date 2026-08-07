import { NextResponse } from 'next/server';
import { getSessionEntitlements } from '@/lib/subscription';

/**
 * Droits d'accès de l'utilisateur connecté — seule source que le frontend
 * consulte. Le frontend AFFICHE ces droits ; il ne les décide jamais :
 * chaque route API refait sa propre vérification serveur.
 */
export async function GET() {
  try {
    const { user, entitlements } = await getSessionEntitlements();
    if (!user) {
      return NextResponse.json({ isPro: false, error: 'Non autorisé' }, { status: 401 });
    }

    return NextResponse.json({
      // isPro conservé pour compatibilité avec l'interface existante.
      isPro: entitlements.premium,
      premium: entitlements.premium,
      vip: entitlements.vip,
      plan: entitlements.plan,
      expiresAt: entitlements.expiresAt,
      isAdmin: entitlements.isAdmin,
    });
  } catch (error) {
    console.error('Erreur API statut:', error);
    return NextResponse.json({ isPro: false, error: 'Erreur inattendue' }, { status: 500 });
  }
}
