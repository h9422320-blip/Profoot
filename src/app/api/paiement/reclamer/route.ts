import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/subscription';
import { createAdminClient } from '@/lib/supabase-admin';
import { demanderRattachement } from '@/lib/reclamation-paiement';

export const dynamic = 'force-dynamic';

/**
 * « J'AI PAYÉ AVEC UNE AUTRE ADRESSE. »
 *
 * L'abonné connecté indique l'adresse utilisée sur la boutique. Si un paiement
 * encaissé et non servi existe sous cette adresse, un lien de confirmation
 * part DANS CETTE BOÎTE — pas ailleurs. Le clic ouvre l'accès sur le compte
 * qui a fait la demande.
 *
 * LA RÉPONSE NE DIT JAMAIS SI UN PAIEMENT EXISTE.
 *
 * Elle est identique dans tous les cas. Autrement, cette route deviendrait un
 * moyen de savoir qui est client de ProFoot : il suffirait d'essayer des
 * adresses une à une. Voir `reclamation-paiement.ts`.
 */
export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  let email = '';
  try {
    const corps = await req.json();
    email = String(corps?.email ?? '');
  } catch {
    return NextResponse.json({ recue: false, motif: 'adresse_invalide' }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'https://profootai.com';

  try {
    const r = await demanderRattachement(createAdminClient(), guard.user.id, email, baseUrl);

    if (!r.recue) {
      const statut = r.motif === 'trop_de_demandes' ? 429 : 400;
      return NextResponse.json(r, { status: statut });
    }

    // Le message est le même qu'il y ait une vente ou non. Il est rédigé pour
    // rester vrai dans les deux cas : on parle de ce qu'on a fait, pas de ce
    // qu'on a trouvé.
    return NextResponse.json({
      recue: true,
      message:
        "Si un paiement a bien été fait avec cette adresse, un lien de confirmation vient d'y être envoyé. " +
        'Ouvrez cette boîte et cliquez sur le lien : votre accès s’ouvrira aussitôt.',
    });
  } catch (e: any) {
    console.error('[RECLAMATION] Demande impossible :', e?.message ?? e);
    return NextResponse.json({ recue: false, motif: 'echec' }, { status: 500 });
  }
}
