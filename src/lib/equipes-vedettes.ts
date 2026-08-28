/**
 * LES CLUBS QU'ON PROPOSE D'EMBLÉE À QUELQU'UN QUI ARRIVE.
 *
 * ── POURQUOI UNE LISTE ÉCRITE À LA MAIN ───────────────────────────────────
 *
 * Le référentiel contient quatre-vingt-seize clubs pour les seuls cinq grands
 * championnats, et plusieurs milliers en cherchant plus loin. On ne demande pas
 * à quelqu'un de choisir son club de cœur dans une liste de quatre mille noms :
 * on lui montre quatorze visages qu'il reconnaîtra en une seconde, et on laisse
 * la recherche ouverte pour tous les autres.
 *
 * Cette liste n'est pas un classement et n'a aucun effet sur l'application.
 * Elle sert à ce qu'un fan de Barcelone puisse répondre en un geste.
 *
 * ── LES ALIAS ONT ÉTÉ RELEVÉS, PAS DEVINÉS ────────────────────────────────
 *
 * Chaque identifiant et chaque nom ci-dessous a été lu dans la table `equipes`
 * le 28 août 2026, pas écrit de mémoire. C'est la leçon de `noms-clubs-fr` :
 * « Bayern Munich » et « Red Star Belgrade » ne renvoyaient rien, parce que le
 * fournisseur les appelle « Bayern München » et « Crvena Zvezda ». Un alias faux
 * est aussi inutile qu'un alias absent — sauf qu'il donne l'illusion d'exister.
 *
 * L'écusson n'est donc jamais écrit ici : il est retrouvé dans le référentiel
 * vivant. Une adresse d'image recopiée se périme sans prévenir, et un écusson
 * cassé sur l'écran d'accueil est pire que pas d'écusson du tout.
 */

/** Un club proposé sur la grille d'accueil. */
export interface ClubVedette {
  /** Identifiant du référentiel — `equipes.id`, relevé en base. */
  id: string;
  /** Nom affiché, en français quand l'usage français existe. */
  nom: string;
  /**
   * Ce qu'on montre tant qu'aucun écusson n'a été retrouvé.
   *
   * Il n'y a pas d'état « vide » : la grille est lisible et jolie même si le
   * référentiel ne répond pas, ce qui arrive sur une connexion mobile lente.
   */
  monogramme: string;
  /** Noms sous lesquels le fournisseur connaît ce club. */
  alias: string[];
}

/** Un championnat et ses clubs vedettes. */
export interface ChampionnatVedette {
  /** Identifiant de championnat de l'application (`epl`, `laliga`…). */
  id: string;
  libelle: string;
  drapeau: string;
  clubs: ClubVedette[];
}

export const CHAMPIONNATS_VEDETTES: readonly ChampionnatVedette[] = [
  {
    id: 'laliga',
    libelle: 'La Liga',
    drapeau: '🇪🇸',
    clubs: [
      { id: 'realmadrid', nom: 'Real Madrid', monogramme: 'RM', alias: ['Real Madrid'] },
      { id: 'barcelona', nom: 'FC Barcelone', monogramme: 'FCB', alias: ['Barcelona', 'FC Barcelona'] },
    ],
  },
  {
    id: 'epl',
    libelle: 'Premier League',
    drapeau: '🇬🇧',
    clubs: [
      { id: 'manchestercity', nom: 'Manchester City', monogramme: 'MC', alias: ['Manchester City'] },
      { id: 'liverpool', nom: 'Liverpool', monogramme: 'LFC', alias: ['Liverpool'] },
      { id: 'manchesterunited', nom: 'Manchester United', monogramme: 'MU', alias: ['Manchester United'] },
      { id: 'chelsea', nom: 'Chelsea', monogramme: 'CFC', alias: ['Chelsea'] },
      { id: 'arsenal', nom: 'Arsenal', monogramme: 'ARS', alias: ['Arsenal'] },
    ],
  },
  {
    id: 'ligue1',
    libelle: 'Ligue 1',
    drapeau: '🇫🇷',
    clubs: [
      {
        id: 'parissaintgermain',
        nom: 'Paris Saint-Germain',
        monogramme: 'PSG',
        // « Paris Saint Germain » sans trait d'union chez le fournisseur, et il
        // existe un « Paris FC » dans le même championnat : l'identifiant tranche.
        alias: ['Paris Saint Germain', 'Paris Saint-Germain'],
      },
      { id: 'marseille', nom: 'Marseille', monogramme: 'OM', alias: ['Marseille'] },
    ],
  },
  {
    id: 'seriea',
    libelle: 'Serie A',
    drapeau: '🇮🇹',
    clubs: [
      { id: 'juventus', nom: 'Juventus', monogramme: 'JUV', alias: ['Juventus'] },
      { id: 'acmilan', nom: 'AC Milan', monogramme: 'ACM', alias: ['AC Milan'] },
      { id: 'inter', nom: 'Inter Milan', monogramme: 'INT', alias: ['Inter'] },
    ],
  },
  {
    id: 'bundesliga',
    libelle: 'Bundesliga',
    drapeau: '🇩🇪',
    clubs: [
      {
        id: 'bayernmunchen',
        nom: 'Bayern Munich',
        monogramme: 'BAY',
        // Le fournisseur écrit « Bayern München ». Écrit « Bayern Munich », il
        // ne renvoie rien — c'est exactement le piège documenté dans
        // `noms-clubs-fr.ts`.
        alias: ['Bayern München', 'Bayern Munich'],
      },
      {
        id: 'borussiadortmund',
        nom: 'Borussia Dortmund',
        monogramme: 'BVB',
        alias: ['Borussia Dortmund'],
      },
    ],
  },
];

/**
 * Comparaison sans accent ni casse.
 *
 * Volontairement recopiée ici plutôt qu'importée de `teams-live` : ce module
 * est chargé par le navigateur, et `teams-live` entraîne avec lui tout le
 * client d'API-Football, qui n'a rien à y faire.
 */
export function normaliserNom(valeur: string): string {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Tous les clubs de la grille, championnats confondus. */
export function tousLesClubsVedettes(): ClubVedette[] {
  return CHAMPIONNATS_VEDETTES.flatMap((c) => c.clubs);
}

/** Une équipe du référentiel, réduite à ce dont la grille a besoin. */
export interface EquipeReferentiel {
  id?: string;
  name?: string;
  logo?: string;
}

/**
 * Retrouve l'écusson d'un club vedette dans le référentiel vivant.
 *
 * L'identifiant d'abord : il est exact, et il départage « Paris Saint Germain »
 * de « Paris FC ». Le nom ensuite, au cas où un identifiant changerait de forme
 * un jour — auquel cas la grille continue de s'afficher correctement au lieu de
 * perdre silencieusement ses écussons.
 *
 * Renvoie `null` plutôt qu'une adresse inventée : l'appelant montre alors le
 * monogramme, qui est toujours juste.
 */
export function ecussonDe(club: ClubVedette, equipes: EquipeReferentiel[]): string | null {
  const parId = equipes.find((e) => e.id === club.id);
  if (parId?.logo) return parId.logo;

  const cibles = club.alias.map(normaliserNom);
  const parNom = equipes.find((e) => e.name && cibles.includes(normaliserNom(e.name)));
  return parNom?.logo ?? null;
}
