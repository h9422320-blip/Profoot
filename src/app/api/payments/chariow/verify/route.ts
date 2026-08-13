import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/subscription';
import { createAdminClient } from '@/lib/supabase-admin';
import { listCompletedSalesByEmail } from '@/lib/chariow';
import { activateSubscriptionFromSale } from '@/lib/subscription-activation';
import { trouverAcheteur, marquerIntentionHonoree, intentionMatch } from '@/lib/payment-intents';
import { debloquerMatch } from '@/lib/match-unique';

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
      // SÉCURITÉ : seule une preuve enregistrée par NOTRE serveur au moment du
      // checkout fait foi — métadonnées si Chariow les rend, sinon la table des
      // intentions. L'e-mail seul ne suffit pas : la création de compte n'exige
      // pas de prouver la possession de l'adresse, donc n'importe qui pourrait
      // s'inscrire avec l'e-mail d'un acheteur et réclamer sa vente.
      const acheteur = await trouverAcheteur(admin, sale);
      if (acheteur?.userId !== user.id) {
        unmatched++;
        continue;
      }
      if (sale.customer?.email?.toLowerCase() !== user.email.toLowerCase()) {
        unmatched++;
        continue;
      }

      // Meme aiguillage que le webhook : sans lui, un achat de match dont la
      // notification s est perdue ne serait jamais rattrape par ce filet.
      const achatMatch = await intentionMatch(admin, sale.id);
      if (achatMatch) {
        const r = await debloquerMatch({
          userId: user.id,
          matchKey: achatMatch.matchKey,
          saleId: sale.id,
          equipe1Nom: achatMatch.equipe1Nom,
          equipe2Nom: achatMatch.equipe2Nom,
          montant: sale.amount?.value ?? null,
          devise: sale.amount?.currency ?? 'XOF',
        });
        if (r.debloque) await marquerIntentionHonoree(admin, sale.id);
        continue;
      }

      const result = await activateSubscriptionFromSale(admin, sale, user.id);
      if (result.activated) {
        await marquerIntentionHonoree(admin, sale.id);
        results.push({ saleId: sale.id, plan: result.plan });
      }
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
