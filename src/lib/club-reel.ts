/**
 * La fiche d'un club, en données réelles.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Les fiches de club lisaient un référentiel écrit à la main : entraîneur
 * « N/A », stade « N/A », rang 0, effectif vide. Ouvertes à Google telles
 * quelles, elles auraient produit huit cents pages sans contenu — ce qu'un
 * moteur de recherche appelle une page pauvre, et qui pénalise le site entier
 * plutôt que de l'aider.
 *
 * CE QUI ALIMENTE LA FICHE
 *
 * La réserve d'équipes en base — nom, logo, pays, championnat, stade — et le
 * classement en cours du championnat. Ce dernier est le point important : UN
 * SEUL appel sert tous les clubs d'un même championnat, et il est déjà mis en
 * réserve. Huit cents fiches ne coûtent donc pas huit cents requêtes.
 */

import { createAdminClient } from './supabase-admin';
import { getClassementClub, getSeasonLabel } from './api-football';

export interface ClubReel {
  id: string;
  apiId: number;
  nom: string;
  logo: string | null;
  pays: string | null;
  championnat: string | null;
  stade: string | null;
  saison: string | null;
  classement: {
    rang: number;
    points: number;
    joues: number;
    victoires: number;
    nuls: number;
    defaites: number;
    butsMarques: number;
    butsEncaisses: number;
    forme: ('W' | 'D' | 'L')[];
  } | null;
}

/** Tous les clubs de la réserve — sert au plan du site et aux pages statiques. */
export async function listerClubs(): Promise<
  { id: string; nom: string; championnat: string | null }[]
> {
  try {
    const { data, error } = await createAdminClient()
      .from('equipes')
      .select('id, nom, championnat')
      .order('nom');
    if (error || !data) return [];
    return data.map((e: any) => ({ id: e.id, nom: e.nom, championnat: e.championnat }));
  } catch {
    return [];
  }
}

/**
 * Les clubs d'un championnat donné.
 *
 * Sert aux pages de compétition : lister les équipes engagées et renvoyer vers
 * leur fiche crée une vingtaine de liens internes par compétition. Un moteur
 * découvre les pages en suivant les liens, et une page vers laquelle rien ne
 * pointe est traitée comme secondaire.
 */
export async function listerClubsDuChampionnat(
  championnat: string
): Promise<{ id: string; nom: string; logo: string | null }[]> {
  try {
    const { data, error } = await createAdminClient()
      .from('equipes')
      .select('id, nom, logo')
      .eq('championnat', championnat)
      .order('nom');
    if (error || !data) return [];
    return data.map((e: any) => ({ id: e.id, nom: e.nom, logo: e.logo }));
  } catch {
    return [];
  }
}

/**
 * Un club et son classement du moment.
 *
 * Renvoie `null` si le club est inconnu : la page affichera une 404 plutôt
 * qu'une fiche vide portant le nom d'un club qui n'existe pas chez nous.
 */
export async function lireClub(id: string): Promise<ClubReel | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('equipes')
      .select('id, api_id, nom, logo, pays, championnat, stade')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    let classement: ClubReel['classement'] = null;
    let saison: string | null = null;

    if (data.championnat) {
      saison = getSeasonLabel(data.championnat);
      try {
        // Le classement du championnat entier, mis en réserve : tous les clubs
        // d'une même compétition se partagent ce seul appel.
        classement = (await getClassementClub(data.championnat, data.nom)) ?? null;
      } catch {
        // Un classement indisponible ne doit pas faire disparaître la fiche :
        // le nom, le logo et le championnat suffisent à une page utile.
        classement = null;
      }
    }

    return {
      id: data.id,
      apiId: data.api_id,
      nom: data.nom,
      logo: data.logo,
      pays: data.pays,
      championnat: data.championnat,
      stade: data.stade,
      saison,
      classement,
    };
  } catch {
    return null;
  }
}
