import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MONEROO_API_URL = 'https://api.moneroo.io/v1/payments';

export async function POST(req: Request) {
  try {
    // Note: We use the Supabase Service Role Key to bypass RLS policies
    // because this route runs asynchronously without a user session.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Lire le corps de la requête webhook
    const body = await req.json();
    
    // 2. Traiter uniquement l'événement de succès de paiement
    if (body.event === 'payment.success') {
      const paymentId = body.data?.id;

      if (!paymentId) {
        return NextResponse.json({ error: 'ID de paiement manquant.' }, { status: 400 });
      }

      // 3. Vérifier le paiement de manière sécurisée auprès de Moneroo
      const secretKey = process.env.MONEROO_SECRET_KEY;
      const verifyResponse = await fetch(`${MONEROO_API_URL}/${paymentId}/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Accept': 'application/json'
        }
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.data || verifyData.data.status !== 'success') {
        console.error('Vérification Moneroo échouée:', verifyData);
        return NextResponse.json({ error: 'Paiement non vérifié.' }, { status: 400 });
      }

      const payment = verifyData.data;
      const { user_id, plan_type } = payment.metadata || {};

      if (!user_id || !plan_type) {
        console.error('Métadonnées manquantes dans le paiement:', payment);
        return NextResponse.json({ error: 'Métadonnées manquantes.' }, { status: 400 });
      }

      // 4. Calculer la date d'expiration
      let expiresAt = null;
      if (plan_type === 'monthly') {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        expiresAt = date.toISOString();
      }

      // 5. Enregistrer ou mettre à jour l'abonnement dans Supabase
      // On utilise upsert au cas où la requête webhook serait envoyée plusieurs fois
      const { error: dbError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id,
          plan: plan_type,
          status: 'active',
          moneroo_payment_id: paymentId,
          amount: payment.amount,
          currency: payment.currency,
          expires_at: expiresAt
        }, { onConflict: 'moneroo_payment_id' });

      if (dbError) {
        console.error('Erreur base de données:', dbError);
        return NextResponse.json({ error: 'Erreur base de données.' }, { status: 500 });
      }

      return NextResponse.json({ received: true, status: 'success' });
    }

    // Répondre avec succès pour les autres événements non gérés pour éviter des renvois inutiles
    return NextResponse.json({ received: true, status: 'ignored' });

  } catch (error) {
    console.error('Erreur Webhook Moneroo:', error);
    return NextResponse.json({ error: 'Erreur Serveur Interne.' }, { status: 500 });
  }
}
