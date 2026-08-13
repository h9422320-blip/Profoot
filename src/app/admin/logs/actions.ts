'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { rafraichirStatutsPaiement } from '@/lib/echecs-paiement';

const ADMIN_EMAIL = 'h9422320@gmail.com';

/**
 * Relève à la demande le sort des demandes de paiement.
 *
 * Le relevé automatique ne passe qu'une fois par jour avec l'audit — c'est la
 * limite de l'hébergement, pas un choix. Sans ce bouton, une demande faite ce
 * matin resterait « pas encore relevée » jusqu'au lendemain, ce qui rend le
 * tableau inutilisable le jour où on en a besoin.
 *
 * L'identité est revérifiée ici, et pas seulement à l'affichage de la page :
 * une action serveur est une adresse appelable directement.
 */
export async function releverPaiements() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false as const, erreur: "Action réservée à l'administrateur." };
  }

  try {
    // Vingt-cinq suffisent pour un affichage : chaque relevé est un appel
    // réseau, et l'attente se paie à l'écran.
    const { releves, echecs, erreur } = await rafraichirStatutsPaiement(25);

    if (erreur) {
      // Distinguer « la migration n'est pas passée » de « ça a raté » : le
      // premier cas se répare en collant un script, le second en réessayant.
      const manquante = /statut_boutique|column .* does not exist|schema cache/i.test(erreur);
      return {
        ok: false as const,
        erreur: manquante
          ? "Les colonnes de relevé n'existent pas encore. Exécutez le script SQL fourni dans Supabase."
          : erreur,
      };
    }

    revalidatePath('/admin/logs');
    return { ok: true as const, releves, echecs };
  } catch {
    return { ok: false as const, erreur: 'Le relevé a échoué. Réessayez dans un instant.' };
  }
}
