/**
 * Ambassadeurs affichés sur la page d'accueil.
 *
 * POURQUOI UNE TABLE, ET NON DU CODE
 *
 * Un ambassadeur va et vient, sa photo change, sa phrase se retouche. Chacun de
 * ces changements aurait demandé une modification du code et un redéploiement.
 *
 * LA SECTION DISPARAÎT D'ELLE-MÊME
 *
 * Aucun ambassadeur actif, ou une lecture qui échoue : la section n'est pas
 * rendue du tout. Elle ne laisse ni cadre vide, ni photo manquante, ni citation
 * orpheline sur la page la plus vue du site. Une page d'accueil doit rester
 * présentable même quand une donnée manque.
 */

import { createAdminClient } from './supabase-admin';

export interface Ambassadeur {
  id: string;
  nom: string;
  role: string;
  citation: string;
  photoUrl: string | null;
  ordre: number;
  actif: boolean;
}

/**
 * Les ambassadeurs à montrer, dans l'ordre voulu.
 *
 * Ceux qui n'ont pas de photo sont écartés : la section est bâtie autour du
 * portrait, un visage manquant y laisserait un trou au lieu d'une preuve.
 */
export async function lireAmbassadeurs(): Promise<Ambassadeur[]> {
  try {
    const { data, error } = await createAdminClient()
      .from('ambassadeurs')
      .select('id, nom, role, citation, photo_url, ordre, actif')
      .eq('actif', true)
      .order('ordre', { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((a: any) => !!a.photo_url)
      .map((a: any) => ({
        id: a.id,
        nom: a.nom,
        role: a.role,
        citation: a.citation,
        photoUrl: a.photo_url,
        ordre: a.ordre ?? 0,
        actif: !!a.actif,
      }));
  } catch (e: any) {
    // La table n'existe pas encore, ou la base ne répond pas. La page d'accueil
    // doit s'afficher quand même — sans cette section, et sans erreur.
    console.warn('[AMBASSADEURS] Lecture impossible :', e?.message);
    return [];
  }
}

/** Tous les ambassadeurs, y compris masqués et sans photo — pour l'administration. */
export async function lireTousAmbassadeurs(): Promise<Ambassadeur[]> {
  try {
    const { data, error } = await createAdminClient()
      .from('ambassadeurs')
      .select('id, nom, role, citation, photo_url, ordre, actif')
      .order('ordre', { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((a: any) => ({
      id: a.id,
      nom: a.nom,
      role: a.role,
      citation: a.citation,
      photoUrl: a.photo_url,
      ordre: a.ordre ?? 0,
      actif: !!a.actif,
    }));
  } catch (e: any) {
    console.warn('[AMBASSADEURS] Lecture impossible :', e?.message);
    return [];
  }
}
