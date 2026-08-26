import { createAdminClient } from '@/lib/supabase-admin';
import { avecDelai, DELAIS } from './delai-securite';

/**
 * Clubs qu un amateur de football reconnait sans reflechir.
 *
 * Liste de depart, volontairement courte : elle sert a faire remonter les
 * affiches qui retiennent l attention, pas a etablir un palmares. Un club
 * absent n est pas juge faible — sa preuve s affiche simplement plus bas.
 *
 * Ecrite en minuscules et sans accent : la comparaison se fait par inclusion
 * dans le nom de l equipe, qui varie selon les sources.
 */
export const GRANDS_CLUBS_PAR_DEFAUT = [
  'real madrid', 'barcelon', 'atletico', 'sevilla', 'valencia',
  'paris saint', 'marseille', 'monaco', 'lyon', 'lille',
  'manchester', 'liverpool', 'arsenal', 'chelsea', 'tottenham', 'newcastle',
  'bayern', 'dortmund', 'leipzig', 'leverkusen',
  'juventus', 'milan', 'inter', 'napoli', 'roma',
  'ajax', 'psv', 'benfica', 'porto', 'sporting', 'celtic', 'rangers',
  'galatasaray', 'fenerbah', 'besiktas', 'al ahly',
];

/**
 * Configuration de l'application (table `app_settings`, ligne unique).
 */
export interface AppSettings {
  appName: string;
  contactEmail: string;
  maintenance: boolean;
  maintenanceMessage: string;
  /**
   * Clubs dont les affiches remontent en tete du mur de preuves.
   *
   * Modifiable depuis l administration : un visiteur ne lit pas dix cartes, il
   * en regarde deux. Ces deux-la doivent lui parler.
   */
  grandsClubs: string[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export const REGLAGES_PAR_DEFAUT: AppSettings = {
  appName: 'ProFoot AI',
  contactEmail: 'support@profootai.com',
  maintenance: false,
  maintenanceMessage: 'ProFoot AI est momentanément en maintenance. Nous revenons très vite.',
  grandsClubs: GRANDS_CLUBS_PAR_DEFAUT,
  updatedAt: null,
  updatedBy: null,
};

function versReglages(ligne: any): AppSettings {
  return {
    appName: ligne?.app_name ?? REGLAGES_PAR_DEFAUT.appName,
    contactEmail: ligne?.contact_email ?? REGLAGES_PAR_DEFAUT.contactEmail,
    maintenance: !!ligne?.maintenance,
    maintenanceMessage: ligne?.maintenance_message ?? REGLAGES_PAR_DEFAUT.maintenanceMessage,
    // Une liste vide vaut « pas de reglage » : on retombe sur celle du code
    // plutot que de laisser le mur sans aucune priorite.
    grandsClubs: Array.isArray(ligne?.grands_clubs) && ligne.grands_clubs.length
      ? ligne.grands_clubs
      : GRANDS_CLUBS_PAR_DEFAUT,
    updatedAt: ligne?.updated_at ?? null,
    updatedBy: ligne?.updated_by ?? null,
  };
}

/**
 * Lecture complète, pour l'administration.
 *
 * Toute erreur renvoie les valeurs par défaut plutôt qu'une exception : si la
 * table n'existe pas encore, l'application doit continuer de fonctionner
 * normalement — et surtout ne jamais basculer en maintenance par accident.
 */
export async function lireReglages(): Promise<AppSettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('app_name, contact_email, maintenance, maintenance_message, grands_clubs, updated_at, updated_by')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return REGLAGES_PAR_DEFAUT;
    return versReglages(data);
  } catch {
    return REGLAGES_PAR_DEFAUT;
  }
}

export async function ecrireReglages(
  valeurs: Pick<AppSettings, 'appName' | 'contactEmail' | 'maintenance' | 'maintenanceMessage'> & {
    grandsClubs?: string[];
  },
  parEmail: string
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          id: 1,
          app_name: valeurs.appName.trim() || REGLAGES_PAR_DEFAUT.appName,
          contact_email: valeurs.contactEmail.trim() || REGLAGES_PAR_DEFAUT.contactEmail,
          maintenance: valeurs.maintenance,
          maintenance_message:
            valeurs.maintenanceMessage.trim() || REGLAGES_PAR_DEFAUT.maintenanceMessage,
          // Une liste vidée remet celle du code : le mur ne se retrouve jamais
          // sans priorité d'affichage à cause d'un champ effacé par mégarde.
          grands_clubs: valeurs.grandsClubs?.length ? valeurs.grandsClubs : null,
          updated_at: new Date().toISOString(),
          updated_by: parEmail,
        },
        { onConflict: 'id' }
      );
    if (error) return { ok: false, erreur: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erreur: e?.message ?? 'Erreur inconnue' };
  }
}

