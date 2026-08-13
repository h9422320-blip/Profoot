import { NextResponse } from 'next/server';
import { requireUser, PLANS, PlanKey, normalizePlan } from '@/lib/subscription';
import { initCheckout } from '@/lib/chariow';
import { detecterPaysAcheteur, ipAcheteur } from '@/lib/pays-acheteur';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  PRIX_MATCH_UNIQUE,
  cleMatchDebloque,
  matchDebloque,
  matchUniqueDisponible,
  produitMatchUnique,
} from '@/lib/match-unique';

export async function POST(req: Request) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return guard.response;
    const { user, entitlements } = guard;

    const body = await req.json().catch(() => ({}));

    // ── ACHAT D'UN MATCH À L'UNITÉ ────────────────────────────────────────────
    //
    // Même tunnel, même détection du pays, même trace : seul le produit change.
    // Traité avant la validation du plan, puisqu'il n'y a justement pas de plan.
    if (body?.type === 'match') {
      return await lancerAchatMatch(req, body, user);
    }

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

    // Le pays se relève ICI, et nulle part ailleurs : c'est le seul moment où
    // l'adresse IP en présence est celle de l'acheteur. Passé cette ligne, tout
    // se joue entre notre serveur et Chariow, qui ne voit plus que Vercel.
    const pays = detecterPaysAcheteur(req.headers, body?.fuseau);
    const ip = ipAcheteur(req.headers);

    const session = await initCheckout({
      plan,
      userId: user.id,
      email: user.email!,
      firstName: user.user_metadata?.first_name || 'Utilisateur',
      lastName: user.user_metadata?.last_name || 'ProFoot',
      phoneNumber: user.phone || user.user_metadata?.phone || undefined,
      paysAcheteur: pays.code,
      ipAcheteur: ip,
      redirectUrl: `${baseUrl}/payment-success?plan=${plan}`,
    });

    // Trace volontaire : une mauvaise détection ne se voit pas dans l'interface,
    // elle se voit dans le taux d'abandon, des semaines plus tard. Une source
    // « defaut » qui revient souvent signale que l'en-tête de géolocalisation
    // n'arrive pas jusqu'ici.
    console.log(
      `[PAIEMENT] Offre ${plan} — pays ${pays.code} (source : ${pays.source}) — ` +
        `IP acheteur ${ip ? 'transmise' : 'INTROUVABLE, Chariow retiendra celle du serveur'}.`
    );

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
      // Le rattachement est vital ; l'origine géographique est un confort. Les
      // deux ne doivent donc pas partager le même sort : tant que la migration
      // qui ajoute les colonnes d'origine n'est pas appliquée, l'écriture
      // complète échoue, et sans ce repli le client paierait sans rien recevoir.
      const admin = createAdminClient();
      const essentiel = {
        sale_id: session.saleId,
        user_id: user.id,
        plan,
        email: user.email,
        amount: PLANS[plan].amountXof,
      };
      // Notre propre trace de l'origine de l'acheteur. Elle ne dépend d'aucun
      // service tiers : si le prestataire change sa façon d'afficher les pays,
      // celle-ci reste juste.
      const origine = { pays: pays.code, pays_source: pays.source, ip_acheteur: ip ?? null };

      let { error } = await admin
        .from('payment_intents')
        .upsert({ ...essentiel, ...origine }, { onConflict: 'sale_id' });

      if (error) {
        console.warn(
          `Origine de l'acheteur non enregistrée (${error.message}) — nouvelle tentative sans elle.`
        );
        ({ error } = await admin.from('payment_intents').upsert(essentiel, { onConflict: 'sale_id' }));
      }
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

/**
 * Lance le paiement d'un match à l'unité.
 *
 * L'identité du match est enregistrée dans `payment_intents` AVANT le paiement.
 * C'est indispensable : Chariow ne conserve pas les métadonnées qu'on lui
 * transmet, donc sans cette trace la vente reviendrait payée sans qu'on sache
 * quel match débloquer — le client serait débité pour rien.
 */
async function lancerAchatMatch(req: Request, body: any, user: any) {
  if (!matchUniqueDisponible()) {
    return NextResponse.json(
      { error: "L'achat à l'unité n'est pas encore configuré.", code: 'MATCH_INDISPONIBLE' },
      { status: 503 }
    );
  }

  const equipe1Id = String(body?.equipe1Id ?? '').trim();
  const equipe2Id = String(body?.equipe2Id ?? '').trim();
  if (!equipe1Id || !equipe2Id) {
    return NextResponse.json({ error: 'Match invalide.' }, { status: 400 });
  }

  const matchKey = cleMatchDebloque(equipe1Id, equipe2Id);

  // Ne jamais faire payer deux fois la même chose.
  if (await matchDebloque(user.id, equipe1Id, equipe2Id)) {
    return NextResponse.json(
      { error: 'Ce match est déjà débloqué sur votre compte.', code: 'DEJA_DEBLOQUE' },
      { status: 409 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';

  const pays = detecterPaysAcheteur(req.headers, body?.fuseau);
  const ip = ipAcheteur(req.headers);

  const session = await initCheckout({
    plan: null,
    produitDirect: produitMatchUnique(),
    metadonnees: { match_key: matchKey },
    userId: user.id,
    email: user.email!,
    firstName: user.user_metadata?.first_name || 'Utilisateur',
    lastName: user.user_metadata?.last_name || 'ProFoot',
    phoneNumber: user.phone || user.user_metadata?.phone || undefined,
    paysAcheteur: pays.code,
    ipAcheteur: ip,
    redirectUrl: `${baseUrl}/payment-success?match=${encodeURIComponent(matchKey)}`,
  });

  if (!session.checkoutUrl) {
    console.error('Réponse Chariow sans checkout_url (match) :', session);
    return NextResponse.json({ error: 'Réponse invalide de Chariow.' }, { status: 502 });
  }

  if (session.saleId) {
    const { error } = await createAdminClient()
      .from('payment_intents')
      .upsert(
        {
          sale_id: session.saleId,
          user_id: user.id,
          plan: 'match_unique',
          email: user.email,
          amount: PRIX_MATCH_UNIQUE,
          match_key: matchKey,
          equipe1_nom: String(body?.equipe1Nom ?? '').slice(0, 80) || null,
          equipe2_nom: String(body?.equipe2Nom ?? '').slice(0, 80) || null,
          pays: pays.code,
          pays_source: pays.source,
          ip_acheteur: ip ?? null,
        },
        { onConflict: 'sale_id' }
      );

    if (error) {
      // Sans cette trace, le webhook ne saura pas quel match débloquer. On
      // refuse donc l'achat plutôt que d'encaisser sans pouvoir livrer.
      console.error("Intention d'achat de match non enregistrée :", session.saleId, error.message);
      return NextResponse.json(
        { error: "Impossible de préparer le paiement. Réessayez dans un instant." },
        { status: 500 }
      );
    }
  }

  console.log(
    `[PAIEMENT] Match ${matchKey} — ${PRIX_MATCH_UNIQUE} FCFA — pays ${pays.code} (source : ${pays.source}).`
  );

  return NextResponse.json({ checkoutUrl: session.checkoutUrl, saleId: session.saleId });
}
