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
let rafraichissement: Promise<AppSettings> | null = null;
const DUREE_CACHE_MS = 60_000;

/**
 * État de maintenance — servi sans jamais faire attendre le visiteur.
 *
 * ── CE QUE COÛTAIT L'ATTENTE, MESURÉ LE 26 AOÛT 2026 ──────────────────────
 *
 * Le middleware est la seule fonction qui s'exécute à chaque requête : toutes
 * les pages du site sont prérendues et servies par le CDN. Il est donc le seul
 * endroit où le site peut encore être lent — et il l'était.
 *
 * Comparaison d'une adresse qui le traverse et d'une image qui l'évite, cinq
 * tours d'affilée :
 *
 *     /            1,565s  0,523s  0,363s  0,465s  1,013s
 *     /pricing     0,585s  0,309s  0,349s  0,276s  2,517s
 *     /logo.png    0,619s  0,461s  0,406s  0,306s  0,400s   ← sans middleware
 *
 * L'image reste plate ; les pages font des pointes à deux secondes et demie.
 * L'écart, c'est cette lecture : le cache mémoire de trente secondes meurt
 * avec l'instance, et chaque instance neuve rouvrait une connexion à la base
 * pendant que le visiteur regardait une page blanche.
 *
 * ── SERVIR D'ABORD, RELIRE ENSUITE ────────────────────────────────────────
 *
 * Une valeur périmée est rendue IMMÉDIATEMENT, et la relecture part derrière
 * sans qu'on l'attende. Seule la toute première requête d'une instance attend,
 * une fois, puis plus jamais tant que l'instance vit.
 *
 * Le décalage que ça introduit est d'une requête : l'administrateur active la
 * maintenance, la requête suivante passe encore, celle d'après bascule. C'était
 * déjà le cas dans la fenêtre de trente secondes — on ne perd rien de réel, et
 * on gagne deux secondes sur chaque page.
 *
 * En cas d'échec, le repli reste « site OUVERT » : mieux vaut un site
 * accessible pendant une maintenance oubliée qu'un site fermé parce que la
 * base tarde.
 */
export async function maintenanceActive(
  client?: { from: (t: string) => any }
): Promise<{ active: boolean; message: string }> {
  const rendre = (v: AppSettings) => ({ active: v.maintenance, message: v.maintenanceMessage });

  if (cache && Date.now() < cache.expire) return rendre(cache.valeur);

  // Une seule relecture à la fois : dix requêtes simultanées sur une instance
  // froide ne doivent pas ouvrir dix connexions.
  const relancer = (): Promise<AppSettings> => {
    if (!rafraichissement) {
      rafraichissement = lireEtatMaintenance(client)
        .catch(() => REGLAGES_PAR_DEFAUT)
        .then((v) => {
          cache = { valeur: v, expire: Date.now() + DUREE_CACHE_MS };
          rafraichissement = null;
          return v;
        });
    }
    return rafraichissement;
  };

  // Valeur périmée en mémoire : on la sert telle quelle et on relit derrière.
  if (cache) {
    const connu = cache.valeur;
    void relancer();
    return rendre(connu);
  }

  // Premier passage de cette instance : on attend, une seule fois.
  return rendre(await relancer());
}

/** La lecture elle-même. Ne lève jamais : rend les valeurs par défaut. */
async function lireEtatMaintenance(
  client?: { from: (t: string) => any }
): Promise<AppSettings> {
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

  // La mise en cache est faite par l'appelant : c'est lui qui sait s'il a
  // attendu cette lecture ou s'il l'a lancée derrière une valeur périmée.
  return valeur;
}

/** Vide le cache après un enregistrement, pour que l'effet soit immédiat. */
export function invaliderCacheReglages() {
  cache = null;
}
