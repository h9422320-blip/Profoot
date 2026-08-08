'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { ecrireReglages, invaliderCacheReglages } from '@/lib/app-settings';

const ADMIN_EMAIL = 'h9422320@gmail.com';

/**
 * Enregistre la configuration.
 *
 * L'identité est revérifiée ici, et pas seulement à l'affichage de la page :
 * une action serveur est une adresse appelable directement. Sans ce contrôle,
 * n'importe qui pourrait la déclencher et mettre le site en maintenance.
 */
export async function enregistrerReglages(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false as const, erreur: "Action réservée à l'administrateur." };
  }

  const appName = String(formData.get('appName') ?? '');
  const contactEmail = String(formData.get('contactEmail') ?? '');
  const maintenance = formData.get('maintenance') === 'on';
  const maintenanceMessage = String(formData.get('maintenanceMessage') ?? '');

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
    return { ok: false as const, erreur: "L'adresse de contact n'est pas une adresse e-mail valide." };
  }

  const resultat = await ecrireReglages(
    { appName, contactEmail, maintenance, maintenanceMessage },
    user.email!
  );

  if (!resultat.ok) {
    // Message explicite quand la table n'a pas encore été créée : sans cela
    // l'écran afficherait « erreur inconnue » et rien n'indiquerait quoi faire.
    const manquante = /relation .*app_settings.* does not exist|schema cache/i.test(resultat.erreur);
    return {
      ok: false as const,
      erreur: manquante
        ? "La table de configuration n'existe pas encore. Exécutez le script SQL fourni dans Supabase."
        : resultat.erreur,
    };
  }

  invaliderCacheReglages();
  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { ok: true as const, maintenance };
}
