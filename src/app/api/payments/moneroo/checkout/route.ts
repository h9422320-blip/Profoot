import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const MONEROO_API_URL = 'https://api.moneroo.io/v1/payments/initialize';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Vérifier que l'utilisateur est connecté
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
    }

    // 2. Récupérer les données de la requête
    const body = await req.json();
    const { plan } = body;

    if (!plan || (plan !== 'monthly' && plan !== 'lifetime')) {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
    }

    // 3. Définir le montant et la devise selon le plan et l'environnement
    const secretKey = process.env.MONEROO_SECRET_KEY;
    if (!secretKey) {
      console.error('MONEROO_SECRET_KEY manquante dans les variables d\'environnement');
      return NextResponse.json({ error: 'Configuration serveur invalide.' }, { status: 500 });
    }

    const isSandbox = secretKey.includes('sandbox');
    const amount = isSandbox
      ? (plan === 'monthly' ? 10 : 30) // Prix de test en USD pour le Sandbox
      : (plan === 'monthly' ? 20000 : 60000); // Vrais prix en FCFA (XOF) pour la Production

    const currency = isSandbox ? 'USD' : 'XOF';
    
    // Obtenir l'URL de base dynamique pour le callback
    // En développement local (localhost), ou en production (Vercel)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/api/payments/moneroo/callback`; // We'll create a callback route to handle the immediate return

    const userCountry = req.headers.get('x-vercel-ip-country') || undefined;
    const userPhone = user.phone || user.user_metadata?.phone || undefined;

    // 4. Préparer la requête pour Moneroo
    const payload = {
      amount,
      currency,
      description: `Abonnement ProFoot AI - ${plan === 'monthly' ? 'Mensuel' : 'À vie'}`,
      customer: {
        email: user.email,
        first_name: user.user_metadata?.first_name || 'Utilisateur',
        last_name: user.user_metadata?.last_name || 'ProFoot',
        ...(userPhone && { phone: userPhone }),
        ...(userCountry && { country: userCountry })
      },
      return_url: returnUrl,
      metadata: {
        user_id: user.id,
        plan_type: plan
      }
    };

    const response = await fetch(MONEROO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur Moneroo:', data);
      return NextResponse.json({ error: 'Erreur lors de l\'initialisation du paiement avec Moneroo.' }, { status: response.status });
    }

    // 6. Renvoyer l'URL de checkout au frontend
    if (data.data && data.data.checkout_url) {
      return NextResponse.json({ checkoutUrl: data.data.checkout_url });
    } else {
      console.error('Pas de checkout_url dans la réponse Moneroo:', data);
      return NextResponse.json({ error: 'Réponse invalide de Moneroo.' }, { status: 500 });
    }

  } catch (error) {
    console.error('Erreur inattendue:', error);
    return NextResponse.json({ error: 'Une erreur inattendue est survenue.' }, { status: 500 });
  }
}
