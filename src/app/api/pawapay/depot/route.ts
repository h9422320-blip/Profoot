/**
 * DÉMARRER UN ENCAISSEMENT MOBILE MONEY.
 *
 * ── CE QUE CETTE ROUTE REFUSE DE CROIRE ───────────────────────────────────
 *
 * Le montant NE VIENT PAS du navigateur. Il est relu depuis les offres, côté
 * serveur, à partir de la seule chose que le client choisit : laquelle des
 * trois offres il veut. Accepter un montant envoyé par la page reviendrait à
 * laisser n'importe qui acheter le VIP annuel pour cent francs — c'est une
 * adresse appelable directement, pas un formulaire protégé.
 *
 * ── L'IDENTITÉ VIENT DE LA SESSION ────────────────────────────────────────
 *
 * Pas d'identifiant de compte dans le corps de la requête : il serait choisi
 * par l'appelant. On lit la session, et on ouvre l'accès de CETTE personne-là.
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { PLANS, type PlanKey } from '@/lib/subscription';
import { initierDepot, pawapayConfigure, estProduction } from '@/lib/pawapay';
import { lireOffres } from '@/lib/offres';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!pawapayConfigure()) {
    return NextResponse.json(
      { error: "Le paiement mobile money n'est pas encore configuré." },
      { status: 503 }
    );
  }

  // ── QUI DEMANDE ? ───────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  let corps: any = null;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête illisible.' }, { status: 400 });
  }

  const plan = String(corps?.plan ?? '') as PlanKey;
  const telephone = String(corps?.telephone ?? '').replace(/[^0-9]/g, '');
  const operateur = String(corps?.operateur ?? '').trim();
  const pays = String(corps?.pays ?? '').trim().toUpperCase();

  if (!PLANS[plan]) {
    return NextResponse.json({ error: 'Offre inconnue.' }, { status: 400 });
  }
  if (telephone.length < 8 || telephone.length > 15) {
    return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
  }
  if (!operateur) {
    return NextResponse.json({ error: 'Opérateur manquant.' }, { status: 400 });
  }

  // ── LE MONTANT EST LU CHEZ NOUS, JAMAIS REÇU ───────────────────────────
  const offres = await lireOffres().catch(() => null);
  const montant = offres?.[plan]?.prixXof ?? PLANS[plan].amountXof;

  // Notre référence : elle relie l'encaissement au compte, et c'est elle que
  // l'activation relira. Sans elle, un paiement abouti n'aurait aucun
  // destinataire — le cas qui a laissé onze clients sans accès le 26 août.
  const reference = `PAWA-${crypto.randomUUID()}`;
  const depositId = crypto.randomUUID();

  const admin = createAdminClient();
  const { error: erreurIntention } = await admin.from('payment_intents').insert({
    sale_id: reference,
    user_id: user.id,
    email: user.email,
    plan,
    amount: montant,
    pays: pays || null,
    pays_source: 'pawapay',
    moyen_paiement: operateur,
  });
  if (erreurIntention) {
    console.error('[PAWAPAY] Intention non enregistrée :', erreurIntention.message);
    return NextResponse.json({ error: 'Impossible de démarrer le paiement.' }, { status: 500 });
  }

  const r = await initierDepot({
    depositId,
    montant,
    devise: 'XOF',
    telephone,
    operateur,
    reference,
    messageClient: 'ProFoot AI',
  });

  if (!r.accepte) {
    await admin
      .from('payment_intents')
      .update({
        statut_boutique: 'rejected',
        cause_echec: r.codeEchec ?? null,
        message_echec: r.motif ?? null,
        releve_le: new Date().toISOString(),
      })
      .eq('sale_id', reference);

    return NextResponse.json(
      { error: r.motif ?? 'Paiement refusé par la passerelle.', code: r.codeEchec },
      { status: 400 }
    );
  }

  // On conserve le lien entre notre référence et l'identifiant PawaPay : c'est
  // ce qui permettra de retrouver l'encaissement si aucun rappel n'arrive.
  await admin
    .from('payment_intents')
    .update({ message_echec: `depositId:${depositId}`, statut_boutique: 'accepted' })
    .eq('sale_id', reference);

  // « ACCEPTED » n'est PAS « payé ». Le client doit valider sur son téléphone,
  // et c'est le statut final qui ouvrira l'accès. Le dire clairement ici évite
  // que l'écran annonce une réussite qui n'a pas eu lieu.
  return NextResponse.json({
    accepte: true,
    depositId,
    reference,
    environnement: estProduction() ? 'production' : 'sandbox',
    message:
      'Validez la demande qui arrive sur votre téléphone avec votre code secret. ' +
      "Votre accès s'ouvrira dès la confirmation.",
  });
}
