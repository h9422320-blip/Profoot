import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retrouve le compte à qui attribuer une vente Chariow.
 *
 * Deux sources, par ordre de fiabilité :
 *
 *  1. `custom_metadata.user_id` — écrit par notre serveur au checkout. Chariow
 *     ne le conserve pas aujourd'hui, mais on continue de le lire au cas où :
 *     s'il revient un jour, c'est la source la plus directe.
 *
 *  2. La table `payment_intents` — notre propre trace, écrite au checkout et
 *     indexée sur l'identifiant de vente que Chariow nous renvoie. C'est elle
 *     qui fait foi en pratique.
 *
 * L'adresse e-mail n'est délibérément PAS utilisée comme preuve d'identité :
 * la création de compte n'exige pas de confirmer son adresse, donc n'importe
 * qui pourrait s'inscrire avec l'e-mail d'un acheteur et réclamer sa vente.
 */
export async function trouverAcheteur(
  admin: SupabaseClient,
  sale: { id: string; custom_metadata?: Record<string, string> | null }
): Promise<{ userId: string; source: 'metadonnees' | 'intention' } | null> {
  const parMetadonnees = sale.custom_metadata?.user_id;
  if (parMetadonnees) return { userId: parMetadonnees, source: 'metadonnees' };

  const { data, error } = await admin
    .from('payment_intents')
    .select('user_id')
    .eq('sale_id', sale.id)
    .maybeSingle();

  if (error) {
    console.error('Lecture des intentions de paiement impossible:', error.message);
    return null;
  }
  if (!data?.user_id) return null;

  return { userId: data.user_id, source: 'intention' };
}

/** Marque l'intention comme honorée, pour distinguer les ventes restées sans suite. */
export async function marquerIntentionHonoree(admin: SupabaseClient, saleId: string) {
  const { error } = await admin
    .from('payment_intents')
    .update({ consumed_at: new Date().toISOString() })
    .eq('sale_id', saleId)
    .is('consumed_at', null);
  if (error) console.error('Intention non marquée comme honorée:', saleId, error.message);
}