// ── Lecture allégée pour le middleware ──

let cache: { valeur: AppSettings; expire: number } | null = null;
const DUREE_CACHE_MS = 30_000;

/**
 * État de maintenance, mis en cache 30 secondes.
 *
 * Le middleware s'exécute à chaque requête : interroger la base à chaque fois
 * ajouterait un aller-retour réseau à toutes les pages du site. Trente secondes
 * de décalage à l'activation sont sans conséquence, et l'administrateur voit
 * l'état réel dans l'administration, qui lit la base sans cache.
 */
export async function maintenanceActive(
  client?: { from: (t: string) => any }
): Promise<{ active: boolean; message: string }> {
  if (cache && Date.now() < cache.expire) {
    return { active: cache.valeur.maintenance, message: cache.valeur.maintenanceMessage };
  }

  // ── CETTE LECTURE ÉCHOUAIT DEPUIS LE DÉBUT, EN SILENCE ──────────────────
  //
  // Le commentaire d'origine affirmait ici que « la table est en lecture
  // publique ». C'était faux. Vérifié le 25 août 2026 avec la clé anonyme —
  // celle qu'emploie le middleware :
  //
  //     HTTP 401 — 42501
  //     "Grant the required privileges to the current role with: GRANT SELECT"
  //
  // Deux conséquences, cachées par le `catch` juste en dessous :
  //
  //   — chaque requête du site produisait une erreur en base. Sur 352 entrées
  //     Postgres relevées cette nuit-là, 332 étaient celle-ci ;
  //   — le MODE MAINTENANCE ne fonctionnait pas. La lecture échouant toujours,
  //     on retombait sur les réglages par défaut, maintenance désactivée. Le
  //     bouton de l'administration n'aurait rien produit.
  //
  // ── POURQUOI `updated_by` A QUITTÉ CETTE REQUÊTE ────────────────────────
  //
  // Ouvrir la table au rôle anonyme y donnait accès, et cette colonne contient
  // l'adresse de l'administrateur — exactement le compte qu'on ne doit pas
  // exposer. Or `maintenanceActive` ne renvoie que l'état et le message : elle
  // n'en a aucun besoin. On ne demande donc que ce qu'on lit, et le droit
  // accordé en base peut exclure cette colonne.
  //
  // `lireReglages()` plus haut la conserve : elle passe par la clé de service,
  // pour l'administration, et a besoin de savoir qui a modifié quoi.
  let valeur = REGLAGES_PAR_DEFAUT;
  try {
    if (client) {
      // ── UN DÉLAI, PARCE QUE CETTE LECTURE EST SUR LE CHEMIN DE TOUT ──────
      //
      // Le middleware appelle cette fonction à CHAQUE requête. Sans limite de
      // temps, une base lente y bloquait toutes les pages du site : mesuré le
      // 25 août 2026, /pricing et /matches dépassaient trente secondes alors
      // que le site n'était pas en panne — il attendait.
      //
      // Passé une seconde et demie, on renonce et on sert les réglages par
      // défaut : maintenance désactivée, ce qui laisse le site OUVERT. C'est
      // le bon choix par défaut — mieux vaut un site accessible pendant une
      // maintenance oubliée qu'un site fermé parce que la base tarde.
      const { data } = await avecDelai(
        client
          .from('app_settings')
          .select('app_name, contact_email, maintenance, maintenance_message, grands_clubs, updated_at')
          .eq('id', 1)
          .maybeSingle(),
        DELAIS.middleware,
        { data: null },
        'réglages (middleware)'
      );
      if (data) valeur = versReglages(data);
    } else {
      valeur = await lireReglages();
    }
  } catch {
    valeur = REGLAGES_PAR_DEFAUT;
  }

  cache = { valeur, expire: Date.now() + DUREE_CACHE_MS };
  return { active: valeur.maintenance, message: valeur.maintenanceMessage };
}

/** Vide le cache après un enregistrement, pour que l'effet soit immédiat. */
export function invaliderCacheReglages() {
  cache = null;
}
