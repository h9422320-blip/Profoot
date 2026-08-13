import { NextResponse } from 'next/server';
import { getSessionEntitlements, PLANS, UNLIMITED } from '@/lib/subscription';
import { getQuotaState } from '@/lib/analysis-quota';
import { matchDebloqueParCle } from '@/lib/match-unique';

/**
 * Droits d'accès et consommation de l'utilisateur connecté — seule source que
 * le frontend consulte. Le frontend AFFICHE ces valeurs ; il ne les décide
 * jamais et ne les recalcule pas : chaque route API refait sa propre
 * vérification côté serveur.
 */
export async function GET(req: Request) {
  try {
    const { user, entitlements } = await getSessionEntitlements();
    if (!user) {
      return NextResponse.json({ isPro: false, error: 'Non autorisé' }, { status: 401 });
    }

    const quota = await getQuotaState(user.id, entitlements);

    // Un achat a l unite ne rend pas premium : sans cette reponse, la page de
    // retour apres paiement attendrait indefiniment un abonnement qui ne
    // viendra jamais, et l acheteur croirait avoir paye pour rien.
    const cle = new URL(req.url).searchParams.get('match');
    const matchDebloqueDemande = cle
      ? await matchDebloqueParCle(user.id, cle)
      : null;

    return NextResponse.json({
      // isPro conservé pour compatibilité avec l'interface existante.
      isPro: entitlements.premium,
      premium: entitlements.premium,
      matchDebloque: matchDebloqueDemande,
      vip: entitlements.vip,
      plan: entitlements.plan,
      planLabel:
        entitlements.plan === 'FREE'
          ? 'Gratuit'
          : (Object.values(PLANS).find((p) => p.tier === entitlements.plan)?.label ?? entitlements.plan),
      expiresAt: entitlements.expiresAt,
      isAdmin: entitlements.isAdmin,
      analyses: {
        used: quota.used,
        // `Infinity` ne survit pas au JSON : on l'exprime par un booléen.
        limit: quota.unlimited ? null : quota.limit,
        remaining: quota.unlimited ? null : quota.remaining,
        unlimited: quota.unlimited,
        periodStart: quota.periodStart,
        periodEnd: quota.periodEnd,
      },
    });
  } catch (error) {
    console.error('Erreur API statut:', error);
    return NextResponse.json({ isPro: false, error: 'Erreur inattendue' }, { status: 500 });
  }
}
