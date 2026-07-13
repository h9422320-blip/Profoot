import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Emails avec accès VIP permanent — tous les abonnements débloqués
const VIP_EMAILS = [
  "abdoulayecamara2708@gmail.com", // Accès Premium uniquement
  "h9422320@gmail.com",            // Accès Premium + Admin
];

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Vérifier l'utilisateur
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ isPro: false, error: 'Non autorisé' }, { status: 401 });
    }

    // 2. VIP check — accès lifetime instantané
    if (user.email && VIP_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json({ isPro: true, plan: 'lifetime', expiresAt: null, vip: true });
    }
    // 2. Chercher un abonnement actif
    const { data: subscriptions, error: dbError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Erreur lors de la récupération des abonnements:', dbError);
      return NextResponse.json({ isPro: false, error: 'Erreur serveur' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ isPro: false });
    }

    // 3. Vérifier l'expiration
    // S'il y a un abonnement lifetime, c'est toujours valide.
    // Sinon, on vérifie l'expiration du dernier abonnement mensuel.
    let isPro = false;
    let currentPlan = null;
    let expiresAt = null;

    for (const sub of subscriptions) {
      if (sub.plan === 'lifetime') {
        isPro = true;
        currentPlan = 'lifetime';
        break; // Lifetime prime sur tout
      }

      if (sub.plan === 'monthly') {
        if (!sub.expires_at) {
          // Normalement un abonnement mensuel doit avoir une date d'expiration
          continue; 
        }
        
        const expirationDate = new Date(sub.expires_at);
        const now = new Date();
        
        if (expirationDate > now) {
          isPro = true;
          currentPlan = 'monthly';
          expiresAt = sub.expires_at;
          break; // Abonnement actif trouvé
        } else {
          // Optionnel : Mettre à jour le statut à 'expired' dans la BDD
          // await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', sub.id);
        }
      }
    }

    return NextResponse.json({ 
      isPro, 
      plan: currentPlan,
      expiresAt 
    });

  } catch (error) {
    console.error('Erreur API statut:', error);
    return NextResponse.json({ isPro: false, error: 'Erreur inattendue' }, { status: 500 });
  }
}
