'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/utils/supabase/server';
import {
  basculerMiseEnAvant,
  basculerPublication,
  construirePreuves,
  saisirScoreReel,
} from '@/lib/preuves';

const ADMIN_EMAIL = 'h9422320@gmail.com';

/**
 * L'identité est revérifiée dans chaque action, et pas seulement à l'affichage
 * de la page : une action serveur est une adresse appelable directement. Sans
 * ce contrôle, n'importe qui pourrait publier une preuve sur la page d'accueil.
 */
async function estAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === ADMIN_EMAIL;
}

const refus = { ok: false as const, erreur: "Action réservée à l'administrateur." };

/** Reconstruit les preuves à partir des analyses vérifiées. */
export async function reconstruirePreuves() {
  if (!(await estAdmin())) return refus;

  const r = await construirePreuves();
  if (r.erreur) {
    const manquante = /relation .*preuves.* does not exist|schema cache/i.test(r.erreur);
    return {
      ok: false as const,
      erreur: manquante
        ? "La table des preuves n'existe pas encore. Exécutez le script SQL fourni dans Supabase."
        : r.erreur,
    };
  }

  revalidatePath('/admin/preuves');
  revalidatePath('/analyze');
  return { ok: true as const, ...r };
}

/**
 * Saisit le vrai score d'un match.
 *
 * La justesse n'est jamais saisie : elle se déduit du score. Si l'administrateur
 * pouvait cocher « correct » lui-même, la preuve ne prouverait plus rien.
 */
export async function enregistrerScoreReel(formData: FormData) {
  if (!(await estAdmin())) return refus;

  const id = String(formData.get('id') ?? '');
  const buts1 = Number(formData.get('buts1'));
  const buts2 = Number(formData.get('buts2'));

  if (!id) return { ok: false as const, erreur: 'Preuve non identifiée.' };
  if (!Number.isInteger(buts1) || !Number.isInteger(buts2) || buts1 < 0 || buts2 < 0)
    return { ok: false as const, erreur: 'Le score doit être deux nombres entiers positifs.' };
  if (buts1 > 30 || buts2 > 30)
    return { ok: false as const, erreur: 'Ce score paraît erroné — vérifiez la saisie.' };

  const r = await saisirScoreReel(id, buts1, buts2, ADMIN_EMAIL);
  if (!r.ok) return { ok: false as const, erreur: r.erreur ?? 'Enregistrement impossible.' };

  revalidatePath('/admin/preuves');
  revalidatePath('/analyze');
  return { ok: true as const };
}

/** Publie ou retire une preuve du mur public. */
export async function changerPublication(id: string, publiee: boolean) {
  if (!(await estAdmin())) return refus;

  const r = await basculerPublication(id, publiee);
  if (!r.ok) return { ok: false as const, erreur: r.erreur ?? 'Modification impossible.' };

  revalidatePath('/admin/preuves');
  revalidatePath('/analyze');
  return { ok: true as const };
}

/** Remonte une preuve en tête du mur. */
export async function changerMiseEnAvant(id: string, miseEnAvant: boolean) {
  if (!(await estAdmin())) return refus;

  const r = await basculerMiseEnAvant(id, miseEnAvant);
  if (!r.ok) return { ok: false as const, erreur: r.erreur ?? 'Modification impossible.' };

  revalidatePath('/admin/preuves');
  revalidatePath('/analyze');
  return { ok: true as const };
}
