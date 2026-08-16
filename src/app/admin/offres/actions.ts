'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { ecrireOffres, CLES_OFFRES, type ModificationOffre } from '@/lib/offres';
import type { PlanKey } from '@/lib/subscription';

const ADMIN_EMAIL = 'h9422320@gmail.com';

/**
 * Enregistre les prix et quotas.
 *
 * L'identité est revérifiée ici, et pas seulement à l'affichage de la page :
 * une action serveur est une adresse appelable directement. Sans ce contrôle,
 * n'importe qui pourrait s'accorder l'accès VIP en modifiant une offre.
 */
export async function enregistrerOffres(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false as const, erreur: "Action réservée à l'administrateur." };
  }

  const modifications: ModificationOffre[] = [];
  for (const cle of CLES_OFFRES) {
    const prix = Number(formData.get(`prix_${cle}`));
    const illimite = formData.get(`illimite_${cle}`) === 'on';
    const analyses = illimite ? -1 : Number(formData.get(`analyses_${cle}`));

    if (!Number.isFinite(prix) || prix <= 0)
      return { ok: false as const, erreur: `Prix invalide pour ${cle}.` };
    if (!illimite && (!Number.isFinite(analyses) || analyses < 0))
      return { ok: false as const, erreur: `Nombre d'analyses invalide pour ${cle}.` };

    modifications.push({
      cle: cle as PlanKey,
      prixXof: prix,
      limiteAnalyses: analyses,
      agentVip: formData.get(`vip_${cle}`) === 'on',
    });
  }

  const r = await ecrireOffres(modifications, user.email!);
  if (!r.ok) return r;

  // Les pages qui affichent les tarifs doivent refléter le changement tout de
  // suite : c'est tout l'intérêt de pouvoir les modifier soi-même.
  revalidatePath('/pricing');
  revalidatePath('/admin/offres');
  return { ok: true as const };
}
