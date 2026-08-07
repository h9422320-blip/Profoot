import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/subscription';
import { createAdminClient } from '@/lib/supabase-admin';
import { listCompletedSalesByEmail } from '@/lib/chariow';
import { activateSubscriptionFromSale } from '@/lib/subscription-activation';

/**
 * Réconciliation : filet de sécurité si un webhook a été manqué (panne,
 * déploiement, achat direct sur la boutique Chariow sans passer par l'app).
 *
 * L'utilisateur AUTHENTIFIÉ demande une vérification ; le serveur interroge
 * l'API Chariow pour les ventes complétées liées à SON email, et active ce qui
 * ne l'est pas encore. Aucune donnée du client n'est crue sur parole :
 * l'email vient de la session, les ventes viennent de Chariow.
 */
export async function POST() {
  try {
    const guard = await requireUser();
    if (!guard.ok) return guard.response;
    const { user } = guard;

    if (!user.email) {
      return NextResponse.json({ activated: false, reason: 'Compte sans email.' }, { status: 400 });
    }

    const sales = await listCompletedSalesByEmail(user.email);
    const admin = createAdminClient();

    const results = [];
    let unmatched = 0;
    for (const sale of sales) {
      // SÉCURITÉ : seul le user_id inscrit par NOTRE serveur au moment du
      // checkout fait foi. L'email seul ne suffit pas : la création de compte
      // n'exige pas de prouver la possession de l'adresse, donc n'importe qui
      // pourrait s'inscrire avec l'email d'un acheteur et réclamer sa vente.
      const metaUserId = sale.custom_metadata?.user_id;
      if (!metaUserId || metaUserId !== user.id) {
        unmatched++;
        continue;
      }
      if (sale.customer?.email?.toLowerCase() !== user.email.toLowerCase()) {
        unmatched++;
        continue;
      }

      const result = await activateSubscriptionFromSale(admin, sale, user.id);
      if (result.activated) results.push({ saleId: sale.id, plan: result.plan });
    }

    return NextResponse.json({
      checked: sales.length,
      activated: results,
      // Ventes trouvées sur cet email mais non rattachables automatiquement
      // (achat direct en boutique) : à traiter manuellement côté admin.
      unmatched,
    });
  } catch (error) {
    console.error('Erreur réconciliation Chariow:', error);
    return NextResponse.json({ error: 'Vérification impossible pour le moment.' }, { status: 500 });
  }
}
