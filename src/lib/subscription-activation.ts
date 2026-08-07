import { SupabaseClient } from '@supabase/supabase-js';
import { PLANS } from '@/lib/subscription';
import { ChariowSale, resolvePaidPlan } from '@/lib/chariow';

export type ActivationResult =
  | { activated: true; plan: 'monthly' | 'yearly'; expiresAt: string }
  | { activated: false; reason: string };

/**
 * Active (ou prolonge) un abonnement à partir d'une vente Chariow vérifiée.
 * Idempotent : la contrainte UNIQUE sur chariow_sale_id garantit qu'une même
 * vente ne crédite jamais deux fois, quel que soit le chemin d'entrée
 * (webhook, réessai de webhook, réconciliation).
 *
 * `userId` doit provenir d'une source de confiance (métadonnées du checkout
 * créées par notre serveur, ou session authentifiée en réconciliation).
 */
export async function activateSubscriptionFromSale(
  admin: SupabaseClient,
  sale: ChariowSale,
  userId: string
): Promise<ActivationResult> {
  if (sale.status !== 'completed' && sale.status !== 'settled') {
    return { activated: false, reason: `Vente non finalisée (statut: ${sale.status}).` };
  }

  const plan = resolvePaidPlan({
    productId: sale.product?.id,
    metadataPlan: sale.custom_metadata?.plan,
    amountValue: sale.amount?.value,
    amountCurrency: sale.amount?.currency,
  });
  if (!plan) {
    return {
      activated: false,
      reason: `Impossible de déterminer l'offre payée (produit: ${sale.product?.id}, montant: ${sale.amount?.value} ${sale.amount?.currency}).`,
    };
  }

  const config = PLANS[plan];

  // Un réabonnement anticipé s'ajoute au temps restant plutôt que de l'écraser :
  // sans cela, renouveler à J+10 ferait perdre au client ses 20 jours restants.
  const { data: current } = await admin
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1);

  const currentExpiry = current?.[0]?.expires_at
    ? new Date(current[0].expires_at).getTime()
    : 0;
  const startFrom = Math.max(Date.now(), currentExpiry);
  const expiresAt = new Date(startFrom + config.durationDays * 24 * 60 * 60 * 1000).toISOString();

  // Une vente ne peut créditer QU'UNE SEULE FOIS. `ignoreDuplicates` produit un
  // ON CONFLICT DO NOTHING : rejouer la même vente (réessai de webhook, appel
  // répété de la réconciliation) ne repousse jamais la date d'expiration.
  const { data, error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan,
        status: 'active',
        provider: 'chariow',
        chariow_sale_id: sale.id,
        amount: sale.amount?.value ?? config.amountXof,
        currency: sale.amount?.currency ?? 'XOF',
        expires_at: expiresAt,
      },
      { onConflict: 'chariow_sale_id', ignoreDuplicates: true }
    )
    .select('id');

  if (error) {
    console.error('Erreur activation abonnement:', error);
    return { activated: false, reason: 'Erreur base de données.' };
  }
  if (!data || data.length === 0) {
    return { activated: false, reason: 'Vente déjà créditée.' };
  }
  return { activated: true, plan, expiresAt };
}
