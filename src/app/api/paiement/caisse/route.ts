import { NextResponse } from 'next/server';
import { requireUser, PLANS, PlanKey, normalizePlan } from '@/lib/subscription';
import { lireOffre } from '@/lib/offres';
import { initCheckout } from '@/lib/chariow';
import { lienMaketou } from '@/lib/maketou-boutique';
import { ipAcheteur } from '@/lib/pays-acheteur';
import { paysRetenu } from '@/lib/pays-paiement';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return guard.response;
    const { user, entitlements } = guard;

    const body = await req.json().catch(() => ({}));

    // ── L'ACHAT À L'UNITÉ N'EXISTE PLUS ──────────────────────────────────
    //
    // Retiré du catalogue par le propriétaire le 2 septembre 2026. Il avait
    // produit DEUX ventes en tout, les 13 août, par la même personne.
    //
    // On refuse explicitement plutôt que de laisser la demande tomber dans la
    // validation de plan : un ancien écran encore ouvert dans un téléphone
    // aurait reçu « Plan invalide », message qui n'explique rien à qui vient
    // de cliquer sur « débloquer ce match ».
    if (body?.type === 'match') {
      return NextResponse.json(
        {
          error: "L'achat à l'unité n'existe plus. L'analyse complète s'obtient avec un accès mensuel.",
          code: 'MATCH_UNIQUE_RETIRE',
        },
        { status: 410 }
      );
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
        { error: 'Votre accès VIP Annuel est déjà actif.', code: 'ALREADY_SUBSCRIBED' },
        { status: 409 }
      );
    }

    // Prix reellement pratique : celui de l'administration, avec repli sur le
    // code. Il doit correspondre au produit Chariow, sinon l'acheteur voit un
    // prix et en paie un autre.
    const prixOffre = (await lireOffre(plan)).prixXof;

    // ── LA VENTE PASSE PAR MAKETOU ──────────────────────────────────────────
    //
    // Chariow a fermé la boutique le 27 août 2026 : vérifié le lendemain, son
    // catalogue est vide et le produit Essentiel rend un 404. Appeler sa caisse
    // ne peut plus rien produire d'autre qu'une erreur affichée à l'acheteur.
    //
    // MakeTou n'a pas de caisse à créer : la page produit est publique et fixe.
    // On la rend telle quelle, et le rattachement se fait au retour, par
    // l'adresse e-mail, quand le pulse arrive.
    const lienBoutique = lienMaketou(plan);
    if (lienBoutique) {
      console.log(`[PAIEMENT] Offre ${plan} — départ vers MakeTou.`);
      return NextResponse.json({
        checkoutUrl: lienBoutique,
        passerelle: 'maketou',
        plan,
        amount: prixOffre,
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';

    // Le pays se relève ICI, et nulle part ailleurs : c'est le seul moment où
    // l'adresse IP en présence est celle de l'acheteur. Passé cette ligne, tout
    // se joue entre notre serveur et Chariow, qui ne voit plus que Vercel.
    const pays = paysRetenu(req.headers, body?.fuseau, body?.pays);
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
        amount: prixOffre,
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
      amount: prixOffre,
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

