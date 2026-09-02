import { NextResponse } from 'next/server';
import { getSessionEntitlements, PLANS, UNLIMITED } from '@/lib/subscription';
import { getQuotaState } from '@/lib/analysis-quota';
import { lireOffres } from '@/lib/offres';

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

    // La MOINS CHÈRE des offres qui ouvrent l'Agent VIP.
    //
    // L'Agent VIP n'est plus réservé à l'offre annuelle : les trois offres y
    // donnent accès. Une page qui continuerait d'annoncer « 30 000 FCFA/an »
    // pour y entrer ferait fuir quelqu'un qui pouvait l'obtenir pour 2 000.
    const offres = await lireOffres().catch(() => null);
    const offreVip = offres
      ? (Object.values(offres)
          .filter((o) => o.agentVip)
          .sort((a, b) => a.prixXof - b.prixXof)[0] ?? null)
      : null;

    return NextResponse.json({
      // isPro conservé pour compatibilité avec l'interface existante.
      isPro: entitlements.premium,
      offreVip: offreVip && {
        cle: offreVip.cle,
        libelle: offreVip.libelle,
        prixXof: offreVip.prixXof,
        dureeJours: offreVip.dureeJours,
      },
      premium: entitlements.premium,
      vip: entitlements.vip,
      plan: entitlements.plan,
      // ── L'OFFRE QUE L'ABONNÉ A DÉJÀ, POUR POUVOIR LA RECHARGER ──────────
      //
      // Un abonné à sec doit pouvoir racheter EN UN CLIC, sans repasser par la
      // page des tarifs. Mesuré le 24 août 2026 : celui qui a fini ses vingt
      // analyses repaye vingt-sept fois plus que celui à qui il en reste —
      // 18,8 % contre 0,7 %. C'est le compteur à zéro qui fait revenir, et
      // c'est à cet instant précis qu'il faut lui tendre le bouton.
      //
      // ── ET C'EST SON PROPRE NIVEAU, JAMAIS L'OFFRE D'ENTRÉE ────────────
      //
      // Les droits retiennent l'abonnement le plus élevé, et un niveau égal ou
      // inférieur ne remplace jamais celui en cours. Un abonné Pro qui
      // rachèterait l'Essentiel garderait donc son abonnement Pro, période
      // inchangée : son compteur ne repartirait pas, et ses deux mille francs
      // seraient perdus. Le rachat doit porter sur le MÊME plan.
      offreActuelle: (() => {
        const cleCourante = (Object.keys(PLANS) as (keyof typeof PLANS)[]).find(
          (k) => PLANS[k].tier === entitlements.plan
        );
        if (!cleCourante || !entitlements.premium) return null;
        const reglee = offres?.[cleCourante];
        return {
          cle: cleCourante,
          libelle: PLANS[cleCourante].label,
          // Le prix RÉELLEMENT réglé dans l'administration, jamais celui écrit
          // dans le code : ils divergent dès le premier changement de tarif.
          prixXof: reglee?.prixXof ?? PLANS[cleCourante].amountXof,
        };
      })(),
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
